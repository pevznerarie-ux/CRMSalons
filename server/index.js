require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const https   = require('https');
const bcrypt  = require('bcryptjs');
const multer  = require('multer');

const db = require('./db');
require('./seed'); // garantit admin + config par défaut au démarrage
const { now, genRef, getSetting, getSettings, setSetting, logActivity, STATUTS } = require('./lib');
const { sign, requireAuth, requireRole, ROLE_LABELS } = require('./auth');
const pricing = require('./pricing');
const mailer  = require('./mailer');
const pdf     = require('./pdf');
const reminders = require('./reminders');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, f, cb) => cb(null, uploadDir),
    filename: (req, f, cb) => cb(null, Date.now() + '-' + f.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// ─── ENRICHISSEMENT ───────────────────────────────────────────────────────────
const labels = () => ({
  spaces: Object.fromEntries(db.prepare('SELECT id, nom FROM spaces').all().map(s => [s.id, s.nom])),
  types:  Object.fromEntries(db.prepare('SELECT id, nom FROM event_types').all().map(s => [s.id, s.nom])),
  slots:  Object.fromEntries(db.prepare('SELECT id, nom FROM time_slots').all().map(s => [s.id, s.nom])),
  users:  Object.fromEntries(db.prepare('SELECT id, nom, email FROM users').all().map(u => [u.id, u.nom || u.email])),
});
function enrich(r, L = labels()) {
  if (!r) return r;
  return {
    ...r,
    space_label: L.spaces[r.space_id] || '',
    type_label:  L.types[r.event_type_id] || '',
    slot_label:  L.slots[r.time_slot_id] || '',
    commercial_label: L.users[r.commercial_id] || '',
    options: JSON.parse(r.options_json || '[]'),
  };
}
function getFull(id) {
  const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (!r) return null;
  const full = enrich(r);
  full.payments  = db.prepare('SELECT * FROM payments WHERE reservation_id = ? ORDER BY date_echeance, id').all(id);
  full.documents = db.prepare('SELECT * FROM documents WHERE reservation_id = ? ORDER BY id DESC').all(id);
  full.activity  = db.prepare('SELECT * FROM activity_log WHERE reservation_id = ? ORDER BY id DESC LIMIT 50').all(id);
  return full;
}

// Détection de conflit : même salle, même date, statut actif, plage chevauchante
function findConflict(space_id, date, time_slot_id, excludeId = 0) {
  if (!space_id || !date) return null;
  const rows = db.prepare(`
    SELECT * FROM reservations
    WHERE space_id = ? AND date_evenement = ? AND id != ?
      AND statut IN ('option','confirme','realise')`).all(space_id, date, excludeId);
  const journeeId = db.prepare("SELECT id FROM time_slots WHERE nom LIKE 'Journée%'").get()?.id;
  for (const r of rows) {
    if (!time_slot_id || !r.time_slot_id) return r;             // plage indéfinie → prudence
    if (r.time_slot_id === time_slot_id) return r;              // même plage
    if (r.time_slot_id === journeeId || time_slot_id === journeeId) return r; // journée complète
  }
  return null;
}

// ─── CONFIG PUBLIQUE (pour le formulaire + le CRM) ─────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    spaces:      db.prepare('SELECT * FROM spaces WHERE actif = 1 ORDER BY ordre, nom').all(),
    event_types: db.prepare('SELECT * FROM event_types WHERE actif = 1 ORDER BY ordre, nom').all(),
    time_slots:  db.prepare('SELECT * FROM time_slots WHERE actif = 1 ORDER BY ordre, id').all(),
    options:     db.prepare('SELECT * FROM options WHERE actif = 1 ORDER BY ordre, nom').all(),
    org_nom:     getSetting('org_nom', "Salons d'Honneur Beth Menahem"),
  });
});

// ─── PUBLIC : DEMANDE DE DEVIS DEPUIS LE SITE ──────────────────────────────────
app.post('/api/devis', (req, res) => {
  const b = req.body;
  if (!b.nom || !b.prenom || !b.telephone || !b.email || !b.event_type_id || !b.date_evenement) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }
  const ref = genRef();
  const info = db.prepare(`INSERT INTO reservations
    (reference, nom, prenom, telephone, email, event_type_id, space_id, time_slot_id,
     date_evenement, nombre_personnes, message_client, statut, source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?, 'demande', ?)`).run(
      ref, b.nom.trim(), b.prenom.trim(), b.telephone.trim(), b.email.trim(),
      b.event_type_id || null, b.space_id || null, b.time_slot_id || null,
      b.date_evenement, parseInt(b.nombre_personnes) || 0, b.message_client || '', b.source || 'site');
  const r = enrich(db.prepare('SELECT * FROM reservations WHERE id = ?').get(info.lastInsertRowid));
  logActivity(r.id, null, 'demande_creee', `Demande reçue depuis le site (${r.source})`);

  mailer.sendMail({ to: r.email, subject: `Confirmation de votre demande — réf. ${ref}`, html: mailer.tplConfirmDemande(r) }).catch(console.error);
  const manager = getSetting('org_email') || process.env.MANAGER_EMAIL;
  if (manager) mailer.sendMail({ to: manager, subject: `Nouvelle demande — ${r.prenom} ${r.nom}`, html: mailer.tplAlerteEquipe(r) }).catch(console.error);
  res.json({ success: true, reference: ref });
});

// ─── AUTH ───────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((username || '').trim());
  if (!user || !user.active || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  res.json({ token: sign(user), email: user.email, nom: user.nom, role: user.role, must_change_password: !!user.must_change_password });
});

app.put('/api/password', requireAuth, (req, res) => {
  const { current, newPass } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.must_change_password && !bcrypt.compareSync(current || '', user.password_hash)) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  }
  if (!newPass || newPass.length < 6) return res.status(400).json({ error: 'Minimum 6 caractères' });
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(bcrypt.hashSync(newPass, 10), user.id);
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ ...req.user, role_label: ROLE_LABELS[req.user.role] }));

// ─── UTILISATEURS (admin) ──────────────────────────────────────────────────────
app.get('/api/users', requireAuth, requireRole(), (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé à l\'administrateur' });
  res.json(db.prepare('SELECT id, email, nom, role, telephone, must_change_password, active, created_at FROM users ORDER BY id').all());
});
function genPassword() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  return Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}
app.post('/api/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé à l\'administrateur' });
  const { email, nom, role, telephone } = req.body;
  if (!email || !role) return res.status(400).json({ error: 'Email et rôle requis' });
  if (!['admin', 'commercial', 'regisseur', 'administratif'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.trim())) return res.status(400).json({ error: 'Email déjà utilisé' });
  const temp = genPassword();
  db.prepare(`INSERT INTO users (email, nom, password_hash, role, telephone, must_change_password)
              VALUES (?,?,?,?,?,1)`).run(email.trim(), (nom || '').trim(), bcrypt.hashSync(temp, 10), role, (telephone || '').trim());
  mailer.sendMail({ to: email.trim(), subject: 'Votre accès au CRM', html: mailer.tplBienvenue(email.trim(), temp, ROLE_LABELS[role]) }).catch(console.error);
  res.json({ success: true });
});
app.put('/api/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé à l\'administrateur' });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Introuvable' });
  const { nom, role, telephone, active } = req.body;
  db.prepare('UPDATE users SET nom = ?, role = ?, telephone = ?, active = ? WHERE id = ?')
    .run(nom ?? u.nom, role ?? u.role, telephone ?? u.telephone, active != null ? (active ? 1 : 0) : u.active, u.id);
  res.json({ success: true });
});
app.delete('/api/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé à l\'administrateur' });
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  const count = db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin'").get().n;
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (u?.role === 'admin' && count <= 1) return res.status(400).json({ error: 'Impossible de supprimer le dernier administrateur' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── CONFIGURATION (admin) : salles, types, plages, options, tarifs, settings ──
function crudConfig(route, table, fields) {
  app.post(`/api/${route}`, requireAuth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé à l\'administrateur' });
    const cols = fields.filter(f => req.body[f] !== undefined);
    const info = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map(f => req.body[f]));
    res.json({ success: true, id: info.lastInsertRowid });
  });
  app.put(`/api/${route}/:id`, requireAuth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé à l\'administrateur' });
    const cols = fields.filter(f => req.body[f] !== undefined);
    if (!cols.length) return res.json({ success: true });
    db.prepare(`UPDATE ${table} SET ${cols.map(c => `${c}=?`).join(',')} WHERE id = ?`)
      .run(...cols.map(f => req.body[f]), req.params.id);
    res.json({ success: true });
  });
  app.delete(`/api/${route}/:id`, requireAuth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé à l\'administrateur' });
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  });
}
crudConfig('spaces', 'spaces', ['nom', 'capacite_assise', 'capacite_debout', 'surface_m2', 'couleur', 'description', 'actif', 'ordre']);
crudConfig('event-types', 'event_types', ['nom', 'actif', 'ordre']);
crudConfig('time-slots', 'time_slots', ['nom', 'heure_debut', 'heure_fin', 'actif', 'ordre']);
crudConfig('options', 'options', ['nom', 'prix', 'unite', 'actif', 'ordre']);
crudConfig('pricing-rules', 'pricing_rules', ['libelle', 'space_id', 'event_type_id', 'time_slot_id', 'day_type', 'date_debut', 'date_fin', 'prix', 'priorite', 'actif']);

app.get('/api/settings', requireAuth, (req, res) => res.json(getSettings()));
app.put('/api/settings', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé à l\'administrateur' });
  for (const [k, v] of Object.entries(req.body)) setSetting(k, v);
  res.json({ success: true });
});
// liste brute (admin) des tables de config, y compris inactifs
app.get('/api/config/all', requireAuth, (req, res) => {
  res.json({
    spaces:      db.prepare('SELECT * FROM spaces ORDER BY ordre, nom').all(),
    event_types: db.prepare('SELECT * FROM event_types ORDER BY ordre, nom').all(),
    time_slots:  db.prepare('SELECT * FROM time_slots ORDER BY ordre, id').all(),
    options:     db.prepare('SELECT * FROM options ORDER BY ordre, nom').all(),
    pricing_rules: db.prepare('SELECT * FROM pricing_rules ORDER BY priorite DESC, id').all(),
  });
});

// ─── DEVIS / CALCUL DE PRIX ────────────────────────────────────────────────────
app.post('/api/quote', requireAuth, (req, res) => res.json(pricing.quote(req.body)));

// ─── RÉSERVATIONS ──────────────────────────────────────────────────────────────
app.get('/api/reservations', requireAuth, (req, res) => {
  const { search, statut, space, from, to, commercial } = req.query;
  let rows = db.prepare('SELECT * FROM reservations').all();
  const L = labels();
  rows = rows.map(r => enrich(r, L));
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(r => [r.reference, r.nom, r.prenom, r.telephone, r.email, r.type_label, r.space_label].some(f => f?.toLowerCase().includes(s)));
  }
  if (statut)     rows = rows.filter(r => r.statut === statut);
  if (space)      rows = rows.filter(r => r.space_id === parseInt(space));
  if (commercial) rows = rows.filter(r => r.commercial_id === parseInt(commercial));
  if (from)       rows = rows.filter(r => r.date_evenement >= from);
  if (to)         rows = rows.filter(r => r.date_evenement <= to);
  // Encaissé par réservation
  const paid = db.prepare("SELECT reservation_id, SUM(montant) s FROM payments WHERE statut='paye' GROUP BY reservation_id").all();
  const paidMap = Object.fromEntries(paid.map(p => [p.reservation_id, p.s]));
  rows.forEach(r => { r._encaisse = paidMap[r.id] || 0; });
  rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  res.json(rows);
});

app.get('/api/reservations/:id', requireAuth, (req, res) => {
  const r = getFull(req.params.id);
  if (!r) return res.status(404).json({ error: 'Introuvable' });
  res.json(r);
});

// Vérifier la disponibilité (avant d'enregistrer)
app.get('/api/availability', requireAuth, (req, res) => {
  const { space_id, date, time_slot_id, exclude } = req.query;
  const conflit = findConflict(parseInt(space_id), date, parseInt(time_slot_id) || 0, parseInt(exclude) || 0);
  res.json({ available: !conflit, conflit: conflit ? enrich(conflit) : null });
});

const RES_FIELDS = ['nom', 'prenom', 'telephone', 'email', 'adresse', 'societe', 'space_id', 'event_type_id',
  'time_slot_id', 'date_evenement', 'date_fin', 'nombre_personnes', 'message_client', 'statut', 'source',
  'commercial_id', 'prix_base', 'remise_pct', 'remise_montant', 'acompte_montant', 'traiteur', 'decorateur',
  'prestataires', 'logistique', 'notes_internes'];

function recalcTotal(body, existing = {}) {
  const opts = body.options ?? JSON.parse(existing.options_json || '[]');
  const q = pricing.quote({
    space_id: body.space_id ?? existing.space_id,
    event_type_id: body.event_type_id ?? existing.event_type_id,
    time_slot_id: body.time_slot_id ?? existing.time_slot_id,
    date: body.date_evenement ?? existing.date_evenement,
    nombre_personnes: body.nombre_personnes ?? existing.nombre_personnes,
    options: opts,
    remise_pct: body.remise_pct ?? existing.remise_pct,
    remise_montant: body.remise_montant ?? existing.remise_montant,
    prix_base_override: body.prix_base != null ? Number(body.prix_base) : (existing.prix_base ?? null),
  });
  return { total: q.total, prix_base: q.prix_base, options_json: JSON.stringify(opts) };
}

app.post('/api/reservations', requireAuth, requireRole('commercial', 'administratif'), (req, res) => {
  const b = req.body;
  const ref = genRef();
  const calc = recalcTotal(b);
  const cols = RES_FIELDS.filter(f => b[f] !== undefined);
  const sql = `INSERT INTO reservations (reference, options_json, total, ${cols.join(',')})
               VALUES (?, ?, ?, ${cols.map(() => '?').join(',')})`;
  const info = db.prepare(sql).run(ref, calc.options_json, calc.total, ...cols.map(f => b[f]));
  if (b.prix_base != null) db.prepare('UPDATE reservations SET prix_base = ? WHERE id = ?').run(Number(b.prix_base), info.lastInsertRowid);
  else db.prepare('UPDATE reservations SET prix_base = ? WHERE id = ?').run(calc.prix_base, info.lastInsertRowid);
  logActivity(info.lastInsertRowid, req.user, 'reservation_creee', `Réf. ${ref}`);
  res.json({ success: true, id: info.lastInsertRowid, reference: ref });
});

app.put('/api/reservations/:id', requireAuth, requireRole('commercial', 'administratif', 'regisseur'), (req, res) => {
  const existing = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Introuvable' });
  const b = req.body;
  // Régisseur : ne peut modifier que la logistique / prestataires
  let fields = RES_FIELDS;
  if (req.user.role === 'regisseur') fields = ['traiteur', 'decorateur', 'prestataires', 'logistique'];
  const cols = fields.filter(f => b[f] !== undefined);
  if (cols.length) {
    db.prepare(`UPDATE reservations SET ${cols.map(c => `${c}=?`).join(',')}, updated_at = ? WHERE id = ?`)
      .run(...cols.map(f => b[f]), now(), req.params.id);
  }
  // Recalcul financier (sauf régisseur)
  if (req.user.role !== 'regisseur') {
    const fresh = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
    const calc = recalcTotal(b, fresh);
    db.prepare('UPDATE reservations SET options_json = ?, total = ?, prix_base = ? WHERE id = ?')
      .run(calc.options_json, calc.total, b.prix_base != null ? Number(b.prix_base) : fresh.prix_base, req.params.id);
  }
  logActivity(req.params.id, req.user, 'reservation_modifiee');
  res.json({ success: true });
});

app.delete('/api/reservations/:id', requireAuth, requireRole(), (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Suppression réservée à l\'administrateur' });
  db.prepare('DELETE FROM reservations WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Changer de statut + actions associées (confirmation → email + échéancier)
app.post('/api/reservations/:id/statut', requireAuth, requireRole('commercial', 'administratif'), (req, res) => {
  const { statut } = req.body;
  if (!STATUTS.includes(statut)) return res.status(400).json({ error: 'Statut invalide' });
  const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Introuvable' });
  db.prepare('UPDATE reservations SET statut = ?, updated_at = ? WHERE id = ?').run(statut, now(), req.params.id);
  logActivity(r.id, req.user, 'statut_change', statut);

  if (statut === 'confirme') {
    // Crée l'échéancier si absent : acompte + solde
    const has = db.prepare('SELECT COUNT(*) n FROM payments WHERE reservation_id = ?').get(r.id).n;
    if (!has && r.total > 0) {
      const acomptePct = parseFloat(getSetting('acompte_pct', '30')) || 30;
      const acompte = r.acompte_montant > 0 ? r.acompte_montant : Math.round(r.total * acomptePct / 100);
      const soldeJours = parseInt(getSetting('solde_jours_avant', '30')) || 30;
      const echSolde = r.date_evenement ? new Date(new Date(r.date_evenement).getTime() - soldeJours * 86400000).toISOString().slice(0, 10) : null;
      db.prepare(`INSERT INTO payments (reservation_id, type, libelle, montant, date_echeance) VALUES (?, 'acompte', 'Acompte', ?, ?)`)
        .run(r.id, acompte, new Date().toISOString().slice(0, 10));
      db.prepare(`INSERT INTO payments (reservation_id, type, libelle, montant, date_echeance) VALUES (?, 'solde', 'Solde', ?, ?)`)
        .run(r.id, Math.max(0, r.total - acompte), echSolde);
    }
    const er = enrich(r);
    mailer.sendMail({ to: r.email, subject: `✅ Réservation confirmée — réf. ${r.reference}`, html: mailer.tplConfirmation(er) }).catch(console.error);
  }
  res.json({ success: true });
});

// ─── CALENDRIER ──────────────────────────────────────────────────────────────
app.get('/api/calendar', requireAuth, (req, res) => {
  const { from, to } = req.query;
  let rows = db.prepare(`SELECT * FROM reservations WHERE statut NOT IN ('annule','perdu') AND date_evenement IS NOT NULL`).all();
  if (from) rows = rows.filter(r => r.date_evenement >= from);
  if (to)   rows = rows.filter(r => r.date_evenement <= to);
  const L = labels();
  const spaceColors = Object.fromEntries(db.prepare('SELECT id, couleur FROM spaces').all().map(s => [s.id, s.couleur]));
  res.json(rows.map(r => ({
    id: r.id, reference: r.reference, title: `${r.prenom} ${r.nom} — ${L.types[r.event_type_id] || ''}`,
    start: r.date_evenement, end: r.date_fin || r.date_evenement,
    space_id: r.space_id, space_label: L.spaces[r.space_id] || '',
    slot_label: L.slots[r.time_slot_id] || '', statut: r.statut,
    color: spaceColors[r.space_id] || '#1E3A5F',
  })));
});

// ─── PAIEMENTS ─────────────────────────────────────────────────────────────────
app.post('/api/reservations/:id/payments', requireAuth, requireRole('administratif', 'commercial'), (req, res) => {
  const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Introuvable' });
  const { type, libelle, montant, moyen, date_echeance } = req.body;
  const info = db.prepare(`INSERT INTO payments (reservation_id, type, libelle, montant, moyen, date_echeance)
                           VALUES (?,?,?,?,?,?)`).run(r.id, type || 'autre', libelle || '', Number(montant) || 0, moyen || '', date_echeance || null);
  logActivity(r.id, req.user, 'paiement_ajoute', `${type} ${montant}€`);
  res.json({ success: true, id: info.lastInsertRowid });
});
app.put('/api/payments/:id', requireAuth, requireRole('administratif', 'commercial'), (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Introuvable' });
  const b = req.body;
  const statut = b.statut ?? p.statut;
  const datePaie = statut === 'paye' ? (b.date_paiement || p.date_paiement || new Date().toISOString().slice(0, 10)) : p.date_paiement;
  db.prepare(`UPDATE payments SET type=?, libelle=?, montant=?, moyen=?, statut=?, date_echeance=?, date_paiement=? WHERE id=?`)
    .run(b.type ?? p.type, b.libelle ?? p.libelle, b.montant != null ? Number(b.montant) : p.montant,
         b.moyen ?? p.moyen, statut, b.date_echeance ?? p.date_echeance, datePaie, p.id);
  logActivity(p.reservation_id, req.user, 'paiement_maj', `${b.statut || p.statut}`);
  res.json({ success: true });
});
app.delete('/api/payments/:id', requireAuth, requireRole('administratif'), (req, res) => {
  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});
// Relance manuelle d'une échéance
app.post('/api/payments/:id/relance', requireAuth, requireRole('administratif', 'commercial'), async (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Introuvable' });
  const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(p.reservation_id);
  try { const ok = await reminders.relancePaiement(p, enrich(r)); res.json({ success: ok }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── HELLOASSO ─────────────────────────────────────────────────────────────────
function httpsRequest(method, urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const r = https.request({ hostname: url.hostname, path: url.pathname + url.search, method,
      headers: { ...headers, ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } }, resp => {
      let raw = ''; resp.on('data', d => raw += d);
      resp.on('end', () => { try { resolve({ ok: resp.statusCode < 300, status: resp.statusCode, body: JSON.parse(raw) }); } catch { resolve({ ok: resp.statusCode < 300, status: resp.statusCode, body: raw }); } });
    });
    r.on('error', reject); if (bodyStr) r.write(bodyStr); r.end();
  });
}
let haToken = null, haExp = 0;
async function getHaToken() {
  if (haToken && Date.now() < haExp - 60000) return haToken;
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.HELLOASSO_CLIENT_ID, client_secret: process.env.HELLOASSO_CLIENT_SECRET }).toString();
  const r = await httpsRequest('POST', 'https://api.helloasso.com/oauth2/token', body, { 'Content-Type': 'application/x-www-form-urlencoded' });
  if (!r.ok) throw new Error('Authentification HelloAsso échouée');
  haToken = r.body.access_token; haExp = Date.now() + r.body.expires_in * 1000; return haToken;
}
app.post('/api/payments/:id/helloasso', requireAuth, requireRole('administratif', 'commercial'), async (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Introuvable' });
  const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(p.reservation_id);
  if (!process.env.HELLOASSO_CLIENT_ID || !process.env.HELLOASSO_ORG_SLUG) return res.status(503).json({ error: 'HelloAsso non configuré (.env)' });
  try {
    const token = await getHaToken();
    const serverUrl = (process.env.SERVER_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
    const cents = Math.round(p.montant * 100);
    const desc = `${p.libelle || p.type} — réf. ${r.reference}`;
    const haRes = await httpsRequest('POST', `https://api.helloasso.com/v5/organizations/${process.env.HELLOASSO_ORG_SLUG}/checkout-intents`,
      { totalAmount: cents, initialAmount: cents, itemName: desc.slice(0, 250), backUrl: serverUrl, returnUrl: serverUrl, errorUrl: serverUrl, containsDonation: false, metadata: JSON.stringify({ paymentId: String(p.id), reservationId: String(r.id) }) },
      { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
    if (!haRes.ok) return res.status(haRes.status).json({ error: haRes.body?.message || 'Erreur HelloAsso' });
    db.prepare('UPDATE payments SET helloasso_intent_id = ?, lien_paiement = ?, moyen = ? WHERE id = ?')
      .run(String(haRes.body.checkoutIntentId), haRes.body.redirectUrl, 'helloasso', p.id);
    mailer.sendMail({ to: r.email, subject: `Lien de paiement — réf. ${r.reference}`, html: mailer.tplLienPaiement(enrich(r), p.montant, haRes.body.redirectUrl, desc) }).catch(console.error);
    logActivity(r.id, req.user, 'lien_paiement', `${p.montant}€`);
    res.json({ success: true, lien: haRes.body.redirectUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/webhooks/helloasso', express.json(), (req, res) => {
  res.json({ received: true });
  try {
    const { eventType, data, metadata } = req.body;
    if (eventType !== 'Payment' || !['Authorized', 'Processed'].includes(data?.state)) return;
    let meta = metadata; if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch {} }
    if (!meta?.paymentId) return;
    const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(parseInt(meta.paymentId));
    if (!p || p.statut === 'paye') return;
    db.prepare("UPDATE payments SET statut='paye', date_paiement=? WHERE id=?").run(new Date().toISOString().slice(0, 10), p.id);
    logActivity(p.reservation_id, null, 'paiement_helloasso', `${(data.amount || 0) / 100}€ encaissé`);
    console.log(`✅ Paiement HelloAsso encaissé — paiement #${p.id}`);
  } catch (e) { console.error('Webhook HelloAsso:', e); }
});

// ─── WHATSAPP (notifier le régisseur) ──────────────────────────────────────────
app.get('/api/reservations/:id/whatsapp', requireAuth, (req, res) => {
  const r = getFull(req.params.id);
  if (!r) return res.status(404).json({ error: 'Introuvable' });
  const phone = (process.env.REGISSEUR_WHATSAPP || '').replace(/\D/g, '');
  const { fmtDate } = require('./lib');
  const msg = encodeURIComponent(
    `🎉 Événement — ${getSetting('org_nom')}\n\n📋 Réf : ${r.reference}\n👤 ${r.prenom} ${r.nom}\n📞 ${r.telephone}\n` +
    `🎊 ${r.type_label}\n📅 ${fmtDate(r.date_evenement)}\n⏰ ${r.slot_label}\n🏛️ ${r.space_label}\n👥 ${r.nombre_personnes} pers.\n📌 ${r.statut}`);
  res.json({ url: phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}` });
});

// ─── DOCUMENTS ──────────────────────────────────────────────────────────────────
app.post('/api/reservations/:id/documents', requireAuth, requireRole('commercial', 'administratif', 'regisseur'), upload.single('file'), (req, res) => {
  const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Introuvable' });
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
  db.prepare(`INSERT INTO documents (reservation_id, type, filename, original_name, genere) VALUES (?,?,?,?,0)`)
    .run(r.id, req.body.type || 'autre', req.file.filename, req.file.originalname);
  logActivity(r.id, req.user, 'document_ajoute', `${req.body.type}: ${req.file.originalname}`);
  res.json({ success: true });
});
app.post('/api/reservations/:id/documents/generate', requireAuth, requireRole('commercial', 'administratif'), async (req, res) => {
  const r = getFull(req.params.id);
  if (!r) return res.status(404).json({ error: 'Introuvable' });
  const type = req.body.type === 'contrat' ? 'contrat' : 'devis';
  const q = pricing.quote({ space_id: r.space_id, event_type_id: r.event_type_id, time_slot_id: r.time_slot_id,
    date: r.date_evenement, nombre_personnes: r.nombre_personnes, options: r.options, remise_pct: r.remise_pct,
    remise_montant: r.remise_montant, prix_base_override: r.prix_base });
  const data = { ...r, ...q };
  const { filename } = type === 'contrat' ? await pdf.buildContrat(data) : await pdf.buildDevis(data);
  db.prepare(`INSERT INTO documents (reservation_id, type, filename, original_name, genere) VALUES (?,?,?,?,1)`)
    .run(r.id, type, filename, `${type}-${r.reference}.pdf`);
  logActivity(r.id, req.user, 'document_genere', type);
  res.json({ success: true, filename });
});
app.delete('/api/documents/:id', requireAuth, requireRole('commercial', 'administratif'), (req, res) => {
  const d = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (d) { try { fs.unlinkSync(path.join(uploadDir, d.filename)); } catch {} db.prepare('DELETE FROM documents WHERE id = ?').run(d.id); }
  res.json({ success: true });
});
// Envoyer le devis par email (avec PDF en pièce jointe si présent)
app.post('/api/reservations/:id/send-devis', requireAuth, requireRole('commercial', 'administratif'), async (req, res) => {
  const r = getFull(req.params.id);
  if (!r) return res.status(404).json({ error: 'Introuvable' });
  const doc = db.prepare("SELECT * FROM documents WHERE reservation_id = ? AND type='devis' ORDER BY id DESC LIMIT 1").get(r.id);
  const lignes = r.options.map(o => mailer.row(o.nom, require('./lib').fmtEur(o.total))).join('');
  const attachments = doc ? [{ filename: `devis-${r.reference}.pdf`, path: path.join(uploadDir, doc.filename) }] : [];
  await mailer.sendMail({ to: r.email, subject: `Votre devis — réf. ${r.reference}`, html: mailer.tplDevis(r, lignes), attachments });
  db.prepare("UPDATE reservations SET statut = CASE WHEN statut='demande' THEN 'devis_envoye' ELSE statut END, updated_at=? WHERE id=?").run(now(), r.id);
  logActivity(r.id, req.user, 'devis_envoye');
  res.json({ success: true });
});

// ─── STATS / DASHBOARD ───────────────────────────────────────────────────────
app.get('/api/stats', requireAuth, (req, res) => {
  const rs = db.prepare('SELECT * FROM reservations').all();
  const L = labels();
  const today = new Date().toISOString().slice(0, 10);
  const actifs = rs.filter(r => !['annule', 'perdu'].includes(r.statut));
  const caConfirme = rs.filter(r => ['confirme', 'realise'].includes(r.statut)).reduce((s, r) => s + (r.total || 0), 0);
  // encaissé vs attendu
  const pays = db.prepare("SELECT * FROM payments").all();
  const encaisse = pays.filter(p => p.statut === 'paye').reduce((s, p) => s + p.montant, 0);
  const enRetard = pays.filter(p => p.statut === 'attendu' && p.date_echeance && p.date_echeance < today);
  res.json({
    total: rs.length,
    demandes: rs.filter(r => r.statut === 'demande').length,
    devis: rs.filter(r => r.statut === 'devis_envoye').length,
    options: rs.filter(r => r.statut === 'option').length,
    confirmes: rs.filter(r => r.statut === 'confirme').length,
    annules: rs.filter(r => ['annule', 'perdu'].includes(r.statut)).length,
    ca_confirme: caConfirme,
    encaisse,
    a_encaisser: pays.filter(p => p.statut === 'attendu').reduce((s, p) => s + p.montant, 0),
    retards: enRetard.length,
    retards_montant: enRetard.reduce((s, p) => s + p.montant, 0),
    taux_conversion: rs.length ? Math.round(rs.filter(r => ['confirme', 'realise'].includes(r.statut)).length / rs.length * 100) : 0,
    next_events: actifs.filter(r => r.date_evenement >= today)
      .sort((a, b) => a.date_evenement.localeCompare(b.date_evenement)).slice(0, 6).map(r => enrich(r, L)),
  });
});

// ─── STATIQUE ────────────────────────────────────────────────────────────────
app.use('/uploads', express.static(uploadDir));
app.use('/crm', express.static(path.join(__dirname, '..', 'public', 'crm')));
app.get('/crm*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'crm', 'index.html')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── DÉMARRAGE ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏛️  ${getSetting('org_nom')}`);
  console.log(`📡  Site public : http://localhost:${PORT}`);
  console.log(`📋  CRM         : http://localhost:${PORT}/crm   (admin / admin123)`);
  console.log('─'.repeat(54) + '\n');
  reminders.start();
});

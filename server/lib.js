// ─── Utilitaires partagés ───────────────────────────────────────────────────
const db = require('./db');

const now = () => new Date().toLocaleString('fr-FR', { hour12: false }).replace(',', '');

// Référence unique BM-AAAA-XXXX
function genRef() {
  let ref;
  do {
    ref = `BM-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  } while (db.prepare('SELECT 1 FROM reservations WHERE reference = ?').get(ref));
  return ref;
}

// Paramètres clé/valeur
function getSetting(cle, def = '') {
  const row = db.prepare('SELECT valeur FROM settings WHERE cle = ?').get(cle);
  return row ? row.valeur : def;
}
function getSettings() {
  const rows = db.prepare('SELECT cle, valeur FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.cle, r.valeur]));
}
function setSetting(cle, valeur) {
  db.prepare('INSERT INTO settings (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur')
    .run(cle, String(valeur ?? ''));
}

// Journal d'activité
function logActivity(reservationId, user, action, details = '') {
  db.prepare(`INSERT INTO activity_log (reservation_id, user_id, user_label, action, details)
              VALUES (?, ?, ?, ?, ?)`)
    .run(reservationId || null, user?.id || null, user?.email || 'système', action, details);
}

// On remplace les espaces insécables spéciaux (U+202F, U+00A0) par des espaces
// normaux, sinon le moteur PDF affiche un caractère parasite à leur place.
const fmtEur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
  .format(n || 0).replace(/[  ]/g, ' ');
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d; }
};

const STATUTS = ['demande', 'devis_envoye', 'option', 'confirme', 'realise', 'annule', 'perdu'];
const STATUT_LABELS = {
  demande: 'Demande', devis_envoye: 'Devis envoyé', option: 'Option (pré-réservation)',
  confirme: 'Confirmé', realise: 'Réalisé', annule: 'Annulé', perdu: 'Perdu',
};

module.exports = { now, genRef, getSetting, getSettings, setSetting, logActivity, fmtEur, fmtDate, STATUTS, STATUT_LABELS };

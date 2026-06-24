// ─────────────────────────────────────────────────────────────────────────────
//  Seed : crée le compte admin + une configuration par défaut (modifiable in-app).
//  Idempotent : ne réinsère pas si la table contient déjà des données.
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

function count(table) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}

// ─── PARAMÈTRES ───────────────────────────────────────────────────────────────
const defaultSettings = {
  org_nom:            "Salons d'Honneur Beth Menahem",
  org_adresse:        "",
  org_telephone:      "",
  org_email:          process.env.MANAGER_EMAIL || "",
  org_siret:          "",
  org_iban:           "",
  acompte_pct:        "30",          // acompte par défaut (% du total)
  solde_jours_avant:  "30",          // solde dû X jours avant l'événement
  relance_active:     "1",
  relance_delai_jours:"7",           // relancer tous les X jours
  cgv:                "Conditions générales de vente à compléter dans Paramètres.",
};
for (const [cle, valeur] of Object.entries(defaultSettings)) {
  db.prepare('INSERT OR IGNORE INTO settings (cle, valeur) VALUES (?, ?)').run(cle, valeur);
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
if (count('users') === 0) {
  const email = process.env.ADMIN_EMAIL || 'admin';
  db.prepare(`INSERT INTO users (email, nom, password_hash, role, must_change_password)
              VALUES (?, ?, ?, 'admin', 0)`)
    .run(email, 'Administrateur', bcrypt.hashSync('admin123', 10));
  console.log(`✅ Compte admin créé — identifiant: ${email} / mot de passe: admin123`);
}

// ─── SALLES / ESPACES ─────────────────────────────────────────────────────────
if (count('spaces') === 0) {
  const spaces = [
    ['Grand Salon (320 m²)', 250, 320, 320, '#C9A84C', "Salon principal de 320 m² avec mezzanine, office de service et chambre froide. 250 places assises + 1 piste de danse, ou 220 + 2 pistes."],
    ['Mezzanine — Poste d\'accueil', 50, 60, 0, '#2D5282', "Accueil sobre pour 50 personnes max : stand de boissons soft et crudités."],
    ['Synagogue', 90, 90, 90, '#38A169', "Synagogue de 90 m² avec 90 places assises (gratuite sur demande)."],
    ['Salle polyvalente', 150, 150, 0, '#7C3AED', "Espace pour buffet d'accueil jusqu'à 150 personnes."],
  ];
  const stmt = db.prepare(`INSERT INTO spaces (nom, capacite_assise, capacite_debout, surface_m2, couleur, description, ordre)
                           VALUES (?, ?, ?, ?, ?, ?, ?)`);
  spaces.forEach((s, i) => stmt.run(...s, i));
  console.log(`✅ ${spaces.length} salles pré-créées (à ajuster dans Paramètres).`);
}

// ─── TYPES D'ÉVÉNEMENT ──────────────────────────────────────────────────────────
if (count('event_types') === 0) {
  const types = ['Mariage','Bar-Mitsva','Bat-Mitsva','Brit Mila','Fiançailles',
                 'Anniversaire','Communion / Confirmation','Événement professionnel','Autre événement'];
  const stmt = db.prepare('INSERT INTO event_types (nom, ordre) VALUES (?, ?)');
  types.forEach((t, i) => stmt.run(t, i));
  console.log(`✅ ${types.length} types d'événement pré-créés.`);
}

// ─── PLAGES HORAIRES ────────────────────────────────────────────────────────────
if (count('time_slots') === 0) {
  const slots = [
    ['Matinée', '08:00', '12:00'],
    ['Après-midi', '12:00', '17:00'],
    ['Soirée', '18:00', '00:00'],
    ['Chabbat (vendredi soir & Chabbat midi)', '', ''],
  ];
  const stmt = db.prepare('INSERT INTO time_slots (nom, heure_debut, heure_fin, ordre) VALUES (?, ?, ?, ?)');
  slots.forEach((s, i) => stmt.run(...s, i));
  console.log(`✅ ${slots.length} plages horaires pré-créées.`);
}

// ─── OPTIONS / PRESTATIONS ──────────────────────────────────────────────────────
if (count('options') === 0) {
  const opts = [
    ['Voiturier / Parking (59 places)', 350, 'forfait'],
    ['Salle polyvalente — buffet d\'accueil (150 pers.)', 850, 'forfait'],
    ['Synagogue (90 places) — gratuite sur demande', 0, 'forfait'],
    ['Vestiaire avec hôtesse — inclus', 0, 'forfait'],
  ];
  const stmt = db.prepare('INSERT INTO options (nom, prix, unite, ordre) VALUES (?, ?, ?, ?)');
  opts.forEach((o, i) => stmt.run(...o, i));
  console.log(`✅ ${opts.length} options pré-créées (tarifs à ajuster).`);
}

// ─── RÈGLES TARIFAIRES (prix de base par salle — placeholders à ajuster) ──────────
if (count('pricing_rules') === 0) {
  const grand = db.prepare("SELECT id FROM spaces WHERE nom LIKE 'Grand Salon%'").get();
  const slotId = (nom) => db.prepare('SELECT id FROM time_slots WHERE nom = ?').get(nom)?.id;
  // Tarifs réels du Grand Salon par créneau (frais sécurité/nettoyage inclus)
  const rules = [
    ['Matinée 8h-12h (salon 3000 + sécurité/nettoyage 350)', 'Matinée', 3350],
    ['Après-midi 12h-17h (salon 3700 + sécurité/nettoyage 350)', 'Après-midi', 4050],
    ['Soirée 18h-00h (salon 4700 + sécurité/nettoyage 500)', 'Soirée', 5200],
    ['Chabbat — ven. soir & Chabbat midi (salon 5200 + sécurité/nettoyage 800)', 'Chabbat (vendredi soir & Chabbat midi)', 6000],
  ];
  const stmt = db.prepare(`INSERT INTO pricing_rules (libelle, space_id, time_slot_id, day_type, prix, priorite)
                           VALUES (?, ?, ?, 'tous', ?, 0)`);
  if (grand) rules.forEach(r => stmt.run(r[0], grand.id, slotId(r[1]), r[2]));
  console.log('✅ Tarifs réels Beth Menahem pré-créés (par créneau, frais inclus).');
}

// ─── REMISES (étiquettes) ───────────────────────────────────────────────────────
if (count('discounts') === 0) {
  const remises = [
    ['AlloJ', 'pct', 0],
    ['Personnel', 'pct', 0],
    ['Parents école', 'pct', 0],
    ['Communautaire', 'pct', 0],
  ];
  const stmt = db.prepare('INSERT INTO discounts (libelle, type, valeur, ordre) VALUES (?, ?, ?, ?)');
  remises.forEach((r, i) => stmt.run(...r, i));
  console.log(`✅ ${remises.length} étiquettes de remise pré-créées (valeurs à définir dans Configuration).`);
}

console.log('\n🌱 Seed terminé.\n');

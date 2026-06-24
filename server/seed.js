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
    ['Grand Salon d\'Honneur', 250, 400, 350, '#C9A84C', 'Salle principale avec piste de danse et scène.'],
    ['Salle Bleue',            120, 180, 160, '#2D5282', 'Salle intermédiaire, lumineuse.'],
    ['Espace Cocktail',         60, 120,  90, '#38A169', 'Idéal vin d\'honneur et réceptions debout.'],
    ['Salle de Cérémonie',     150, 200, 180, '#7C3AED', 'Espace dédié aux cérémonies.'],
    ['Mezzanine',               40,  60,  70, '#D69E2E', 'Espace en hauteur, vue sur la salle principale.'],
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
    ['Déjeuner', '12:00', '17:00'],
    ['Dîner', '19:00', '00:00'],
    ['Journée complète', '12:00', '00:00'],
    ['Matinée', '09:00', '13:00'],
    ['Soirée tardive', '21:00', '04:00'],
  ];
  const stmt = db.prepare('INSERT INTO time_slots (nom, heure_debut, heure_fin, ordre) VALUES (?, ?, ?, ?)');
  slots.forEach((s, i) => stmt.run(...s, i));
  console.log(`✅ ${slots.length} plages horaires pré-créées.`);
}

// ─── OPTIONS / PRESTATIONS ──────────────────────────────────────────────────────
if (count('options') === 0) {
  const opts = [
    ['Ménage de fin d\'événement', 350, 'forfait'],
    ['Agent de sécurité', 280, 'forfait'],
    ['Vaisselle & couverts', 6, 'par_personne'],
    ['Mise à disposition sono / éclairage', 450, 'forfait'],
    ['Heure supplémentaire', 200, 'par_heure'],
    ['Vestiaire', 150, 'forfait'],
  ];
  const stmt = db.prepare('INSERT INTO options (nom, prix, unite, ordre) VALUES (?, ?, ?, ?)');
  opts.forEach((o, i) => stmt.run(...o, i));
  console.log(`✅ ${opts.length} options pré-créées (tarifs à ajuster).`);
}

// ─── RÈGLES TARIFAIRES (prix de base par salle — placeholders à ajuster) ──────────
if (count('pricing_rules') === 0) {
  const spaces = db.prepare('SELECT id, nom FROM spaces ORDER BY ordre').all();
  const basePrices = {
    'Grand Salon d\'Honneur': 5200,
    'Salle Bleue': 3200,
    'Espace Cocktail': 1800,
    'Salle de Cérémonie': 2600,
    'Mezzanine': 1200,
  };
  const stmt = db.prepare(`INSERT INTO pricing_rules (libelle, space_id, day_type, prix, priorite)
                           VALUES (?, ?, 'tous', ?, 0)`);
  for (const s of spaces) {
    const prix = basePrices[s.nom] ?? 2000;
    stmt.run(`Tarif de base — ${s.nom}`, s.id, prix);
  }
  // Exemple de majoration week-end sur le Grand Salon (priorité plus haute)
  const grand = spaces.find(s => s.nom.includes('Grand Salon'));
  if (grand) {
    db.prepare(`INSERT INTO pricing_rules (libelle, space_id, day_type, prix, priorite)
                VALUES (?, ?, 'weekend', ?, 10)`)
      .run('Week-end — Grand Salon', grand.id, 6200);
  }
  console.log('✅ Règles tarifaires de base pré-créées (à ajuster dans Paramètres > Tarifs).');
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

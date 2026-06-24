// ─────────────────────────────────────────────────────────────────────────────
//  Mise à jour des données réelles depuis le catalogue Beth Menahem (Levallois).
//  Remplace les espaces / créneaux / tarifs / options d'exemple par les vrais.
//  Idempotent : on vide puis on réinsère la configuration (pas les réservations).
//  Lancer : node server/update-catalogue.js
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const db = require('./db');

const tx = db.exec.bind(db);

// On neutralise temporairement les FK le temps de réinitialiser la config.
db.exec('PRAGMA foreign_keys = OFF;');

// ─── ESPACES RÉELS ──────────────────────────────────────────────────────────
db.exec('DELETE FROM spaces;');
const spaces = [
  ['Grand Salon (320 m²)', 250, 320, 320, '#C9A84C', "Salon principal de 320 m² avec mezzanine, office de service et chambre froide. 250 places assises + 1 piste de danse, ou 220 + 2 pistes."],
  ['Mezzanine — Poste d\'accueil', 50, 60, 0, '#2D5282', "Accueil sobre pour 50 personnes max : stand de boissons soft et crudités."],
  ['Synagogue', 90, 90, 90, '#38A169', "Synagogue de 90 m² avec 90 places assises (gratuite sur demande)."],
  ['Salle polyvalente', 150, 150, 0, '#7C3AED', "Espace pour buffet d'accueil jusqu'à 150 personnes."],
];
const insSpace = db.prepare(`INSERT INTO spaces (nom, capacite_assise, capacite_debout, surface_m2, couleur, description, actif, ordre) VALUES (?,?,?,?,?,?,1,?)`);
spaces.forEach((s, i) => insSpace.run(...s, i));
const grandSalonId = db.prepare("SELECT id FROM spaces WHERE nom LIKE 'Grand Salon%'").get().id;

// ─── CRÉNEAUX RÉELS ─────────────────────────────────────────────────────────
db.exec('DELETE FROM time_slots;');
const slots = [
  ['Matinée', '08:00', '12:00'],
  ['Après-midi', '12:00', '17:00'],
  ['Soirée', '18:00', '00:00'],
  ['Chabbat (vendredi soir & Chabbat midi)', '', ''],
];
const insSlot = db.prepare('INSERT INTO time_slots (nom, heure_debut, heure_fin, actif, ordre) VALUES (?,?,?,1,?)');
const slotIds = {};
slots.forEach((s, i) => { const info = insSlot.run(...s, i); slotIds[s[0]] = info.lastInsertRowid; });

// ─── TARIFS (Grand Salon par créneau, frais sécurité/nettoyage inclus) ────────
db.exec('DELETE FROM pricing_rules;');
const rules = [
  ['Matinée 8h-12h (salon 3000 + sécurité/nettoyage 350)', 'Matinée', 3350],
  ['Après-midi 12h-17h (salon 3700 + sécurité/nettoyage 350)', 'Après-midi', 4050],
  ['Soirée 18h-00h (salon 4700 + sécurité/nettoyage 500)', 'Soirée', 5200],
  ['Chabbat — ven. soir & Chabbat midi (salon 5200 + sécurité/nettoyage 800)', 'Chabbat (vendredi soir & Chabbat midi)', 6000],
];
const insRule = db.prepare(`INSERT INTO pricing_rules (libelle, space_id, time_slot_id, day_type, prix, priorite, actif) VALUES (?,?,?, 'tous', ?, 0, 1)`);
rules.forEach(r => insRule.run(r[0], grandSalonId, slotIds[r[1]], r[2]));

// ─── OPTIONS RÉELLES ─────────────────────────────────────────────────────────
db.exec('DELETE FROM options;');
const options = [
  ['Voiturier / Parking (59 places)', 350, 'forfait'],
  ['Salle polyvalente — buffet d\'accueil (150 pers.)', 850, 'forfait'],
  ['Synagogue (90 places) — gratuite sur demande', 0, 'forfait'],
  ['Vestiaire avec hôtesse — inclus', 0, 'forfait'],
];
const insOpt = db.prepare('INSERT INTO options (nom, prix, unite, actif, ordre) VALUES (?,?,?,1,?)');
options.forEach((o, i) => insOpt.run(...o, i));

// ─── REMISES (si absentes) ─────────────────────────────────────────────────────
if (db.prepare('SELECT COUNT(*) n FROM discounts').get().n === 0) {
  const remises = [['AlloJ', 'pct', 0], ['Personnel', 'pct', 0], ['Parents école', 'pct', 0], ['Communautaire', 'pct', 0]];
  const insR = db.prepare('INSERT INTO discounts (libelle, type, valeur, ordre) VALUES (?,?,?,?)');
  remises.forEach((r, i) => insR.run(...r, i));
}

db.exec('PRAGMA foreign_keys = ON;');

console.log('✅ Catalogue Beth Menahem appliqué :');
console.log(`   • ${spaces.length} espaces, ${slots.length} créneaux, ${rules.length} tarifs, ${options.length} options.`);
console.log('   • Frais de sécurité & nettoyage intégrés au prix de chaque créneau.');
console.log('   • Étiquettes de remise prêtes (valeurs à définir dans Configuration).\n');

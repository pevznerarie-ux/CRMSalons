// ─────────────────────────────────────────────────────────────────────────────
//  Base de données — SQLite natif (node:sqlite, aucune compilation requise)
//  Toutes les données de configuration (salles, types, tarifs, options) sont
//  éditables dans l'application : rien n'est codé en dur.
// ─────────────────────────────────────────────────────────────────────────────
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

// DATA_DIR permet de pointer vers un volume persistant (ex. Railway) ; défaut = ./data
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'crm.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// ─── SCHÉMA ───────────────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  email                TEXT UNIQUE NOT NULL,
  nom                  TEXT DEFAULT '',
  password_hash        TEXT NOT NULL,
  role                 TEXT NOT NULL DEFAULT 'commercial', -- admin | commercial | regisseur | administratif
  telephone            TEXT DEFAULT '',
  must_change_password INTEGER NOT NULL DEFAULT 0,
  active               INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Salles / espaces (configurable)
CREATE TABLE IF NOT EXISTS spaces (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nom              TEXT NOT NULL,
  capacite_assise  INTEGER DEFAULT 0,
  capacite_debout  INTEGER DEFAULT 0,
  surface_m2       INTEGER DEFAULT 0,
  couleur          TEXT DEFAULT '#1E3A5F',   -- couleur dans le calendrier
  description      TEXT DEFAULT '',
  actif            INTEGER NOT NULL DEFAULT 1,
  ordre            INTEGER DEFAULT 0
);

-- Types d'événement (configurable)
CREATE TABLE IF NOT EXISTS event_types (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nom    TEXT NOT NULL,
  actif  INTEGER NOT NULL DEFAULT 1,
  ordre  INTEGER DEFAULT 0
);

-- Plages horaires (configurable)
CREATE TABLE IF NOT EXISTS time_slots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nom          TEXT NOT NULL,
  heure_debut  TEXT DEFAULT '',
  heure_fin    TEXT DEFAULT '',
  actif        INTEGER NOT NULL DEFAULT 1,
  ordre        INTEGER DEFAULT 0
);

-- Moteur tarifaire : règles de prix (la plus spécifique l'emporte via priorite)
-- Un champ NULL = "s'applique à tout". day_type: tous|semaine|weekend
CREATE TABLE IF NOT EXISTS pricing_rules (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  libelle        TEXT DEFAULT '',
  space_id       INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
  event_type_id  INTEGER REFERENCES event_types(id) ON DELETE CASCADE,
  time_slot_id   INTEGER REFERENCES time_slots(id) ON DELETE CASCADE,
  day_type       TEXT DEFAULT 'tous',
  date_debut     TEXT,                 -- saison / période (optionnel) AAAA-MM-JJ
  date_fin       TEXT,
  prix           REAL NOT NULL DEFAULT 0,
  priorite       INTEGER NOT NULL DEFAULT 0,   -- plus élevé = prioritaire
  actif          INTEGER NOT NULL DEFAULT 1
);

-- Remises (étiquettes configurables : AlloJ, Personnel, etc.)
CREATE TABLE IF NOT EXISTS discounts (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  libelle TEXT NOT NULL,
  type    TEXT NOT NULL DEFAULT 'pct',  -- pct | montant
  valeur  REAL NOT NULL DEFAULT 0,
  actif   INTEGER NOT NULL DEFAULT 1,
  ordre   INTEGER DEFAULT 0
);

-- Options / prestations payantes (configurable)
CREATE TABLE IF NOT EXISTS options (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nom    TEXT NOT NULL,
  prix   REAL NOT NULL DEFAULT 0,
  unite  TEXT NOT NULL DEFAULT 'forfait',  -- forfait | par_personne | par_heure
  actif  INTEGER NOT NULL DEFAULT 1,
  ordre  INTEGER DEFAULT 0
);

-- Réservations = cœur du pipeline commercial
CREATE TABLE IF NOT EXISTS reservations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  reference        TEXT UNIQUE NOT NULL,

  -- Client
  nom              TEXT DEFAULT '',
  prenom           TEXT DEFAULT '',
  telephone        TEXT DEFAULT '',
  email            TEXT DEFAULT '',
  adresse          TEXT DEFAULT '',
  societe          TEXT DEFAULT '',

  -- Événement
  space_id         INTEGER REFERENCES spaces(id),
  event_type_id    INTEGER REFERENCES event_types(id),
  time_slot_id     INTEGER REFERENCES time_slots(id),
  date_evenement   TEXT,            -- AAAA-MM-JJ
  date_fin         TEXT,            -- pour les événements sur plusieurs jours
  nombre_personnes INTEGER DEFAULT 0,
  message_client   TEXT DEFAULT '',

  -- Pipeline : demande | devis_envoye | option | confirme | realise | annule | perdu
  statut           TEXT NOT NULL DEFAULT 'demande',
  source           TEXT DEFAULT '',  -- site | telephone | recommandation | salon | reseaux | autre
  commercial_id    INTEGER REFERENCES users(id),

  -- Finances
  prix_base        REAL DEFAULT 0,
  options_json     TEXT DEFAULT '[]', -- [{id,nom,prix,unite,quantite,total}]
  remise_pct       REAL DEFAULT 0,
  remise_montant   REAL DEFAULT 0,
  total            REAL DEFAULT 0,    -- net à payer (calculé)
  acompte_montant  REAL DEFAULT 0,

  -- Prestataires & logistique (régisseur)
  traiteur         TEXT DEFAULT '',
  decorateur       TEXT DEFAULT '',
  prestataires     TEXT DEFAULT '',   -- texte libre / autres
  logistique       TEXT DEFAULT '',   -- consignes techniques, déroulé

  notes_internes   TEXT DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Échéancier de paiement (remplace les cases "payé" : permet les relances)
CREATE TABLE IF NOT EXISTS payments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id      INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  type                TEXT NOT NULL DEFAULT 'acompte', -- acompte | solde | autre
  libelle             TEXT DEFAULT '',
  montant             REAL NOT NULL DEFAULT 0,
  moyen               TEXT DEFAULT '',   -- especes | cheque | virement | cb | helloasso
  statut              TEXT NOT NULL DEFAULT 'attendu', -- attendu | paye | annule
  date_echeance       TEXT,              -- AAAA-MM-JJ
  date_paiement       TEXT,
  helloasso_intent_id TEXT,
  lien_paiement       TEXT,
  relance_count       INTEGER DEFAULT 0,
  last_relance_at     TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Documents (uploadés OU générés : devis, contrat, assurance…)
CREATE TABLE IF NOT EXISTS documents (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  type           TEXT NOT NULL DEFAULT 'autre', -- devis | contrat | assurance | facture | autre
  filename       TEXT NOT NULL,
  original_name  TEXT DEFAULT '',
  genere         INTEGER NOT NULL DEFAULT 0,     -- 1 = généré par le CRM
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Journal d'activité (qui a fait quoi — traçabilité)
CREATE TABLE IF NOT EXISTS activity_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER REFERENCES reservations(id) ON DELETE CASCADE,
  user_id        INTEGER REFERENCES users(id),
  user_label     TEXT DEFAULT '',
  action         TEXT NOT NULL,
  details        TEXT DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Paramètres généraux (clé/valeur) : identité, CGV, acompte par défaut, etc.
CREATE TABLE IF NOT EXISTS settings (
  cle    TEXT PRIMARY KEY,
  valeur TEXT
);

CREATE INDEX IF NOT EXISTS idx_res_date   ON reservations(date_evenement);
CREATE INDEX IF NOT EXISTS idx_res_statut ON reservations(statut);
CREATE INDEX IF NOT EXISTS idx_res_space  ON reservations(space_id);
CREATE INDEX IF NOT EXISTS idx_pay_res    ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_pay_statut ON payments(statut);
CREATE INDEX IF NOT EXISTS idx_doc_res    ON documents(reservation_id);
`);

// ─── MIGRATIONS LÉGÈRES (ajout de colonnes sur bases existantes) ───────────────
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('reservations', 'remise_label', "TEXT DEFAULT ''");

module.exports = db;

// ─── Moteur tarifaire ─────────────────────────────────────────────────────────
//  Sélectionne la règle de prix la plus spécifique qui correspond, puis ajoute
//  les options et applique la remise. Tout est piloté par la table pricing_rules.
const db = require('./db');

function isWeekend(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T12:00:00').getDay(); // 0 dim … 6 sam
  return d === 0 || d === 5 || d === 6; // ven/sam/dim considérés "week-end"
}

// Score de spécificité : plus une règle cible précisément, plus elle prime.
function ruleMatches(rule, ctx) {
  if (!rule.actif) return null;
  if (rule.space_id      && rule.space_id      !== ctx.space_id)      return null;
  if (rule.event_type_id && rule.event_type_id !== ctx.event_type_id) return null;
  if (rule.time_slot_id  && rule.time_slot_id  !== ctx.time_slot_id)  return null;
  if (rule.day_type === 'weekend' && !ctx.weekend) return null;
  if (rule.day_type === 'semaine' &&  ctx.weekend) return null;
  if (rule.date_debut && ctx.date && ctx.date < rule.date_debut) return null;
  if (rule.date_fin   && ctx.date && ctx.date > rule.date_fin)   return null;

  let score = rule.priorite * 1000;
  if (rule.space_id)      score += 8;
  if (rule.event_type_id) score += 4;
  if (rule.time_slot_id)  score += 2;
  if (rule.day_type !== 'tous') score += 1;
  return score;
}

// Prix de base applicable (0 si aucune règle ne matche)
function computeBasePrice({ space_id, event_type_id, time_slot_id, date }) {
  const ctx = { space_id, event_type_id, time_slot_id, date, weekend: isWeekend(date) };
  const rules = db.prepare('SELECT * FROM pricing_rules WHERE actif = 1').all();
  let best = null, bestScore = -1;
  for (const r of rules) {
    const score = ruleMatches(r, ctx);
    if (score !== null && score > bestScore) { best = r; bestScore = score; }
  }
  return { prix: best ? best.prix : 0, rule: best };
}

// Total options : tableau [{id, quantite}] → détail + somme
function computeOptions(selected = [], nombre_personnes = 0) {
  const out = [];
  let total = 0;
  for (const sel of selected) {
    const opt = db.prepare('SELECT * FROM options WHERE id = ? AND actif = 1').get(sel.id);
    if (!opt) continue;
    const qte = sel.unite === 'par_personne' || opt.unite === 'par_personne'
      ? (nombre_personnes || 0)
      : (sel.quantite || 1);
    const ligneTotal = opt.unite === 'par_personne'
      ? opt.prix * (nombre_personnes || 0)
      : opt.prix * (sel.quantite || 1);
    out.push({ id: opt.id, nom: opt.nom, prix: opt.prix, unite: opt.unite, quantite: qte, total: ligneTotal });
    total += ligneTotal;
  }
  return { lignes: out, total };
}

// Devis complet
function quote({ space_id, event_type_id, time_slot_id, date, nombre_personnes, options = [], remise_pct = 0, remise_montant = 0, prix_base_override = null }) {
  const base = prix_base_override != null
    ? { prix: prix_base_override, rule: null }
    : computeBasePrice({ space_id, event_type_id, time_slot_id, date });
  const opts = computeOptions(options, nombre_personnes);
  const sousTotal = base.prix + opts.total;
  const remisePct = (remise_pct || 0) > 0 ? sousTotal * (remise_pct / 100) : 0;
  const total = Math.max(0, sousTotal - remisePct - (remise_montant || 0));
  return {
    prix_base: base.prix,
    rule: base.rule ? base.rule.libelle : null,
    options: opts.lignes,
    options_total: opts.total,
    sous_total: sousTotal,
    remise_pct: remise_pct || 0,
    remise_montant: remise_montant || 0,
    remise_calculee: remisePct + (remise_montant || 0),
    total: Math.round(total * 100) / 100,
  };
}

module.exports = { computeBasePrice, computeOptions, quote, isWeekend };

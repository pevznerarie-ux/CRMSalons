// ─── Relances de paiement automatiques ────────────────────────────────────────
const cron = require('node-cron');
const db = require('./db');
const { getSetting, now, logActivity } = require('./lib');
const { sendMail, tplRelance } = require('./mailer');

function daysBetween(a, b) {
  return Math.floor((new Date(a) - new Date(b)) / 86400000);
}

// Relance un paiement précis (utilisé aussi manuellement depuis le CRM)
async function relancePaiement(payment, reservation) {
  if (!reservation?.email) return false;
  await sendMail({
    to: reservation.email,
    subject: `Rappel de paiement — réf. ${reservation.reference}`,
    html: tplRelance(reservation, payment),
  });
  db.prepare(`UPDATE payments SET relance_count = relance_count + 1, last_relance_at = ? WHERE id = ?`)
    .run(now(), payment.id);
  logActivity(reservation.id, null, 'relance_paiement',
    `Relance ${payment.type} ${payment.montant}€ envoyée à ${reservation.email}`);
  return true;
}

// Passe sur tous les paiements en attente et relance ceux qui le nécessitent
async function runRelances() {
  if (getSetting('relance_active', '1') !== '1') return { sent: 0, skipped: true };
  const delai = parseInt(getSetting('relance_delai_jours', '7')) || 7;
  const today = new Date().toISOString().slice(0, 10);

  const due = db.prepare(`
    SELECT p.*, r.reference, r.email, r.nom, r.prenom, r.date_evenement
    FROM payments p JOIN reservations r ON r.id = p.reservation_id
    WHERE p.statut = 'attendu'
      AND p.date_echeance IS NOT NULL AND p.date_echeance != ''
      AND p.date_echeance <= ?
      AND r.statut NOT IN ('annule','perdu')
  `).all(today);

  let sent = 0;
  for (const p of due) {
    if (p.last_relance_at) {
      const last = p.last_relance_at.slice(0, 10).split('/').reverse().join('-');
      if (daysBetween(today, last) < delai) continue; // déjà relancé récemment
    }
    try { if (await relancePaiement(p, p)) sent++; }
    catch (e) { console.error('Relance échouée pour paiement', p.id, e.message); }
  }
  if (sent) console.log(`📨 ${sent} relance(s) de paiement envoyée(s).`);
  return { sent };
}

function start() {
  // Tous les jours à 9h00
  cron.schedule('0 9 * * *', () => runRelances().catch(console.error), { timezone: 'Europe/Paris' });
  console.log('⏰ Relances de paiement programmées (chaque jour à 9h).');
}

module.exports = { start, runRelances, relancePaiement };

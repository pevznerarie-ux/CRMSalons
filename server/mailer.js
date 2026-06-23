// ─── Emails (nodemailer) ──────────────────────────────────────────────────────
const nodemailer = require('nodemailer');
const { fmtEur, fmtDate, getSetting } = require('./lib');

function transporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendMail(opts) {
  const t = transporter();
  if (!t) { console.warn('✉️  SMTP non configuré — email ignoré:', opts.subject); return { skipped: true }; }
  const org = getSetting('org_nom', "Salons d'Honneur Beth Menahem");
  return t.sendMail({ from: `"${org}" <${process.env.SMTP_USER}>`, ...opts });
}

// ─── Gabarit ──────────────────────────────────────────────────────────────────
const S = {
  wrap: "max-width:600px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif",
  hdr:  "background:linear-gradient(135deg,#1A0A00,#3D1A00);padding:32px;text-align:center",
  h1:   "color:#C9A84C;margin:0;font-size:21px;letter-spacing:.5px",
  body: "background:#fff;padding:30px 34px;color:#1A202C;font-size:14px;line-height:1.6",
  foot: "background:#EDE8DF;padding:16px;text-align:center;font-size:12px;color:#888",
  td:   "padding:9px 12px;border-bottom:1px solid #F0E8D8;font-size:14px",
  tdL:  "padding:9px 12px;border-bottom:1px solid #F0E8D8;font-size:14px;font-weight:600;color:#6B4423;width:38%;background:#FDFAF5",
};
function layout(inner) {
  const org = getSetting('org_nom', "Salons d'Honneur Beth Menahem");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
  <body style="margin:0;background:#F5F0E8"><div style="${S.wrap}">
  <div style="${S.hdr}"><h1 style="${S.h1}">${org}</h1></div>
  <div style="${S.body}">${inner}</div>
  <div style="${S.foot}">${org}</div></div></body></html>`;
}
const row = (k, v) => v ? `<tr><td style="${S.tdL}">${k}</td><td style="${S.td}">${v}</td></tr>` : '';

// ─── Templates ──────────────────────────────────────────────────────────────────
const tplConfirmDemande = (r) => layout(`
  <p>Bonjour <strong>${r.prenom} ${r.nom}</strong>,</p>
  <p>Nous avons bien reçu votre demande. Notre équipe revient vers vous très vite.</p>
  <p>Votre référence : <strong style="color:#C9A84C">${r.reference}</strong></p>
  <table style="width:100%;border-collapse:collapse;margin:18px 0">
    ${row('Événement', r.type_label)}${row('Date', fmtDate(r.date_evenement))}
    ${row('Horaire', r.slot_label)}${row('Salle', r.space_label)}
  </table>
  <p>Merci de votre confiance.</p>`);

const tplAlerteEquipe = (r) => layout(`
  <p>🔔 <strong>Nouvelle demande reçue</strong> — réf. <strong>${r.reference}</strong></p>
  <table style="width:100%;border-collapse:collapse;margin:18px 0">
    ${row('Client', `${r.prenom} ${r.nom}`)}${row('Téléphone', r.telephone)}${row('Email', r.email)}
    ${row('Événement', r.type_label)}${row('Date', fmtDate(r.date_evenement))}
    ${row('Horaire', r.slot_label)}${row('Salle', r.space_label)}${row('Message', r.message_client)}
  </table>
  <p style="font-size:13px;color:#666">Connectez-vous au CRM pour traiter cette demande.</p>`);

const tplDevis = (r, lignesHtml) => layout(`
  <p>Bonjour <strong>${r.prenom} ${r.nom}</strong>,</p>
  <p>Veuillez trouver ci-dessous votre devis pour votre événement. Le détail complet est joint en PDF.</p>
  <table style="width:100%;border-collapse:collapse;margin:18px 0">
    ${row('Référence', r.reference)}${row('Événement', r.type_label)}
    ${row('Date', fmtDate(r.date_evenement))}${row('Salle', r.space_label)}
    ${lignesHtml}
    <tr><td style="${S.tdL}">Total</td><td style="${S.td}"><strong style="color:#276749;font-size:16px">${fmtEur(r.total)}</strong></td></tr>
  </table>
  <p>Ce devis est valable 15 jours. Pour confirmer, un acompte vous sera demandé.</p>`);

const tplConfirmation = (r) => layout(`
  <p>Bonjour <strong>${r.prenom} ${r.nom}</strong>,</p>
  <div style="background:#d4edda;border-left:5px solid #28a745;padding:14px 18px;border-radius:6px;margin:14px 0">
    <strong style="color:#155724">✅ Votre réservation est confirmée !</strong><br>
    <span style="font-size:13px">Référence : ${r.reference}</span>
  </div>
  <table style="width:100%;border-collapse:collapse;margin:18px 0">
    ${row('Événement', r.type_label)}${row('Date', fmtDate(r.date_evenement))}
    ${row('Horaire', r.slot_label)}${row('Salle', r.space_label)}
  </table>
  <p>Notre équipe vous contactera pour la suite. À très bientôt !</p>`);

const tplLienPaiement = (r, montant, lien, description) => layout(`
  <p>Bonjour <strong>${r.prenom} ${r.nom}</strong>,</p>
  <p>Vous pouvez régler en ligne en toute sécurité :</p>
  <div style="background:#F0FFF4;border:2px solid #9AE6B4;border-radius:12px;padding:18px;text-align:center;margin:18px 0">
    <div style="font-size:12px;color:#718096;text-transform:uppercase">Montant à régler</div>
    <div style="font-size:32px;font-weight:700;color:#276749">${fmtEur(montant)}</div>
    ${description ? `<div style="font-size:13px;color:#718096">${description}</div>` : ''}
  </div>
  <a href="${lien}" style="display:block;background:#C9A84C;color:#1A0A00;text-decoration:none;text-align:center;padding:15px;border-radius:10px;font-size:16px;font-weight:700">💳 Payer ${fmtEur(montant)}</a>
  <p style="font-size:12px;color:#718096;text-align:center;margin-top:14px">Paiement sécurisé HelloAsso — réf. ${r.reference}</p>`);

const tplRelance = (r, p) => layout(`
  <p>Bonjour <strong>${r.prenom} ${r.nom}</strong>,</p>
  <p>Petit rappel concernant votre événement du <strong>${fmtDate(r.date_evenement)}</strong> (réf. ${r.reference}).</p>
  <div style="background:#FFFBEB;border-left:5px solid #D69E2E;padding:14px 18px;border-radius:6px;margin:14px 0">
    <strong>${p.libelle || (p.type === 'acompte' ? 'Acompte' : 'Solde')} à régler : ${fmtEur(p.montant)}</strong>
    ${p.date_echeance ? `<br><span style="font-size:13px">Échéance : ${fmtDate(p.date_echeance)}</span>` : ''}
  </div>
  ${p.lien_paiement ? `<a href="${p.lien_paiement}" style="display:block;background:#C9A84C;color:#1A0A00;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:700">💳 Régler maintenant</a>` : '<p>Merci de procéder au règlement ou de nous contacter.</p>'}
  <p style="font-size:13px;color:#666;margin-top:14px">Si le règlement a déjà été effectué, merci d\'ignorer ce message.</p>`);

const tplBienvenue = (email, tempPassword, roleLabel) => layout(`
  <p>Bonjour,</p>
  <p>Un compte CRM a été créé pour vous.</p>
  <table style="width:100%;border-collapse:collapse;margin:18px 0">
    ${row('Identifiant', email)}${row('Rôle', roleLabel)}
  </table>
  <p>Mot de passe temporaire :</p>
  <div style="background:#1E3A5F;border-radius:10px;padding:18px;text-align:center;margin:12px 0">
    <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:2px;font-family:monospace">${tempPassword}</div>
  </div>
  <p style="background:#FFF5F5;border-left:4px solid #E53E3E;padding:12px;border-radius:6px;font-size:13px;color:#C53030">
    ⚠️ Vous devrez définir votre propre mot de passe à la première connexion.</p>`);

module.exports = {
  sendMail, tplConfirmDemande, tplAlerteEquipe, tplDevis, tplConfirmation,
  tplLienPaiement, tplRelance, tplBienvenue, row,
};

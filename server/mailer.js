// ─── Emails (nodemailer) ──────────────────────────────────────────────────────
const nodemailer = require('nodemailer');
const { fmtEur, fmtDate, getSetting, getSettings } = require('./lib');

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
// Palette Beth Menahem : navy + or + crème
const S = {
  wrap: "max-width:620px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif",
  // En-tête navy avec trait or en bas
  hdrOuter: "background:#1E3A5F;padding:0",
  hdrTop:   "background:#1E3A5F;padding:28px 36px 0 36px;text-align:left",
  hdrBar:   "background:linear-gradient(90deg,#C9A84C,#E8D08A,#C9A84C);height:3px",
  h1:       "color:#C9A84C;margin:0 0 4px 0;font-size:22px;letter-spacing:.8px;font-weight:700",
  hdrSub:   "color:#A8C0D8;font-size:12px;margin:0 0 24px 0;letter-spacing:.3px",
  // Corps
  body:     "background:#ffffff;padding:32px 36px;color:#1A202C;font-size:14px;line-height:1.7",
  // Tableau
  table:    "width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #E8E0D0",
  tdL:      "padding:10px 14px;border-bottom:1px solid #EDE8DF;font-size:13px;font-weight:600;color:#1E3A5F;width:36%;background:#F8F4EE",
  td:       "padding:10px 14px;border-bottom:1px solid #EDE8DF;font-size:13px;color:#2D3748",
  // Pied
  foot:     "background:#1E3A5F;padding:18px 36px;text-align:center;font-size:11.5px;color:#A8C0D8",
  footName: "color:#C9A84C;font-weight:700;display:block;margin-bottom:4px",
};

function layout(inner) {
  const s = getSettings();
  const org = s.org_nom || "Salons d'Honneur Beth Menahem";
  const contact = [s.org_adresse, s.org_telephone, s.org_email].filter(Boolean).join('   ·   ');
  return `<!DOCTYPE html><html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px 0;background:#F2EDE6">
<div style="${S.wrap}">
  <!-- En-tête -->
  <div style="${S.hdrOuter}">
    <div style="${S.hdrTop}">
      <table style="width:100%;border-collapse:collapse"><tr>
        <td style="vertical-align:middle">
          <p style="${S.h1}">${org}</p>
          <p style="${S.hdrSub}">Salle de réception &amp; événements</p>
        </td>
        <td style="text-align:right;vertical-align:middle;padding-bottom:24px">
          <div style="width:44px;height:44px;border-radius:50%;background:#15283F;border:2px solid #C9A84C;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#C9A84C;letter-spacing:.5px">BM</div>
        </td>
      </tr></table>
    </div>
    <div style="${S.hdrBar}"></div>
  </div>
  <!-- Corps -->
  <div style="${S.body}">${inner}</div>
  <!-- Pied -->
  <div style="${S.foot}">
    <span style="${S.footName}">${org}</span>
    ${contact}
  </div>
</div>
</body></html>`;
}

const row = (k, v) => v ? `<tr><td style="${S.tdL}">${k}</td><td style="${S.td}">${v}</td></tr>` : '';

// ─── Templates ──────────────────────────────────────────────────────────────────
const tplConfirmDemande = (r) => layout(`
  <p>Bonjour <strong>${r.prenom} ${r.nom}</strong>,</p>
  <p>Nous avons bien reçu votre demande de réservation. Notre équipe vous contacte très prochainement pour confirmer les détails.</p>
  <div style="background:#F8F4EE;border-left:4px solid #C9A84C;padding:14px 18px;border-radius:4px;margin:20px 0">
    <div style="font-size:12px;color:#718096;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Votre référence</div>
    <div style="font-size:20px;font-weight:700;color:#1E3A5F;letter-spacing:1px">${r.reference}</div>
  </div>
  <table style="${S.table}">
    ${row('Événement', r.type_label)}${row('Date', fmtDate(r.date_evenement))}
    ${row('Horaire', r.slot_label)}${row('Salle', r.space_label)}
  </table>
  <p style="font-size:13px;color:#718096">Merci de votre confiance. Nous mettons tout en œuvre pour faire de votre événement un moment exceptionnel.</p>`);

const tplAlerteEquipe = (r) => layout(`
  <div style="background:#1E3A5F;color:#C9A84C;padding:12px 16px;border-radius:8px;margin-bottom:20px;font-weight:700;font-size:15px">
    🔔 Nouvelle demande reçue — <span style="font-family:monospace">${r.reference}</span>
  </div>
  <table style="${S.table}">
    ${row('Client', `${r.prenom} ${r.nom}`)}${row('Téléphone', r.telephone)}${row('Email', r.email)}
    ${row('Événement', r.type_label)}${row('Date', fmtDate(r.date_evenement))}
    ${row('Horaire', r.slot_label)}${row('Salle', r.space_label)}${row('Message', r.message_client)}
  </table>
  <p style="font-size:13px;color:#718096">Connectez-vous au CRM pour traiter cette demande.</p>`);

const tplDevis = (r, lignesHtml) => layout(`
  <p>Bonjour <strong>${r.prenom} ${r.nom}</strong>,</p>
  <p>Veuillez trouver ci-dessous votre devis pour votre événement. Le document complet est joint en PDF à cet email.</p>
  <table style="${S.table}">
    ${row('Référence', r.reference)}
    ${row('Événement', r.type_label)}
    ${row('Date', fmtDate(r.date_evenement))}
    ${row('Horaire', r.slot_label)}
    ${row('Salle', r.space_label)}
    ${row('Invités', r.nombre_personnes ? `${r.nombre_personnes} personnes` : '')}
  </table>
  <table style="${S.table}">
    ${lignesHtml}
    ${r.remise_calculee > 0 ? row(`Remise${r.remise_label ? ` — ${r.remise_label}` : ''}`, `– ${fmtEur(r.remise_calculee)}`) : ''}
    <tr><td style="${S.tdL}"><strong>Total</strong></td><td style="${S.td}"><strong style="color:#1E3A5F;font-size:18px">${fmtEur(r.total)}</strong></td></tr>
    ${r.acompte_montant > 0 ? `<tr><td style="${S.tdL}">Acompte à la réservation</td><td style="${S.td}"><strong style="color:#C9A84C">${fmtEur(r.acompte_montant)}</strong></td></tr>` : ''}
  </table>
  <p style="background:#F8F4EE;border-left:4px solid #C9A84C;padding:12px 16px;border-radius:4px;font-size:13px;color:#4A5568">
    Ce devis est valable <strong>15 jours</strong>. La réservation est ferme à réception de l'acompte et du contrat signé.
  </p>
  <p style="font-size:13px;color:#718096">Pour toute question${getSetting('org_telephone') ? `, contactez-nous au <strong style="color:#1E3A5F">${getSetting('org_telephone')}</strong>` : ', n\'hésitez pas à nous contacter'}.</p>`);

const tplConfirmation = (r) => layout(`
  <p>Bonjour <strong>${r.prenom} ${r.nom}</strong>,</p>
  <div style="background:linear-gradient(135deg,#1E3A5F,#2B5280);color:#fff;padding:20px 24px;border-radius:10px;margin:20px 0;text-align:center">
    <div style="font-size:32px;margin-bottom:8px">🎊</div>
    <div style="font-size:17px;font-weight:700;color:#C9A84C;margin-bottom:4px">Votre réservation est confirmée !</div>
    <div style="font-size:13px;color:#A8C0D8">Référence : <strong style="color:#E8D08A;font-family:monospace">${r.reference}</strong></div>
  </div>
  <table style="${S.table}">
    ${row('Événement', r.type_label)}${row('Date', fmtDate(r.date_evenement))}
    ${row('Horaire', r.slot_label)}${row('Salle', r.space_label)}
  </table>
  <p>Notre équipe vous contactera pour finaliser les détails. Nous avons hâte de vous accueillir !</p>`);

const tplLienPaiement = (r, montant, lien, description) => layout(`
  <p>Bonjour <strong>${r.prenom} ${r.nom}</strong>,</p>
  <p>Vous pouvez régler votre ${description || 'paiement'} en ligne en toute sécurité :</p>
  <div style="background:#F8F4EE;border:2px solid #C9A84C;border-radius:12px;padding:22px;text-align:center;margin:20px 0">
    <div style="font-size:11px;color:#718096;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">Montant à régler</div>
    <div style="font-size:36px;font-weight:700;color:#1E3A5F">${fmtEur(montant)}</div>
    ${description ? `<div style="font-size:13px;color:#718096;margin-top:6px">${description}</div>` : ''}
  </div>
  <a href="${lien}" style="display:block;background:#C9A84C;color:#1E3A5F;text-decoration:none;text-align:center;padding:16px;border-radius:10px;font-size:16px;font-weight:700;letter-spacing:.3px">
    💳 Payer ${fmtEur(montant)} en ligne
  </a>
  <p style="font-size:12px;color:#718096;text-align:center;margin-top:14px">Paiement sécurisé via HelloAsso — réf. <strong>${r.reference}</strong></p>`);

const tplRelance = (r, p) => layout(`
  <p>Bonjour <strong>${r.prenom} ${r.nom}</strong>,</p>
  <p>Nous vous contactons au sujet de votre événement du <strong>${fmtDate(r.date_evenement)}</strong> (réf. <strong style="font-family:monospace;color:#1E3A5F">${r.reference}</strong>).</p>
  <div style="background:#FEF9EC;border:1px solid #E8C84C;border-left:5px solid #C9A84C;padding:16px 20px;border-radius:6px;margin:20px 0">
    <div style="font-weight:700;font-size:15px;color:#1E3A5F">${p.libelle || (p.type === 'acompte' ? 'Acompte' : 'Solde')} — ${fmtEur(p.montant)}</div>
    ${p.date_echeance ? `<div style="font-size:13px;color:#718096;margin-top:4px">Échéance : <strong>${fmtDate(p.date_echeance)}</strong></div>` : ''}
  </div>
  ${p.lien_paiement ? `<a href="${p.lien_paiement}" style="display:block;background:#C9A84C;color:#1E3A5F;text-decoration:none;text-align:center;padding:16px;border-radius:10px;font-size:15px;font-weight:700">💳 Régler maintenant</a>` : '<p>Merci de procéder au règlement ou de nous contacter directement.</p>'}
  <p style="font-size:12px;color:#999;margin-top:16px">Si le règlement a déjà été effectué, merci d\'ignorer ce message.</p>`);

const tplBienvenue = (email, tempPassword, roleLabel) => layout(`
  <p>Bonjour,</p>
  <p>Un accès au CRM <strong>Salons d'Honneur Beth Menahem</strong> a été créé pour vous.</p>
  <table style="${S.table}">
    ${row('Identifiant', `<strong>${email}</strong>`)}${row('Rôle', roleLabel)}
  </table>
  <p>Votre mot de passe temporaire :</p>
  <div style="background:#1E3A5F;border-radius:10px;padding:20px;text-align:center;margin:16px 0">
    <div style="color:#C9A84C;font-size:24px;font-weight:700;letter-spacing:3px;font-family:monospace">${tempPassword}</div>
  </div>
  <div style="background:#FEF2F2;border-left:4px solid #E53E3E;padding:12px 16px;border-radius:4px;font-size:13px;color:#C53030">
    ⚠️ Ce mot de passe est temporaire. Vous devrez en définir un nouveau à la première connexion.
  </div>`);

const tplResetPassword = (user, resetUrl) => layout(`
  <p>Bonjour <strong>${user.prenom || user.nom || user.email}</strong>,</p>
  <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez ci-dessous pour en choisir un nouveau :</p>
  <div style="text-align:center;margin:28px 0">
    <a href="${resetUrl}" style="background:#C9A84C;color:#1E3A5F;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:15px;font-weight:700;display:inline-block;letter-spacing:.5px">
      🔑 Réinitialiser mon mot de passe
    </a>
  </div>
  <p style="font-size:13px;color:#718096;background:#F8F4EE;padding:12px;border-radius:6px">
    ⏱️ Ce lien est valable <strong>1 heure</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.
  </p>
  <p style="font-size:11px;color:#aaa;word-break:break-all">Lien alternatif : <a href="${resetUrl}" style="color:#1E3A5F">${resetUrl}</a></p>`);

const tplDemandeSignature = (r, sigUrl) => layout(`
  <p>Bonjour <strong>${r.prenom} ${r.nom}</strong>,</p>
  <p>Votre devis est prêt. Pour confirmer votre réservation, nous vous invitons à le lire attentivement et à apposer votre signature électronique.</p>
  <table style="${S.table}">
    ${row('Référence', `<strong style="font-family:monospace;color:#1E3A5F">${r.reference}</strong>`)}
    ${row('Événement', r.type_label)}
    ${row('Date', fmtDate(r.date_evenement))}
    ${row('Salle', r.space_label)}
    ${row('Total', `<strong style="font-size:16px;color:#1E3A5F">${fmtEur(r.total)}</strong>`)}
  </table>
  <div style="text-align:center;margin:28px 0">
    <a href="${sigUrl}" style="background:#C9A84C;color:#1E3A5F;text-decoration:none;padding:18px 44px;border-radius:12px;font-size:17px;font-weight:700;display:inline-block;letter-spacing:.5px">
      ✍️ Lire et signer mon devis
    </a>
  </div>
  <p style="font-size:13px;color:#718096;background:#F8F4EE;padding:12px;border-radius:6px">
    ⏱️ Ce lien est valable <strong>7 jours</strong>. Le devis complet est également joint en PDF.
  </p>
  <p style="font-size:13px;color:#718096">Pour toute question${getSetting('org_telephone') ? `, contactez-nous au <strong style="color:#1E3A5F">${getSetting('org_telephone')}</strong>` : ''}.</p>`);

const tplSignatureConfirmee = (r, who = 'client') => layout(`
  <div style="background:linear-gradient(135deg,#1E3A5F,#2B5280);color:#fff;padding:16px 20px;border-radius:8px;margin-bottom:20px">
    <div style="font-size:22px;margin-bottom:6px">${who === 'client' ? '🎉' : '✅'}</div>
    <div style="font-size:16px;font-weight:700;color:#C9A84C">${who === 'client' ? 'Signature client reçue' : 'Devis contresigné'}</div>
    <div style="font-size:13px;color:#A8C0D8;margin-top:4px">
      Le devis <strong style="font-family:monospace;color:#E8D08A">${r.reference}</strong> a été signé ${who === 'client' ? `par <strong>${r.prenom} ${r.nom}</strong>` : 'par l\'équipe'}.
    </div>
  </div>
  <table style="${S.table}">
    ${row('Client', `${r.prenom} ${r.nom}`)}
    ${row('Événement', r.type_label)}
    ${row('Date', fmtDate(r.date_evenement))}
    ${row('Salle', r.space_label)}
    ${row('Total', fmtEur(r.total))}
  </table>
  <p style="font-size:13px;color:#718096">Connectez-vous au CRM pour traiter la suite.</p>`);

module.exports = {
  sendMail, tplConfirmDemande, tplAlerteEquipe, tplDevis, tplConfirmation,
  tplLienPaiement, tplRelance, tplBienvenue, tplResetPassword,
  tplDemandeSignature, tplSignatureConfirmee, row,
};

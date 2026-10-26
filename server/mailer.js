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

// ─── Gabarit premium ──────────────────────────────────────────────────────────
// Palette Beth Menahem: crème / or / dark
// Typographie: Cinzel (titres), Cormorant Garamond (corps)
// Compatible email clients (Gmail, Outlook, Apple Mail)

function layout(inner, opts = {}) {
  const s = getSettings();
  const org = s.org_nom || "Salons d'Honneur Beth Menahem";
  const contact = [s.org_adresse, s.org_telephone, s.org_email].filter(Boolean).join('&nbsp; · &nbsp;');
  const subtitle = opts.subtitle || 'Salle de réception &amp; événements';

  return `<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<title>${org}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&display=swap');
* { box-sizing:border-box; }
body { margin:0; padding:0; background:#EDE7DC; -webkit-text-size-adjust:100%; }
a { color:#B58B45; text-decoration:none; }
</style>
</head>
<body style="margin:0;padding:32px 0;background:#EDE7DC;font-family:'Cormorant Garamond',Georgia,serif">
<div style="max-width:620px;margin:0 auto">

  <!-- ── Header ───────────────────────────────────────────────── -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#221C14">
    <tr>
      <td style="padding:36px 40px 0">
        <!-- Logo row -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle">
              <p style="margin:0 0 4px;font-family:Cinzel,'Times New Roman',serif;font-size:20px;font-weight:700;color:#C9A84C;letter-spacing:2.5px;text-transform:uppercase">${org}</p>
              <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:13px;color:rgba(181,139,69,.65);letter-spacing:1px">${subtitle}</p>
            </td>
            <td style="text-align:right;vertical-align:middle">
              <div style="width:48px;height:48px;border-radius:50%;border:1.5px solid #C9A84C;background:#15100A;display:inline-block;text-align:center;line-height:48px;font-family:Cinzel,'Times New Roman',serif;font-size:15px;font-weight:700;color:#C9A84C;letter-spacing:1px">BM</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Or rule -->
    <tr>
      <td style="padding:28px 0 0">
        <div style="height:1px;background:linear-gradient(90deg,transparent 0%,#B58B45 20%,#C9A84C 50%,#B58B45 80%,transparent 100%)"></div>
      </td>
    </tr>
  </table>

  <!-- ── Body ─────────────────────────────────────────────────── -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FDFAF5">
    <tr>
      <td style="padding:36px 40px;color:#2A2117;font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;line-height:1.7">
        ${inner}
      </td>
    </tr>
  </table>

  <!-- ── Footer ───────────────────────────────────────────────── -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#221C14">
    <tr>
      <td style="padding:6px 0 0">
        <div style="height:1px;background:linear-gradient(90deg,transparent,#B58B45 30%,#C9A84C 50%,#B58B45 70%,transparent)"></div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 40px 24px;text-align:center">
        <p style="margin:0 0 6px;font-family:Cinzel,'Times New Roman',serif;font-size:11px;font-weight:700;color:#C9A84C;letter-spacing:2px;text-transform:uppercase">${org}</p>
        <p style="margin:0;font-size:11.5px;color:rgba(181,139,69,.5);font-family:'Cormorant Garamond',Georgia,serif;font-style:italic">${contact}</p>
      </td>
    </tr>
  </table>

</div>
</body></html>`;
}

// ─── Composants réutilisables ─────────────────────────────────────────────────

// Ligne de tableau info
const row = (k, v) => v ? `
  <tr>
    <td style="padding:10px 14px;border-bottom:1px solid #E8E0D0;font-family:Cinzel,'Times New Roman',serif;font-size:10.5px;font-weight:700;color:#9A8878;letter-spacing:1.5px;text-transform:uppercase;width:36%;background:#F4EEE2;vertical-align:top">${k}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #E8E0D0;font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#2A2117;vertical-align:top">${v}</td>
  </tr>` : '';

// Tableau info
const infoTable = (rows) => `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E8E0D0;border-collapse:collapse;margin:24px 0">
    ${rows}
  </table>`;

// Badge référence
const refBadge = (ref) => `
  <div style="background:#221C14;border-radius:2px;padding:16px 24px;text-align:center;margin:24px 0">
    <p style="margin:0 0 4px;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:11px;color:rgba(181,139,69,.6);letter-spacing:1px">Référence</p>
    <p style="margin:0;font-family:Cinzel,'Times New Roman',serif;font-size:22px;font-weight:700;color:#C9A84C;letter-spacing:4px">${ref}</p>
  </div>`;

// Séparateur or
const ornament = () =>
  `<div style="text-align:center;margin:28px 0;color:#B58B45;font-size:13px;letter-spacing:8px">◆ &nbsp; ◆ &nbsp; ◆</div>`;

// Bouton principal
const cta = (url, label) => `
  <div style="text-align:center;margin:32px 0">
    <a href="${url}" style="display:inline-block;background:#221C14;color:#C9A84C;font-family:Cinzel,'Times New Roman',serif;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:18px 48px;border-radius:2px;border:1px solid rgba(181,139,69,.3)">
      ${label}
    </a>
  </div>`;

// Note (fond crème avec trait or)
const note = (html) =>
  `<div style="background:#F4EEE2;border-left:3px solid #B58B45;padding:14px 18px;border-radius:0 2px 2px 0;margin:20px 0;font-family:'Cormorant Garamond',Georgia,serif;font-size:14.5px;color:#6B5744;line-height:1.6">
    ${html}
  </div>`;

// Salutation
const hello = (r) =>
  `<p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-style:italic;color:#2A2117;margin:0 0 20px">
    Bonjour <strong style="font-style:normal">${r.prenom} ${r.nom}</strong>,
  </p>`;

// ─── Templates ───────────────────────────────────────────────────────────────

const tplConfirmDemande = (r) => layout(`
  ${hello(r)}
  <p style="font-size:16px;color:#2A2117;margin:0 0 20px">
    Nous avons bien reçu votre demande de réservation. Notre équipe vous contactera
    très prochainement pour confirmer les détails de votre événement.
  </p>
  ${refBadge(r.reference)}
  ${infoTable(
    row('Événement', r.type_label) +
    row('Date', fmtDate(r.date_evenement)) +
    row('Horaire', r.slot_label) +
    row('Salle', r.space_label)
  )}
  ${ornament()}
  <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:15px;color:#9A8878;text-align:center">
    Merci de votre confiance. Nous mettons tout en œuvre pour faire<br>
    de votre événement un moment d'exception.
  </p>
`);

const tplAlerteEquipe = (r) => layout(`
  <div style="background:#221C14;border-radius:2px;padding:16px 20px;margin-bottom:24px">
    <p style="margin:0;font-family:Cinzel,'Times New Roman',serif;font-size:12px;font-weight:700;color:#C9A84C;letter-spacing:2px;text-transform:uppercase">
      🔔 &nbsp;Nouvelle demande reçue
    </p>
    <p style="margin:4px 0 0;font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:rgba(201,168,76,.7);font-style:italic">
      Référence : ${r.reference}
    </p>
  </div>
  ${infoTable(
    row('Client', `${r.prenom} ${r.nom}`) +
    row('Téléphone', r.telephone) +
    row('Email', r.email) +
    row('Événement', r.type_label) +
    row('Date', fmtDate(r.date_evenement)) +
    row('Horaire', r.slot_label) +
    row('Salle', r.space_label) +
    row('Message', r.message_client)
  )}
  ${note('Connectez-vous au CRM pour traiter cette demande.')}
`, { subtitle: 'Notification interne' });

const tplDevis = (r, lignesHtml) => layout(`
  ${hello(r)}
  <p style="font-size:16px;color:#2A2117;margin:0 0 8px">
    Veuillez trouver ci-dessous votre devis. Le document complet est joint en PDF à cet email.
  </p>
  ${refBadge(r.reference)}
  ${infoTable(
    row('Événement', r.type_label) +
    row('Date', fmtDate(r.date_evenement)) +
    row('Horaire', r.slot_label) +
    row('Salle', r.space_label) +
    (r.nombre_personnes ? row('Invités', `${r.nombre_personnes} personnes`) : '')
  )}
  <!-- Tableau financier -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E8E0D0;border-collapse:collapse;margin:0 0 24px">
    ${lignesHtml}
    ${r.remise_calculee > 0 ? `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #E8E0D0;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:#9A8878;font-style:italic">
        Remise${r.remise_label ? ` — ${r.remise_label}` : ''}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #E8E0D0;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:#9A8878;text-align:right">
        – ${fmtEur(r.remise_calculee)}
      </td>
    </tr>` : ''}
    <tr style="background:#221C14">
      <td style="padding:14px 16px;font-family:Cinzel,'Times New Roman',serif;font-size:11px;font-weight:700;color:#C9A84C;letter-spacing:1.5px;text-transform:uppercase">
        Total TTC
      </td>
      <td style="padding:14px 16px;font-family:Cinzel,'Times New Roman',serif;font-size:22px;font-weight:700;color:#C9A84C;text-align:right;letter-spacing:1px">
        ${fmtEur(r.total)}
      </td>
    </tr>
    ${r.acompte_montant > 0 ? `
    <tr style="background:#F4EEE2">
      <td style="padding:10px 16px;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:#6B5744;font-style:italic">
        Acompte à la réservation
      </td>
      <td style="padding:10px 16px;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:#B58B45;font-weight:600;text-align:right">
        ${fmtEur(r.acompte_montant)}
      </td>
    </tr>` : ''}
  </table>
  ${note(`⏱ Ce devis est valable <strong>15 jours</strong>. La réservation est ferme à réception de l'acompte et du contrat signé.`)}
  <p style="font-size:15px;color:#6B5744;margin:0">
    Pour toute question${getSetting('org_telephone') ? `, contactez-nous au <strong style="color:#221C14">${getSetting('org_telephone')}</strong>` : ', n\'hésitez pas à nous contacter'}.
  </p>
`);

const tplConfirmation = (r) => layout(`
  ${hello(r)}
  <!-- Bloc confirmation -->
  <div style="background:#221C14;border-radius:2px;padding:28px 24px;text-align:center;margin:20px 0">
    <p style="margin:0 0 8px;font-size:36px">🎊</p>
    <p style="margin:0 0 6px;font-family:Cinzel,'Times New Roman',serif;font-size:16px;font-weight:700;color:#C9A84C;letter-spacing:1.5px;text-transform:uppercase">
      Votre réservation est confirmée
    </p>
    <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:14px;color:rgba(181,139,69,.65)">
      Référence : <strong style="font-family:Cinzel,serif;font-style:normal;color:#E8D08A;letter-spacing:2px">${r.reference}</strong>
    </p>
  </div>
  ${infoTable(
    row('Événement', r.type_label) +
    row('Date', fmtDate(r.date_evenement)) +
    row('Horaire', r.slot_label) +
    row('Salle', r.space_label)
  )}
  ${ornament()}
  <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:16px;color:#2A2117;text-align:center;margin:0">
    Notre équipe vous contactera pour finaliser les détails.<br>
    Nous avons hâte de vous accueillir.
  </p>
`);

const tplLienPaiement = (r, montant, lien, description) => layout(`
  ${hello(r)}
  <p style="font-size:16px;color:#2A2117;margin:0 0 24px">
    Vous pouvez régler votre ${description || 'paiement'} en ligne en toute sécurité via HelloAsso.
  </p>
  <!-- Montant -->
  <div style="background:#221C14;border-radius:2px;padding:28px 24px;text-align:center;margin:0 0 24px">
    <p style="margin:0 0 6px;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:12px;color:rgba(181,139,69,.65);text-transform:uppercase;letter-spacing:1px">
      Montant à régler
    </p>
    <p style="margin:0;font-family:Cinzel,'Times New Roman',serif;font-size:38px;font-weight:700;color:#C9A84C;letter-spacing:1px">
      ${fmtEur(montant)}
    </p>
    ${description ? `<p style="margin:8px 0 0;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:rgba(181,139,69,.6);font-style:italic">${description}</p>` : ''}
  </div>
  ${cta(lien, '💳 &nbsp;Régler en ligne')}
  <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;color:#9A8878;font-style:italic;text-align:center;margin:0">
    Paiement sécurisé via HelloAsso — réf.&nbsp;<strong style="font-family:Cinzel,serif;font-style:normal;font-size:11px;letter-spacing:1px">${r.reference}</strong>
  </p>
`);

const tplRelance = (r, p) => layout(`
  ${hello(r)}
  <p style="font-size:16px;color:#2A2117;margin:0 0 20px">
    Nous vous contactons au sujet de votre événement du
    <strong>${fmtDate(r.date_evenement)}</strong>
    (réf.&nbsp;<strong style="font-family:Cinzel,serif;font-size:13px;letter-spacing:1px;color:#221C14">${r.reference}</strong>).
  </p>
  <!-- Paiement dû -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4EEE2;border:1px solid #D8CFC2;border-left:3px solid #B58B45;border-radius:0 2px 2px 0;margin:0 0 24px">
    <tr>
      <td style="padding:18px 20px">
        <p style="margin:0 0 4px;font-family:Cinzel,'Times New Roman',serif;font-size:11px;font-weight:700;color:#9A8878;letter-spacing:2px;text-transform:uppercase">
          ${p.libelle || (p.type === 'acompte' ? 'Acompte' : 'Solde')}
        </p>
        <p style="margin:0 0 4px;font-family:Cinzel,'Times New Roman',serif;font-size:26px;font-weight:700;color:#221C14;letter-spacing:1px">
          ${fmtEur(p.montant)}
        </p>
        ${p.date_echeance ? `<p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:#6B5744">Échéance : <strong>${fmtDate(p.date_echeance)}</strong></p>` : ''}
      </td>
    </tr>
  </table>
  ${p.lien_paiement
    ? cta(p.lien_paiement, '💳 &nbsp;Régler maintenant')
    : '<p style="font-size:15px;color:#6B5744">Merci de procéder au règlement ou de nous contacter directement.</p>'}
  <p style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:13px;color:#9A8878;font-style:italic;text-align:center;margin:20px 0 0">
    Si le règlement a déjà été effectué, merci d'ignorer ce message.
  </p>
`);

const tplBienvenue = (email, tempPassword, roleLabel) => layout(`
  <p style="font-size:16px;color:#2A2117;margin:0 0 20px">Bonjour,</p>
  <p style="font-size:16px;color:#2A2117;margin:0 0 24px">
    Un accès au CRM <strong>Salons d'Honneur Beth Menahem</strong> a été créé pour vous avec le rôle <strong>${roleLabel}</strong>.
  </p>
  ${infoTable(
    row('Identifiant', `<strong>${email}</strong>`) +
    row('Rôle', roleLabel)
  )}
  <p style="font-family:Cinzel,'Times New Roman',serif;font-size:10px;font-weight:700;color:#9A8878;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px">
    Mot de passe temporaire
  </p>
  <div style="background:#221C14;border-radius:2px;padding:22px;text-align:center;margin:0 0 20px">
    <p style="margin:0;font-family:Cinzel,'Times New Roman',serif;font-size:28px;font-weight:700;color:#C9A84C;letter-spacing:5px">
      ${tempPassword}
    </p>
  </div>
  ${note('⚠️ Ce mot de passe est temporaire. Vous devrez en définir un nouveau à la première connexion.')}
`, { subtitle: 'Bienvenue dans le CRM' });

const tplResetPassword = (user, resetUrl) => layout(`
  <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-style:italic;color:#2A2117;margin:0 0 20px">
    Bonjour <strong style="font-style:normal">${user.prenom || user.nom || user.email}</strong>,
  </p>
  <p style="font-size:16px;color:#2A2117;margin:0 0 8px">
    Vous avez demandé la réinitialisation de votre mot de passe.
  </p>
  <p style="font-size:16px;color:#6B5744;margin:0 0 28px">
    Cliquez sur le bouton ci-dessous pour en choisir un nouveau :
  </p>
  ${cta(resetUrl, '🔑 &nbsp;Réinitialiser mon mot de passe')}
  ${note('⏱ Ce lien est valable <strong>1 heure</strong>. Si vous n\'êtes pas à l\'origine de cette demande, ignorez simplement cet email.')}
  <p style="font-size:11px;color:#bbb;word-break:break-all;margin:16px 0 0">
    Lien alternatif : <a href="${resetUrl}" style="color:#9A8878">${resetUrl}</a>
  </p>
`);

const tplDemandeSignature = (r, sigUrl) => layout(`
  ${hello(r)}
  <p style="font-size:16px;color:#2A2117;margin:0 0 8px">
    Votre devis est prêt. Lisez-le attentivement et acceptez-le en apposant votre signature électronique directement en ligne.
  </p>
  ${refBadge(r.reference)}
  ${infoTable(
    row('Événement', r.type_label) +
    row('Date', fmtDate(r.date_evenement)) +
    row('Salle', r.space_label) +
    row('Total', `<span style="font-family:Cinzel,serif;font-size:18px;font-weight:700;color:#221C14">${fmtEur(r.total)}</span>`)
  )}
  <!-- CTA signature -->
  <div style="background:#221C14;border-radius:2px;padding:28px 32px;text-align:center;margin:28px 0">
    <p style="margin:0 0 6px;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:14px;color:rgba(181,139,69,.65)">
      En un seul geste
    </p>
    <p style="margin:0 0 20px;font-family:Cinzel,'Times New Roman',serif;font-size:14px;font-weight:700;color:#C9A84C;letter-spacing:1.5px;text-transform:uppercase">
      Accepter &amp; signer votre devis
    </p>
    <a href="${sigUrl}" style="display:inline-block;background:#B58B45;color:#221C14;font-family:Cinzel,'Times New Roman',serif;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:18px 40px;border-radius:2px">
      ✍️ &nbsp;Lire, accepter et signer
    </a>
    <p style="margin:16px 0 0;font-family:'Cormorant Garamond',Georgia,serif;font-size:12px;color:rgba(181,139,69,.5);font-style:italic">
      Ce lien est valable 7 jours — Le devis complet est également joint en PDF
    </p>
  </div>
  ${note(`Pour toute question${getSetting('org_telephone') ? `, contactez-nous au <strong>${getSetting('org_telephone')}</strong>` : ''}.`)}
`);

const tplSignatureConfirmee = (r, who = 'client') => layout(`
  <div style="background:#221C14;border-radius:2px;padding:20px 24px;margin-bottom:24px">
    <p style="margin:0 0 6px;font-size:28px">${who === 'client' ? '🎉' : '✅'}</p>
    <p style="margin:0 0 4px;font-family:Cinzel,'Times New Roman',serif;font-size:13px;font-weight:700;color:#C9A84C;letter-spacing:1.5px;text-transform:uppercase">
      ${who === 'client' ? 'Signature client reçue' : 'Devis contresigné'}
    </p>
    <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:rgba(181,139,69,.65);font-style:italic">
      Devis <strong style="font-family:Cinzel,serif;font-style:normal;color:#E8D08A;letter-spacing:1.5px;font-size:12px">${r.reference}</strong>
      — signé ${who === 'client' ? `par <strong>${r.prenom} ${r.nom}</strong>` : 'par l\'équipe'}
    </p>
  </div>
  ${infoTable(
    row('Client', `${r.prenom} ${r.nom}`) +
    row('Événement', r.type_label) +
    row('Date', fmtDate(r.date_evenement)) +
    row('Salle', r.space_label) +
    row('Total', fmtEur(r.total))
  )}
  ${note('Connectez-vous au CRM pour traiter la suite.')}
`, { subtitle: 'Notification interne' });

module.exports = {
  sendMail, tplConfirmDemande, tplAlerteEquipe, tplDevis, tplConfirmation,
  tplLienPaiement, tplRelance, tplBienvenue, tplResetPassword,
  tplDemandeSignature, tplSignatureConfirmee, row,
};

// ─── Génération PDF (devis & contrat) ─────────────────────────────────────────
const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');
const { fmtEur, fmtDate, getSetting, getSettings } = require('./lib');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const LOGO_PATH = path.join(__dirname, '..', 'public', 'logo.png');

// ── Palette Beth Menahem (alignée site vitrine) ───────────────────────────────
const C = {
  dark:     '#221C14',   // fond sombre — même que site vitrine
  darkMd:   '#2E2416',   // variante sombre
  gold:     '#C9A84C',   // or signature
  goldSite: '#B58B45',   // or site vitrine
  goldLt:   '#E8D08A',   // or clair
  cream:    '#F4EEE2',   // crème site vitrine
  creamSoft:'#FAF7F2',   // crème très doux
  brown:    '#2A2117',   // texte principal
  warm:     '#6B5744',   // texte secondaire chaud
  muted:    '#9A8878',   // texte tertiaire
  border:   '#D8CFC2',   // séparateurs
  green:    '#2D7A4F',   // montants positifs
  white:    '#FDFAF5',   // blanc chaud
  // Compat backward
  navy:    '#221C14',
  navyDk:  '#15100A',
  grey:    '#9A8878',
  lightLine:'#D8CFC2',
  creamMd: '#EDE5D6',
};

// ── En-tête ───────────────────────────────────────────────────────────────────
function header(doc, org, titre, ref) {
  const W = doc.page.width;
  // Bande sombre pleine hauteur
  doc.rect(0, 0, W, 120).fill(C.dark);
  // Accent or gauche (trait vertical élégant)
  doc.rect(0, 0, 5, 120).fill(C.gold);
  // Liseré or en bas de l'en-tête
  doc.rect(0, 117, W, 2).fill(C.gold);
  // Dégradé crème sous l'en-tête (bande légère)
  doc.rect(0, 119, W, 8).fill(C.creamMd);

  const logoW = 180, logoH = 68;
  const logoX = 28, logoY = 26;
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, logoX, logoY, { width: logoW, height: logoH, fit: [logoW, logoH] });
  } else {
    // Monogramme premium
    const nom = org.org_nom || "Salons d'Honneur Beth Menahem";
    // Cercle or
    doc.circle(logoX + 22, logoY + 22, 22).fillAndStroke(C.dark, C.gold).lineWidth(1.5);
    doc.fillColor(C.gold).fontSize(13).font('Times-Bold')
       .text('BM', logoX + 9, logoY + 14, { width: 44, align: 'center' });
    // Nom établissement
    doc.fillColor(C.gold).fontSize(13).font('Times-Bold')
       .text(nom, logoX + 52, logoY + 8, { width: W - 260, lineGap: 2 });
    const s = org.org_slogan || 'Salle de réception & événements';
    doc.fillColor('rgba(201,168,76,0.55)').fontSize(9).font('Times-Roman')
       .text(s, logoX + 52, doc.y + 2, { width: W - 260 });
  }

  // Coordonnées sous le logo
  const coord = [org.org_adresse, org.org_telephone, org.org_email].filter(Boolean).join('  ·  ');
  if (coord) {
    doc.fillColor('rgba(232,208,138,0.55)').fontSize(7.5).font('Helvetica')
       .text(coord, logoX, logoY + logoH - 2, { width: logoW + 40 });
  }

  // Cartouche titre/ref à droite — fond légèrement plus clair
  const cX = W - 165, cW = 145;
  doc.roundedRect(cX, 18, cW, 84, 3).fill('#2E2416');
  // Trait or gauche du cartouche
  doc.rect(cX, 18, 2, 84).fill(C.gold);

  doc.fillColor('rgba(201,168,76,0.5)').fontSize(7.5).font('Helvetica')
     .text('DOCUMENT', cX + 10, 26, { width: cW - 12, align: 'center', characterSpacing: 1.5 });
  doc.fillColor(C.gold).fontSize(17).font('Times-Bold')
     .text(titre, cX + 10, 37, { width: cW - 12, align: 'center' });
  // Séparateur
  doc.rect(cX + 16, 62, cW - 32, 0.5).fill(C.goldSite);
  doc.fillColor('rgba(232,208,138,0.6)').fontSize(7.5).font('Helvetica')
     .text('RÉFÉRENCE', cX + 10, 68, { width: cW - 12, align: 'center', characterSpacing: 1 });
  doc.fillColor(C.goldLt).fontSize(10).font('Helvetica-Bold')
     .text(ref, cX + 10, 79, { width: cW - 12, align: 'center', characterSpacing: 0.5 });

  return 140;
}

// ── Bloc client ───────────────────────────────────────────────────────────────
function clientBlock(doc, r, y) {
  const W = doc.page.width;
  const x = 40, w = W - 80;
  const colW = (w - 16) / 2;

  // Ligne titre section
  doc.rect(x, y, w, 22).fill(C.dark);
  doc.rect(x, y, 3, 22).fill(C.gold);
  doc.fillColor(C.gold).fontSize(7).font('Helvetica-Bold')
     .text('CLIENT', x + 10, y + 7, { characterSpacing: 2 });
  // Petite date à droite
  doc.fillColor('rgba(201,168,76,0.5)').fontSize(7.5).font('Helvetica')
     .text(new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }), x + 10, y + 7, { width: w - 14, align: 'right' });
  y += 22;

  // Col gauche — info client
  const h = 68;
  doc.rect(x, y, colW, h).fillAndStroke(C.cream, C.border);
  doc.rect(x, y, 3, h).fill(C.goldSite);

  doc.fillColor(C.dark).fontSize(12).font('Times-Bold')
     .text(`${r.prenom} ${r.nom}`, x + 12, y + 10, { width: colW - 20 });
  let ty = doc.y + 3;
  if (r.societe) {
    doc.fillColor(C.warm).fontSize(9).font('Helvetica').text(r.societe, x + 12, ty, { width: colW - 20 });
    ty = doc.y + 2;
  }
  if (r.adresse) {
    doc.fillColor(C.muted).fontSize(8.5).font('Helvetica').text(r.adresse, x + 12, ty, { width: colW - 20 });
    ty = doc.y + 2;
  }
  const contact = [r.telephone, r.email].filter(Boolean).join('  ·  ');
  if (contact) doc.fillColor(C.muted).fontSize(8).font('Helvetica').text(contact, x + 12, ty, { width: colW - 20 });

  // Col droite — émetteur (établissement)
  const cx2 = x + colW + 16;
  doc.rect(cx2, y, colW, h).fillAndStroke('#F0EAE0', C.border);
  const s = getSettings();
  doc.fillColor(C.dark).fontSize(9).font('Helvetica-Bold')
     .text('Établissement', cx2 + 12, y + 10, { width: colW - 20 });
  doc.fillColor(C.warm).fontSize(9.5).font('Times-Roman')
     .text(s.org_nom || "Salons d'Honneur Beth Menahem", cx2 + 12, y + 24, { width: colW - 20 });
  if (s.org_adresse) doc.fillColor(C.muted).fontSize(8.5).font('Helvetica')
     .text(s.org_adresse, cx2 + 12, doc.y + 2, { width: colW - 20 });
  if (s.org_telephone) doc.fillColor(C.muted).fontSize(8.5).font('Helvetica')
     .text(s.org_telephone, cx2 + 12, doc.y + 2, { width: colW - 20 });

  return y + h + 14;
}

// ── Bloc événement ────────────────────────────────────────────────────────────
function eventBlock(doc, r, y) {
  const W = doc.page.width;
  const x = 40, w = W - 80;

  doc.rect(x, y, w, 22).fill(C.dark);
  doc.rect(x, y, 3, 22).fill(C.gold);
  doc.fillColor(C.gold).fontSize(7).font('Helvetica-Bold')
     .text('DÉTAILS DE L\'ÉVÉNEMENT', x + 10, y + 7, { characterSpacing: 2 });
  y += 22;

  const cols = [
    ['Type', r.type_label],
    ['Date', fmtDate(r.date_evenement)],
    ['Horaire', r.slot_label],
    ['Salle', r.space_label],
    r.nombre_personnes ? ['Invités', `${r.nombre_personnes} personnes`] : null,
  ].filter(Boolean);

  const ncols = Math.min(cols.length, 4);
  const colW = w / ncols;
  const rowH = 44;

  for (let i = 0; i < cols.length; i++) {
    const cx = x + (i % ncols) * colW;
    const row = Math.floor(i / ncols);
    const cy = y + row * rowH;
    const bg = (Math.floor(i / ncols) % 2 === 0) ? C.creamSoft : C.cream;
    doc.rect(cx, cy, colW, rowH).fillAndStroke(bg, C.border);
    if (i % ncols === 0) doc.rect(cx, cy, 3, rowH).fill(C.goldSite);
    doc.fillColor(C.muted).fontSize(7).font('Helvetica-Bold')
       .text((cols[i][0]).toUpperCase(), cx + 10, cy + 9, { width: colW - 16, characterSpacing: 1 });
    doc.fillColor(C.brown).fontSize(11).font('Times-Roman')
       .text(cols[i][1] || '—', cx + 10, cy + 20, { width: colW - 16 });
  }

  const rows = Math.ceil(cols.length / ncols);
  return y + rows * rowH + 14;
}

// ── Tableau financier ─────────────────────────────────────────────────────────
function table(doc, r, y) {
  const W = doc.page.width;
  const x = 40, w = W - 80;

  // En-tête tableau
  doc.rect(x, y, w, 22).fill(C.dark);
  doc.rect(x, y, 3, 22).fill(C.gold);
  doc.fillColor(C.gold).fontSize(7).font('Helvetica-Bold')
     .text('DÉSIGNATION', x + 10, y + 7, { width: w * 0.6, characterSpacing: 2 });
  doc.fillColor(C.gold).fontSize(7).font('Helvetica-Bold')
     .text('MONTANT TTC', x + 10, y + 7, { width: w - 14, align: 'right', characterSpacing: 2 });
  y += 22;

  let alt = false;
  const line = (label, montant, bold = false, isRemise = false) => {
    const bg = alt ? C.cream : C.white;
    const lineH = 26;
    doc.rect(x, y, w, lineH).fillAndStroke(bg, C.border);
    const textColor = isRemise ? C.warm : C.brown;
    doc.fillColor(textColor).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
       .text(label, x + 12, y + 8, { width: w * 0.6 });
    const amtColor = isRemise ? C.warm : (montant < 0 ? C.warm : C.brown);
    doc.fillColor(amtColor).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
       .text(fmtEur(montant), x + 10, y + 8, { width: w - 16, align: 'right' });
    y += lineH;
    alt = !alt;
  };

  line(`Location — ${r.space_label || 'salle'}`, r.prix_base);
  for (const o of (r.options || [])) {
    const q = o.unite === 'par_personne' ? ` (${o.quantite} pers.)` : (o.quantite > 1 ? ` ×${o.quantite}` : '');
    line(`${o.nom}${q}`, o.total);
  }
  if (r.remise_calculee > 0) {
    line(`Remise${r.remise_pct ? ` (${r.remise_pct}%)` : ''}${r.remise_label ? ` — ${r.remise_label}` : ''}`, -r.remise_calculee, false, true);
  }

  // ── Ligne Total (bloc signature visuelle) ─────────────────────────────────
  const totalH = 42;
  doc.rect(x, y, w, totalH).fill(C.dark);
  // Accent or à gauche du total
  doc.rect(x, y, 4, totalH).fill(C.gold);
  // Pastille montant en fond or
  doc.rect(x + w - 185, y + 4, 181, totalH - 8).fillAndStroke(C.gold, C.gold);
  doc.fillColor(C.goldLt).fontSize(8).font('Helvetica-Bold')
     .text('TOTAL NET TTC', x + 14, y + 8, { characterSpacing: 1.5 });
  doc.fillColor('rgba(201,168,76,0.45)').fontSize(7.5).font('Helvetica')
     .text('Toutes taxes comprises', x + 14, y + 22);
  doc.fillColor(C.dark).fontSize(18).font('Times-Bold')
     .text(fmtEur(r.total), x + w - 185, y + 9, { width: 177, align: 'center' });
  y += totalH;

  if (r.acompte_montant > 0) {
    doc.rect(x, y, w, 26).fillAndStroke('#F7F2EA', C.border);
    doc.rect(x, y, 3, 26).fill(C.goldSite);
    doc.fillColor(C.warm).font('Helvetica').fontSize(9.5)
       .text('Acompte à la réservation', x + 12, y + 8);
    doc.fillColor(C.goldSite).font('Helvetica-Bold').fontSize(11)
       .text(fmtEur(r.acompte_montant), x + 10, y + 7, { width: w - 16, align: 'right' });
    y += 26;
  }
  return y + 16;
}

// ── Pied de page ──────────────────────────────────────────────────────────────
function footer(doc, org) {
  const W = doc.page.width, H = doc.page.height;
  // Bande de pied
  doc.rect(0, H - 46, W, 46).fill(C.dark);
  doc.rect(0, H - 46, W, 2).fill(C.gold);
  doc.rect(0, H - 46, 4, 46).fill(C.gold);

  const contact = [org.org_nom, org.org_adresse, org.org_telephone, org.org_email].filter(Boolean).join('   ·   ');
  doc.fillColor('rgba(201,168,76,0.55)').fontSize(8).font('Helvetica')
     .text(contact || '', 16, H - 32, { align: 'center', width: W - 32 });

  const pages = doc.bufferedPageRange ? doc.bufferedPageRange() : null;
  if (pages) {
    doc.fillColor('rgba(201,168,76,0.3)').fontSize(7.5).font('Helvetica')
       .text(`${pages.start + pages.count}`, W - 50, H - 22, { width: 34, align: 'right' });
  }
}

// ── Bloc conditions de règlement ──────────────────────────────────────────────
function conditionsBlock(doc, r, y) {
  const W = doc.page.width;
  const x = 40, w = W - 80;

  doc.rect(x, y, w, 22).fill(C.dark);
  doc.rect(x, y, 3, 22).fill(C.gold);
  doc.fillColor(C.gold).fontSize(7).font('Helvetica-Bold')
     .text('CONDITIONS DE RÈGLEMENT', x + 10, y + 7, { characterSpacing: 2 });
  y += 22;

  const total = r.total || 0;
  const acompte = r.acompte_montant || Math.round(total * 0.3);
  const solde = total - acompte;

  // Ligne acompte
  doc.rect(x, y, w, 34).fillAndStroke(C.cream, C.border);
  doc.rect(x, y, 3, 34).fill(C.goldSite);
  doc.fillColor(C.brown).font('Helvetica-Bold').fontSize(9.5)
     .text('Acompte à la réservation', x + 12, y + 8);
  doc.fillColor(C.green).font('Helvetica-Bold').fontSize(13)
     .text(fmtEur(acompte), x + 12, y + 7, { width: w - 20, align: 'right' });
  doc.fillColor(C.muted).font('Helvetica').fontSize(8)
     .text('À verser à la signature du contrat', x + 12, y + 23);
  y += 34;

  // Ligne solde
  doc.rect(x, y, w, 34).fillAndStroke(C.white, C.border);
  doc.fillColor(C.brown).font('Helvetica-Bold').fontSize(9.5)
     .text('Solde restant dû', x + 12, y + 8);
  doc.fillColor(C.brown).font('Helvetica-Bold').fontSize(13)
     .text(fmtEur(solde), x + 12, y + 7, { width: w - 20, align: 'right' });
  doc.fillColor(C.muted).font('Helvetica').fontSize(8)
     .text('À verser 30 jours avant l\'événement', x + 12, y + 23);
  y += 34;

  // Moyens de paiement
  doc.rect(x, y, w, 22).fillAndStroke('#F0EAE0', C.border);
  doc.fillColor(C.warm).font('Helvetica').fontSize(8.5)
     .text('Moyens de paiement acceptés : Virement bancaire  ·  Chèque bancaire  ·  Espèces', x + 12, y + 7);
  y += 22;

  return y + 12;
}

// ── Encadré validité devis ─────────────────────────────────────────────────────
function validiteBlock(doc, r, y) {
  const W = doc.page.width;
  const x = 40, w = W - 80;
  doc.rect(x, y, w, 48).fillAndStroke(C.cream, C.border);
  doc.rect(x, y, 4, 48).fill(C.goldSite);
  doc.fillColor(C.brown).font('Helvetica-Bold').fontSize(9)
     .text('⏱  Ce devis est valable 15 jours à compter de sa date d\'émission.', x + 14, y + 10, { width: w - 24 });
  doc.fillColor(C.muted).font('Helvetica').fontSize(8.5)
     .text('La réservation sera confirmée à réception de l\'acompte et du contrat signé. ' +
           'Toute annulation devra être notifiée par écrit.', x + 14, y + 24, { width: w - 24 });
  return y + 60;
}

// ── Zone signature devis ───────────────────────────────────────────────────────
function signatureDevisBlock(doc, r, y) {
  const W = doc.page.width;
  const x = 40, w = W - 80;

  doc.rect(x, y, w, 22).fill(C.dark);
  doc.rect(x, y, 3, 22).fill(C.gold);
  doc.fillColor(C.gold).fontSize(7).font('Helvetica-Bold')
     .text('SIGNATURES', x + 10, y + 7, { characterSpacing: 2 });
  y += 22;

  const colW = (w - 12) / 2;
  const sigH = 80;

  // Col gauche — établissement
  doc.rect(x, y, colW, sigH).fillAndStroke(C.cream, C.border);
  doc.rect(x, y, 3, sigH).fill(C.goldSite);
  doc.fillColor(C.brown).font('Helvetica-Bold').fontSize(9)
     .text('Pour l\'établissement', x + 12, y + 12);
  doc.fillColor(C.muted).font('Helvetica').fontSize(8)
     .text(new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }), x + 12, y + 26);
  doc.rect(x + 12, y + sigH - 18, colW - 24, 0.5).fill(C.border);
  doc.fillColor(C.muted).fontSize(7.5).text('Signature et cachet', x + 12, y + sigH - 13, { width: colW - 24, align: 'center' });

  // Col droite — client
  const cx = x + colW + 12;
  doc.rect(cx, y, colW, sigH).fillAndStroke(C.white, C.border);
  doc.fillColor(C.brown).font('Helvetica-Bold').fontSize(9)
     .text('Le client — bon pour accord', cx + 12, y + 12);
  doc.fillColor(C.muted).font('Helvetica').fontSize(8)
     .text('Nom, date et lieu :', cx + 12, y + 26);
  doc.rect(cx + 12, y + sigH - 18, colW - 24, 0.5).fill(C.border);
  doc.fillColor(C.muted).fontSize(7.5).text('Signature précédée de « Lu et approuvé »', cx + 12, y + sigH - 13, { width: colW - 24, align: 'center' });

  return y + sigH + 12;
}

// ── Devis ─────────────────────────────────────────────────────────────────────
function buildDevis(r) {
  const org = getSettings();
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
  const filename = `devis-${r.reference}-${Date.now()}.pdf`;
  const stream = fs.createWriteStream(path.join(uploadDir, filename));
  doc.pipe(stream);

  let y = header(doc, org, 'DEVIS', r.reference);
  y = clientBlock(doc, r, y);
  y += 10;
  y = eventBlock(doc, r, y);
  y += 10;
  y = table(doc, r, y);
  y += 6;
  y = conditionsBlock(doc, r, y);
  y = validiteBlock(doc, r, y);

  // Vérifier si on a encore la place pour la signature (au moins 100px)
  const H = doc.page.height;
  if (y > H - 150) {
    doc.addPage();
    y = 60;
  }
  signatureDevisBlock(doc, r, y);

  footer(doc, org);
  doc.end();
  return new Promise((resolve) => stream.on('finish', () => resolve({ filename })));
}

// ── Contrat ───────────────────────────────────────────────────────────────────
function buildContrat(r) {
  const org = getSettings();
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
  const filename = `contrat-${r.reference}-${Date.now()}.pdf`;
  const stream = fs.createWriteStream(path.join(uploadDir, filename));
  doc.pipe(stream);

  const W = doc.page.width;

  let y = header(doc, org, 'CONTRAT DE LOCATION', r.reference);

  // ── Parties ──────────────────────────────────────────────────────────────
  const partiesY = y;
  // Fond crème sur toute la largeur
  doc.rect(40, partiesY, W - 80, 68).fillAndStroke(C.cream, C.lightLine);
  doc.fillColor(C.navy).fontSize(8).font('Helvetica-Bold').text('ENTRE LES SOUSSIGNÉS', 54, partiesY + 8);
  doc.fillColor(C.dark).font('Helvetica').fontSize(9.5)
     .text(`${org.org_nom || "Salons Beth Menahem - L.I.S"}, représentée par ${org.org_directeur || 'Moché Cohen'}, ci-après dénommée « Le Directeur du salon »`, 54, partiesY + 20, { width: (W - 108) / 2 - 10 });
  doc.fillColor(C.grey).fontSize(8.5)
     .text(`${r.prenom} ${r.nom}${r.adresse ? ', demeurant à ' + r.adresse : ''}, ci-après dénommé(e) « Le Locataire »`, (W / 2) + 10, partiesY + 20, { width: (W - 108) / 2 });
  y = partiesY + 78;

  // ── Sections du contrat ──────────────────────────────────────────────────
  const total = r.total || 0;
  const acompte = r.acompte_montant || 500;
  const solde = total - acompte;
  const dateLimit = r.date_evenement ? (() => {
    const d = new Date(r.date_evenement + 'T12:00:00');
    d.setDate(d.getDate() - 30);
    return d.toLocaleDateString('fr-FR');
  })() : '[Date]';

  // Helper : titre de section
  const sectionTitle = (num, titre, yy) => {
    doc.rect(40, yy, W - 80, 22).fill(C.navy);
    doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(9)
       .text(`${num}. ${titre}`, 52, yy + 6);
    return yy + 22;
  };

  // Helper : paragraphe justifié
  const para = (txt, yy, opts = {}) => {
    doc.fillColor(opts.color || C.dark).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 9)
       .text(txt, 52, yy, { width: W - 104, align: 'justify', ...opts });
    return doc.y + (opts.gap || 6);
  };

  // Helper : puce
  const bullet = (txt, yy) => {
    doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(9).text('•', 52, yy, { continued: false });
    doc.fillColor(C.dark).font('Helvetica').fontSize(9).text(txt, 66, yy, { width: W - 118 });
    return doc.y + 3;
  };

  // Helper : ligne key/value crème
  let altKV = false;
  const kvLine = (label, val, yy) => {
    const bg = altKV ? C.white : C.cream;
    doc.rect(40, yy, W - 80, 22).fillAndStroke(bg, C.lightLine);
    doc.fillColor(C.grey).font('Helvetica-Bold').fontSize(8).text(label, 52, yy + 7, { width: 180 });
    doc.fillColor(C.dark).font('Helvetica').fontSize(9).text(val || '—', 52 + 185, yy + 6, { width: W - 104 - 185 });
    altKV = !altKV;
    return yy + 22;
  };

  // ── 1. Objet ──────────────────────────────────────────────────────────────
  y = sectionTitle('1', 'OBJET DU CONTRAT', y);
  y += 6;
  y = para(`Le présent contrat a pour objet la location de la salle « ${r.space_label || 'Beth Menahem'} », située au ${org.org_adresse || '18, Rue Clément Bayard – 92300 Levallois'}, pour l'événement suivant :`, y);
  y += 4;
  y = kvLine('Type d\'événement', r.type_label || '—', y);
  y = kvLine('Date', fmtDate(r.date_evenement), y);
  y = kvLine('Horaires', r.slot_label || '—', y);
  y = kvLine('Nombre d\'invités', r.nombre_personnes ? `${r.nombre_personnes} personnes` : '—', y);
  y += 10;

  // ── 2. Tarifs ─────────────────────────────────────────────────────────────
  y = sectionTitle('2', 'TARIFS ET CONDITIONS DE PAIEMENT', y);
  y += 6;
  y = kvLine('Montant de la location', fmtEur(total) + ' TTC', y);
  if (r.acompte_montant || true) y = kvLine('Acompte à verser à la signature', fmtEur(acompte), y);
  y = kvLine('Solde à régler au plus tard', `${fmtEur(solde)} — 30 jours avant l'événement (${dateLimit})`, y);
  y = kvLine('Modes de paiement acceptés', 'Espèces · Virement bancaire · Chèque bancaire', y);
  y = kvLine('Chèque de caution', '3 000 € TTC (restitué après visite des locaux par le régisseur)', y);
  y += 10;

  // ── 3. Prestations incluses ───────────────────────────────────────────────
  y = sectionTitle('3', 'PRESTATIONS INCLUSES', y);
  y += 6;
  const prestations = [
    'L\'accès à la salle pour la durée convenue',
    'L\'utilisation des équipements disponibles (tables et chaises)',
    'Le ménage après l\'événement (hors nettoyage de la cuisine)',
    'L\'accès au salon et à l\'office selon modalités convenues avec le régisseur',
  ];
  if (r.options && r.options.length) r.options.forEach(o => prestations.push(o.nom));
  for (const p of prestations) y = bullet(p, y);
  y += 8;

  // ── 4. Règlement intérieur ─────────────────────────────────────────────────
  // Nouvelle page si moins de 180px disponibles
  if (y > doc.page.height - 250) { doc.addPage(); y = 50; }
  y = sectionTitle('4', 'RÈGLEMENT INTÉRIEUR', y);
  y += 6;
  const reglements = [
    'Interdiction de fumer ou d\'utiliser tout appareil à fumée à l\'intérieur.',
    'Respect strict des horaires convenus. Toute heure supplémentaire sera facturée 850 € / heure.',
    'Interdiction de nuisances sonores après 00h15.',
    'Le Locataire est responsable de toute dégradation du matériel ou des locaux.',
    'Le nettoyage de la cuisine est à la charge du traiteur. Les déchets doivent être évacués par ses soins. En cas de non-respect, des frais de 750 € seront appliqués.',
    'Ce salon étant situé au sein d\'une école juive, la Hala\'ha concernant la Mehitsa doit être respectée lors des danses. En cas de non-respect, la musique sera interrompue.',
  ];
  for (const reg of reglements) y = bullet(reg, y);
  y += 8;

  // ── 5. Annulation ─────────────────────────────────────────────────────────
  y = sectionTitle('5', 'ANNULATION ET REMBOURSEMENT', y);
  y += 6;
  y = bullet('Plus de 30 jours avant l\'événement : remboursement intégral de l\'acompte.', y);
  y = bullet('Moins de 30 jours avant l\'événement : aucun remboursement.', y);
  y += 8;

  // ── 6. Responsabilité et assurance ────────────────────────────────────────
  y = sectionTitle('6', 'RESPONSABILITÉ ET ASSURANCE', y);
  y += 6;
  y = para('Le Locataire est seul responsable des dommages causés à la salle ou au matériel.', y);
  y = para('Important : Tous les prestataires doivent fournir leur attestation d\'assurance au régisseur au plus tard 1 semaine avant l\'événement.', y, { color: '#B7410E', bold: true });
  y += 8;

  // ── 7. Résiliation ────────────────────────────────────────────────────────
  y = sectionTitle('7', 'CLAUSE DE RÉSILIATION', y);
  y += 6;
  y = para('En cas de non-respect des clauses du présent contrat, le Bailleur se réserve le droit d\'annuler la location sans remboursement.', y);
  y += 16;

  // ── Signatures ────────────────────────────────────────────────────────────
  if (y > doc.page.height - 160) { doc.addPage(); y = 50; }
  const ville = org.org_ville || 'Levallois';
  const dateSig = new Date().toLocaleDateString('fr-FR');
  doc.rect(40, y, W - 80, 1).fill(C.gold);
  y += 14;
  doc.fillColor(C.grey).font('Helvetica').fontSize(8.5)
     .text(`Fait à ${ville}, le ${dateSig}`, 40, y, { width: W - 80, align: 'center' });
  y += 18;

  const colW = (W - 100) / 2;
  // Colonne gauche
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(9.5).text('Le Directeur du Salon', 40, y);
  doc.fillColor(C.grey).font('Helvetica').fontSize(8.5).text(org.org_directeur || 'Moché Cohen', 40, y + 13);
  doc.rect(40, y + 60, colW, 1).fill(C.navy);
  doc.fillColor(C.grey).fontSize(8).text('Date et Signature', 40, y + 64, { width: colW, align: 'center' });
  // Colonne droite
  const cx = 60 + colW;
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(9.5).text('Le Locataire', cx, y);
  doc.fillColor(C.grey).font('Helvetica').fontSize(8.5).text(`${r.prenom} ${r.nom}`, cx, y + 13);
  doc.rect(cx, y + 60, colW, 1).fill(C.navy);
  doc.fillColor(C.grey).fontSize(8).text('Signature précédée de « Lu et approuvé »', cx, y + 64, { width: colW, align: 'center' });

  footer(doc, org);
  doc.end();
  return new Promise((resolve) => stream.on('finish', () => resolve({ filename })));
}

// ─── REÇU CERFA (don / association) ──────────────────────────────────────────
function buildCerfa(r) {
  const org = getSettings();
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
  const filename = `cerfa-${r.reference}-${Date.now()}.pdf`;
  const stream = fs.createWriteStream(path.join(uploadDir, filename));
  doc.pipe(stream);

  const W = doc.page.width;

  // En-tête navy
  doc.rect(0, 0, W, 100).fill(C.navy);
  doc.rect(0, 97, W, 3).fill(C.gold);
  drawMonogram(doc, 40, 28, 44);
  doc.fillColor(C.gold).fontSize(17).font('Helvetica-Bold')
     .text(org.org_nom || "Salons d'Honneur Beth Menahem", 100, 32, { width: W - 220 });
  const coord = [org.org_adresse, org.org_telephone, org.org_email].filter(Boolean).join('   •   ');
  doc.fillColor(C.goldLt).fontSize(8.5).font('Helvetica').text(coord, 100, 55, { width: W - 220 });
  doc.fillColor(C.goldLt).fontSize(8)
     .text(`SIRET : ${org.org_siret || '_______________'}`, W - 160, 30, { width: 120, align: 'right' });
  if (org.org_rna) doc.text(`RNA : ${org.org_rna}`, W - 160, 42, { width: 120, align: 'right' });

  let y = 120;
  doc.fillColor(C.dark).fontSize(16).font('Helvetica-Bold')
     .text('REÇU FISCAL', 40, y, { align: 'center', width: W - 80 });
  doc.fontSize(9.5).fillColor(C.grey).font('Helvetica')
     .text('(Article 200 du Code général des impôts)', 40, y + 22, { align: 'center', width: W - 80 });
  doc.rect(40, y + 44, W - 80, 1).fill(C.gold);
  y += 56;

  // Donateur
  doc.rect(40, y, W - 80, 72).fillAndStroke(C.cream, C.lightLine);
  doc.fillColor(C.navy).fontSize(8).font('Helvetica-Bold').text('DONATEUR', 54, y + 10);
  doc.fillColor(C.dark).font('Helvetica').fontSize(11)
     .text(`${r.prenom || ''} ${r.nom || ''}`.trim(), 54, y + 22);
  if (r.adresse) doc.fontSize(9).fillColor(C.grey).text(r.adresse, 54, doc.y + 2);
  doc.fontSize(9).fillColor(C.grey)
     .text([r.telephone, r.email].filter(Boolean).join('   •   '), 54, doc.y + 2);
  y += 84;

  // Tableau montants
  const x = 40, w = W - 80;
  const modeLabel = { especes: 'Espèces', cheque: 'Chèque', virement: 'Virement bancaire', cb: 'Carte bancaire', helloasso: 'Paiement en ligne' };

  // Ligne montant — mise en avant
  doc.rect(x, y, w, 40).fill(C.navy);
  doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold').text('MONTANT DU VERSEMENT', x + 12, y + 6);
  doc.fillColor(C.gold).fontSize(20).font('Helvetica-Bold')
     .text(fmtEur(r.montant_cerfa || r.total), x, y + 4, { width: w - 12, align: 'right' });
  y += 40;

  const infoRow = (label, val, altBg) => {
    doc.rect(x, y, w, 28).fillAndStroke(altBg ? C.cream : C.white, C.lightLine);
    doc.fillColor(C.grey).fontSize(8.5).font('Helvetica-Bold').text(label, x + 12, y + 9, { width: w / 2 });
    doc.fillColor(C.dark).font('Helvetica').fontSize(10).text(val || '—', x, y + 8, { width: w - 12, align: 'right' });
    y += 28;
  };
  infoRow('Date du versement', fmtDate(r.date_cerfa || r.date_evenement || new Date().toISOString().slice(0, 10)), false);
  infoRow('Objet / affectation', r.objet_cerfa || getSetting('cerfa_objet', 'Don libre'), true);
  infoRow('Mode de paiement', modeLabel[r.moyen_cerfa] || r.moyen_cerfa || '—', false);
  y += 20;

  // Attestation
  doc.rect(40, y, W - 80, 1).fill(C.lightLine);
  y += 12;
  doc.fillColor(C.dark).font('Helvetica').fontSize(9.5)
     .text(
       `L'association ${org.org_nom || '___'} atteste que le versement de ${fmtEur(r.montant_cerfa || r.total)} effectué par ${r.prenom || ''} ${r.nom || ''} ` +
       `est éligible à la réduction d'impôt prévue à l'article 200 du Code général des impôts, ` +
       `l'association n'accordant aucun avantage en contrepartie de ce don.`,
       40, y, { width: W - 80, align: 'justify' }
     );
  y = doc.y + 36;

  // Signature
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(10)
     .text('Fait à _____________, le ' + new Date().toLocaleDateString('fr-FR'), 40, y)
     .text('Signature et cachet du responsable', W / 2 + 20, y);
  doc.rect(W / 2 + 20, y + 52, 180, 1).fill(C.navy);

  footer(doc, org);
  doc.end();
  return new Promise((resolve) => stream.on('finish', () => resolve({ filename })));
}

module.exports = { buildDevis, buildContrat, buildCerfa };

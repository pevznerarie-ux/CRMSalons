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

// ── Logo / Monogramme ─────────────────────────────────────────────────────────
function drawMonogram(doc, x, y, size = 40) {
  // Cercle or autour du monogramme BM
  doc.circle(x + size / 2, y + size / 2, size / 2).fillAndStroke(C.navy, C.gold);
  doc.fillColor(C.gold).fontSize(size * 0.38).font('Helvetica-Bold')
     .text('BM', x, y + size * 0.3, { width: size, align: 'center' });
}

// ── En-tête ───────────────────────────────────────────────────────────────────
function header(doc, org, titre, ref) {
  const W = doc.page.width;
  // Bande navy pleine hauteur
  doc.rect(0, 0, W, 110).fill(C.navy);
  // Trait or fin en bas de la bande
  doc.rect(0, 107, W, 3).fill(C.gold);

  // Logo à gauche — fond blanc derrière car PNG sur fond blanc
  const logoW = 170, logoH = 65;
  const logoX = 28, logoY = 22;
  if (fs.existsSync(LOGO_PATH)) {
    // Fond blanc arrondi pour isoler le logo sur la bande navy
    doc.roundedRect(logoX - 6, logoY - 4, logoW + 12, logoH + 8, 4).fill(C.white);
    doc.image(LOGO_PATH, logoX, logoY, { width: logoW, height: logoH, fit: [logoW, logoH] });
  } else {
    // Fallback monogramme
    drawMonogram(doc, 38, 30, 48);
    const nom = org.org_nom || "Salons d'Honneur Beth Menahem";
    doc.fillColor(C.gold).fontSize(11).font('Helvetica-Bold').text(nom, 98, 34, { width: W - 240 });
  }

  // Coordonnées sous le logo
  const coord = [org.org_adresse, org.org_telephone, org.org_email].filter(Boolean).join('  ·  ');
  doc.fillColor(C.goldLt).fontSize(7.5).font('Helvetica')
     .text(coord || '', logoX, logoY + logoH + 2, { width: logoW + 60 });

  // Titre du document (côté droit) — aligné à droite
  const titreX = W - 140;
  doc.fillColor(C.white).fontSize(14).font('Helvetica-Bold')
     .text(titre, titreX, 30, { width: 110, align: 'right' });
  doc.fillColor(C.goldLt).fontSize(8.5).font('Helvetica')
     .text(`Réf. ${ref}`, titreX, 54, { width: 110, align: 'right' });
  doc.fillColor(C.goldLt).fontSize(8.5)
     .text(new Date().toLocaleDateString('fr-FR'), titreX, 67, { width: 110, align: 'right' });

  return 128;
}

// ── Bloc client ───────────────────────────────────────────────────────────────
function clientBlock(doc, r, y) {
  const W = doc.page.width;
  // Fond crème doux
  doc.rect(40, y, W / 2 - 55, 80).fillAndStroke(C.cream, C.lightLine);
  // Label section
  doc.fillColor(C.navy).fontSize(8).font('Helvetica-Bold')
     .text('CLIENT', 54, y + 10);
  doc.fillColor(C.dark).font('Helvetica').fontSize(11)
     .text(`${r.prenom} ${r.nom}`, 54, y + 23);
  if (r.societe) doc.fontSize(9.5).fillColor(C.grey).text(r.societe, 54, doc.y + 1);
  if (r.adresse) doc.fontSize(9).fillColor(C.grey).text(r.adresse, 54, doc.y + 1);
  doc.fontSize(9).fillColor(C.grey)
     .text([r.telephone, r.email].filter(Boolean).join('   •   '), 54, doc.y + 1);

  return y + 94;
}

// ── Bloc événement ────────────────────────────────────────────────────────────
function eventBlock(doc, r, y) {
  const W = doc.page.width;
  doc.rect(40, y, W - 80, 28).fill(C.navy);
  doc.fillColor(C.gold).fontSize(9).font('Helvetica-Bold')
     .text('ÉVÉNEMENT', 56, y + 9);

  const cols = [[0, 'Type', r.type_label], [1, 'Date', fmtDate(r.date_evenement)],
                [2, 'Horaire', r.slot_label], [3, 'Salle', r.space_label],
                [4, 'Invités', r.nombre_personnes ? `${r.nombre_personnes} pers.` : '']
               ].filter(c => c[2]);
  const colW = (W - 80) / Math.min(cols.length, 3);

  let yy = y + 28;
  let rowCount = 0;
  const chunk = 3;
  for (let i = 0; i < cols.length; i += chunk) {
    const row = cols.slice(i, i + chunk);
    doc.rect(40, yy, W - 80, 38).fillAndStroke(rowCount % 2 === 0 ? C.cream : C.white, C.lightLine);
    row.forEach(([, label, val], j) => {
      const cx = 40 + j * colW;
      doc.fillColor(C.grey).fontSize(8).font('Helvetica-Bold').text(label.toUpperCase(), cx + 12, yy + 7, { width: colW - 12 });
      doc.fillColor(C.dark).fontSize(10).font('Helvetica').text(val || '—', cx + 12, yy + 18, { width: colW - 20 });
    });
    yy += 38;
    rowCount++;
  }
  return yy + 12;
}

// ── Tableau financier ─────────────────────────────────────────────────────────
function table(doc, r, y) {
  const W = doc.page.width;
  const x = 40, w = W - 80;

  // En-tête du tableau
  doc.rect(x, y, w, 26).fill(C.navy);
  doc.fillColor(C.gold).fontSize(9).font('Helvetica-Bold')
     .text('DÉSIGNATION', x + 12, y + 8, { width: w / 2 })
     .text('MONTANT', x, y + 8, { width: w - 12, align: 'right' });

  let yy = y + 26;
  let alt = false;
  const line = (label, montant, bold, highlight) => {
    const bg = highlight ? '#EBF5EE' : (alt ? C.cream : C.white);
    doc.rect(x, yy, w, 24).fillAndStroke(bg, C.lightLine);
    doc.fillColor(highlight ? C.green : C.dark)
       .font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
       .text(label, x + 12, yy + 7, { width: w - 110 })
       .text(fmtEur(montant), x, yy + 7, { width: w - 12, align: 'right' });
    yy += 24;
    alt = !alt;
  };

  line(`Location — ${r.space_label || 'salle'}`, r.prix_base);
  for (const o of (r.options || [])) {
    const q = o.unite === 'par_personne' ? ` (${o.quantite} pers.)` : (o.quantite > 1 ? ` ×${o.quantite}` : '');
    line(`${o.nom}${q}`, o.total);
  }
  if (r.remise_calculee > 0) {
    line(`Remise${r.remise_pct ? ` (${r.remise_pct}%)` : ''}${r.remise_label ? ` — ${r.remise_label}` : ''}`, -r.remise_calculee, false, false);
  }

  // Ligne Total
  doc.rect(x, yy, w, 34).fillAndStroke(C.navy, C.navy);
  doc.rect(x + w - 200, yy, 200, 34).fill(C.gold);
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(11)
     .text('TOTAL NET', x + 12, yy + 11);
  doc.fillColor(C.navyDk).font('Helvetica-Bold').fontSize(14)
     .text(fmtEur(r.total), x, yy + 9, { width: w - 12, align: 'right' });
  yy += 34;

  if (r.acompte_montant > 0) {
    doc.rect(x, yy, w, 24).fillAndStroke(C.cream, C.lightLine);
    doc.fillColor(C.grey).font('Helvetica').fontSize(9.5)
       .text(`Acompte à verser à la réservation`, x + 12, yy + 7)
       .text(fmtEur(r.acompte_montant), x, yy + 7, { width: w - 12, align: 'right' });
    yy += 24;
  }
  return yy + 16;
}

// ── Pied de page ──────────────────────────────────────────────────────────────
function footer(doc, org) {
  const W = doc.page.width, H = doc.page.height;
  // Trait or en haut du pied
  doc.rect(40, H - 54, W - 80, 1).fill(C.gold);
  const contact = [org.org_nom, org.org_adresse, org.org_telephone, org.org_email].filter(Boolean).join('   •   ');
  doc.fillColor(C.grey).fontSize(8.5).font('Helvetica')
     .text(contact || '', 40, H - 46, { align: 'center', width: W - 80 });
  // Numéro de page
  const pages = doc.bufferedPageRange ? doc.bufferedPageRange() : null;
  if (pages) {
    doc.fillColor(C.creamMd).fontSize(8)
       .text(`Page ${pages.start + pages.count}`, W - 80, H - 46, { width: 40, align: 'right' });
  }
}

// ── Bloc conditions de règlement ──────────────────────────────────────────────
function conditionsBlock(doc, r, y) {
  const W = doc.page.width;
  const x = 40, w = W - 80;

  // Titre section
  doc.rect(x, y, w, 26).fill(C.navy);
  doc.fillColor(C.gold).fontSize(9).font('Helvetica-Bold')
     .text('CONDITIONS DE RÈGLEMENT', x + 12, y + 8);
  y += 26;

  const total = r.total || 0;
  const acompte = r.acompte_montant || Math.round(total * 0.3);
  const solde = total - acompte;

  // Ligne acompte
  doc.rect(x, y, w, 32).fillAndStroke(C.cream, C.lightLine);
  doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(9)
     .text('Acompte à la réservation (30%)', x + 12, y + 8);
  doc.fillColor(C.green).font('Helvetica-Bold').fontSize(12)
     .text(fmtEur(acompte), x, y + 7, { width: w - 12, align: 'right' });
  doc.fillColor(C.grey).font('Helvetica').fontSize(8)
     .text('À verser à la signature du contrat', x + 12, y + 20);
  y += 32;

  // Ligne solde
  doc.rect(x, y, w, 32).fillAndStroke(C.white, C.lightLine);
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(9)
     .text('Solde restant dû', x + 12, y + 8);
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(12)
     .text(fmtEur(solde), x, y + 7, { width: w - 12, align: 'right' });
  doc.fillColor(C.grey).font('Helvetica').fontSize(8)
     .text('À verser 30 jours avant l\'événement', x + 12, y + 20);
  y += 32;

  // Moyens de paiement acceptés
  doc.rect(x, y, w, 24).fillAndStroke(C.creamMd, C.lightLine);
  doc.fillColor(C.grey).font('Helvetica').fontSize(8.5)
     .text('Moyens de paiement acceptés : Virement bancaire · Chèque bancaire · Espèces', x + 12, y + 7);
  y += 24;

  return y + 12;
}

// ── Encadré validité devis ─────────────────────────────────────────────────────
function validiteBlock(doc, r, y) {
  const W = doc.page.width;
  const x = 40, w = W - 80;
  // Fond bleu ciel très léger
  doc.rect(x, y, w, 46).fillAndStroke('#EBF0F8', C.lightLine);
  // Trait gauche bleu
  doc.rect(x, y, 4, 46).fill(C.navy);
  doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(9)
     .text('Ce devis est valable 15 jours à compter de sa date d\'émission.', x + 16, y + 8, { width: w - 24 });
  doc.fillColor(C.grey).font('Helvetica').fontSize(8.5)
     .text('La réservation sera confirmée à réception de l\'acompte et du contrat signé. ' +
           'Toute annulation devra être notifiée par écrit.', x + 16, y + 22, { width: w - 24 });
  return y + 56;
}

// ── Zone signature devis ───────────────────────────────────────────────────────
function signatureDevisBlock(doc, r, y) {
  const W = doc.page.width;
  const x = 40, w = W - 80;
  // Séparateur or
  doc.rect(x, y, w, 1).fill(C.gold);
  y += 16;

  const colW = (w - 20) / 2;

  // Col gauche — prestataire
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(9)
     .text('Pour l\'établissement', x, y);
  doc.fillColor(C.grey).font('Helvetica').fontSize(8.5)
     .text(new Date().toLocaleDateString('fr-FR'), x, y + 14);
  doc.rect(x, y + 56, colW, 1).fill(C.navy);
  doc.fillColor(C.grey).fontSize(8).text('Signature et cachet', x, y + 60, { width: colW, align: 'center' });

  // Col droite — client
  const cx = x + colW + 20;
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(9)
     .text('Le client (bon pour accord)', cx, y);
  doc.fillColor(C.grey).font('Helvetica').fontSize(8.5)
     .text('Nom, date et lieu :', cx, y + 14);
  doc.rect(cx, y + 56, colW, 1).fill(C.navy);
  doc.fillColor(C.grey).fontSize(8).text('Signature précédée de « Lu et approuvé »', cx, y + 60, { width: colW, align: 'center' });

  return y + 80;
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

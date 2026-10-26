// ─── Génération PDF (devis & contrat) ─────────────────────────────────────────
const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');
const { fmtEur, fmtDate, getSetting, getSettings } = require('./lib');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Palette Beth Menahem ──────────────────────────────────────────────────────
const C = {
  navy:    '#1E3A5F',   // bleu marine profond
  navyDk:  '#15283F',   // marine foncé
  gold:    '#C9A84C',   // or signature
  goldLt:  '#E8D08A',   // or clair
  cream:   '#F8F4EE',   // crème très doux
  creamMd: '#EDE8DF',   // crème moyen
  dark:    '#1A202C',   // texte principal
  grey:    '#718096',   // texte secondaire
  lightLine:'#E8E0D0',  // séparateurs
  green:   '#276749',   // total / montants
  white:   '#FFFFFF',
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
  doc.rect(0, 0, W, 100).fill(C.navy);
  // Trait or fin en bas de la bande
  doc.rect(0, 97, W, 3).fill(C.gold);

  // Monogramme
  drawMonogram(doc, 38, 26, 48);

  // Nom de l'établissement — zone strictement délimitée entre monogramme et bloc titre
  const nomX = 98, nomW = W - 98 - 140; // laisser 140px pour le titre à droite
  const nom = org.org_nom || "Salons d'Honneur Beth Menahem";
  doc.fillColor(C.gold).fontSize(13).font('Helvetica-Bold')
     .text(nom, nomX, 30, { width: nomW, lineGap: 1 });

  // Coordonnées en blanc petit — juste après le nom
  const coord = [org.org_adresse, org.org_telephone, org.org_email].filter(Boolean).join('  ·  ');
  doc.fillColor(C.goldLt).fontSize(8).font('Helvetica')
     .text(coord || '', nomX, 66, { width: nomW });

  // Titre du document (côté droit) — aligné à droite, zone fixe
  const titreX = W - 130;
  doc.fillColor(C.white).fontSize(13).font('Helvetica-Bold')
     .text(titre, titreX, 28, { width: 100, align: 'right' });
  doc.fillColor(C.goldLt).fontSize(8.5).font('Helvetica')
     .text(`Réf. ${ref}`, titreX, 50, { width: 100, align: 'right' });
  doc.fillColor(C.goldLt).fontSize(8.5)
     .text(new Date().toLocaleDateString('fr-FR'), titreX, 63, { width: 100, align: 'right' });

  return 120;
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

  // Note de bas de devis
  doc.rect(40, y, doc.page.width - 80, 1).fill(C.lightLine);
  y += 10;
  doc.fillColor(C.grey).font('Helvetica').fontSize(8.5)
     .text('Devis valable 15 jours. La réservation est ferme à réception de l\'acompte et du contrat signé.', 40, y, { width: doc.page.width - 80 });

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

  let y = header(doc, org, 'CONTRAT DE LOCATION', r.reference);
  y = clientBlock(doc, r, y);
  y += 10;
  y = eventBlock(doc, r, y);
  y += 10;
  y = table(doc, r, y);

  // Conditions générales
  const W = doc.page.width;
  doc.fillColor(C.navy).fontSize(10).font('Helvetica-Bold').text('CONDITIONS GÉNÉRALES', 40, y);
  y += 16;
  doc.rect(40, y, W - 80, 1).fill(C.gold);
  y += 8;
  doc.fillColor('#444').font('Helvetica').fontSize(8.5)
     .text(org.cgv || 'Conditions générales à compléter dans les Paramètres.', 40, y, { width: W - 80, align: 'justify' });

  // Signatures
  const ySign = Math.max(doc.y + 36, 680);
  doc.rect(40, ySign, W - 80, 1).fill(C.lightLine);
  const signY = ySign + 12;
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(10)
     .text('Le prestataire', 40, signY)
     .text('Le client (lu et approuvé)', W / 2 + 20, signY);
  doc.rect(40, signY + 52, 180, 1).fill(C.navy);
  doc.rect(W / 2 + 20, signY + 52, 180, 1).fill(C.navy);
  doc.fillColor(C.grey).fontSize(8)
     .text('Signature', 40, signY + 56, { width: 180, align: 'center' })
     .text('Signature + mention « Lu et approuvé »', W / 2 + 20, signY + 56, { width: 180, align: 'center' });

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

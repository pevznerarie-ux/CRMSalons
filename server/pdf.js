// ─── Génération PDF (devis & contrat) ─────────────────────────────────────────
const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');
const { fmtEur, fmtDate, getSettings } = require('./lib');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const NAVY = '#1E3A5F', GOLD = '#C9A84C', GREY = '#718096', DARK = '#1A202C';

function header(doc, org, titre, ref) {
  doc.rect(0, 0, doc.page.width, 90).fill(NAVY);
  doc.fillColor(GOLD).fontSize(20).font('Helvetica-Bold').text(org.org_nom || 'Salons d\'Honneur', 50, 28);
  doc.fillColor('#fff').fontSize(10).font('Helvetica')
     .text([org.org_adresse, org.org_telephone, org.org_email].filter(Boolean).join('  •  '), 50, 56);
  doc.fillColor(DARK).fontSize(22).font('Helvetica-Bold').text(titre, 50, 115);
  doc.fontSize(11).fillColor(GREY).font('Helvetica').text(`Référence : ${ref}`, 50, 145);
  doc.fillColor(GREY).text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 0, 145, { align: 'right' });
  doc.moveTo(50, 168).lineTo(doc.page.width - 50, 168).strokeColor('#E2E8F0').stroke();
  return 185;
}

function clientBlock(doc, r, y) {
  doc.fontSize(11).fillColor(GREY).font('Helvetica-Bold').text('CLIENT', 50, y);
  doc.fillColor(DARK).font('Helvetica').fontSize(12)
     .text(`${r.prenom} ${r.nom}`, 50, y + 16);
  if (r.societe)   doc.fontSize(10).fillColor(GREY).text(r.societe, 50, doc.y);
  if (r.adresse)   doc.fontSize(10).fillColor(GREY).text(r.adresse, 50, doc.y);
  doc.fontSize(10).fillColor(GREY).text([r.telephone, r.email].filter(Boolean).join('  •  '), 50, doc.y);
  return doc.y + 18;
}

function eventBlock(doc, r, y) {
  doc.fontSize(11).fillColor(GREY).font('Helvetica-Bold').text('ÉVÉNEMENT', 50, y);
  const lines = [
    ['Type', r.type_label], ['Date', fmtDate(r.date_evenement)],
    ['Horaire', r.slot_label], ['Salle', r.space_label],
    ['Invités', r.nombre_personnes ? `${r.nombre_personnes} personnes` : ''],
  ].filter(l => l[1]);
  let yy = y + 16;
  doc.fontSize(11).font('Helvetica');
  for (const [k, v] of lines) {
    doc.fillColor(GREY).text(`${k} :`, 50, yy, { continued: true, width: 200 }).fillColor(DARK).text(`  ${v}`);
    yy = doc.y + 2;
  }
  return yy + 14;
}

// Tableau des lignes financières
function table(doc, r, y) {
  const x = 50, w = doc.page.width - 100;
  doc.rect(x, y, w, 24).fill(NAVY);
  doc.fillColor('#fff').fontSize(10).font('Helvetica-Bold')
     .text('DÉSIGNATION', x + 12, y + 7)
     .text('MONTANT', x, y + 7, { width: w - 12, align: 'right' });
  let yy = y + 24;
  const line = (label, montant, bold) => {
    doc.rect(x, yy, w, 22).fillAndStroke('#fff', '#E2E8F0');
    doc.fillColor(DARK).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
       .text(label, x + 12, yy + 6, { width: w - 110 })
       .text(fmtEur(montant), x, yy + 6, { width: w - 12, align: 'right' });
    yy += 22;
  };
  line(`Location — ${r.space_label || 'salle'}`, r.prix_base);
  for (const o of (r.options || [])) {
    const q = o.unite === 'par_personne' ? ` (${o.quantite} pers.)` : (o.quantite > 1 ? ` ×${o.quantite}` : '');
    line(`${o.nom}${q}`, o.total);
  }
  if (r.remise_calculee > 0) line(`Remise${r.remise_pct ? ` (${r.remise_pct}%)` : ''}`, -r.remise_calculee);
  // Total
  doc.rect(x, yy, w, 30).fill('#F0FFF4');
  doc.fillColor('#276749').font('Helvetica-Bold').fontSize(13)
     .text('TOTAL', x + 12, yy + 8)
     .text(fmtEur(r.total), x, yy + 8, { width: w - 12, align: 'right' });
  yy += 30;
  if (r.acompte_montant > 0) {
    doc.fillColor(GREY).font('Helvetica').fontSize(10)
       .text(`Acompte à verser : ${fmtEur(r.acompte_montant)}`, x + 12, yy + 8);
    yy += 22;
  }
  return yy + 16;
}

function buildDevis(r) {
  const org = getSettings();
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const filename = `devis-${r.reference}-${Date.now()}.pdf`;
  const stream = fs.createWriteStream(path.join(uploadDir, filename));
  doc.pipe(stream);

  let y = header(doc, org, 'DEVIS', r.reference);
  y = clientBlock(doc, r, y);
  y = eventBlock(doc, r, y);
  y = table(doc, r, y);
  doc.fontSize(9).fillColor(GREY).font('Helvetica')
     .text('Devis valable 15 jours. La réservation est ferme à réception de l\'acompte et du contrat signé.', 50, y, { width: doc.page.width - 100 });
  doc.end();
  return new Promise((resolve) => stream.on('finish', () => resolve({ filename })));
}

function buildContrat(r) {
  const org = getSettings();
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const filename = `contrat-${r.reference}-${Date.now()}.pdf`;
  const stream = fs.createWriteStream(path.join(uploadDir, filename));
  doc.pipe(stream);

  let y = header(doc, org, 'CONTRAT DE LOCATION', r.reference);
  y = clientBlock(doc, r, y);
  y = eventBlock(doc, r, y);
  y = table(doc, r, y);

  doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold').text('Conditions générales', 50, y);
  doc.moveDown(0.3).fontSize(9).fillColor('#444').font('Helvetica')
     .text(org.cgv || 'Conditions générales à compléter dans les Paramètres.', { width: doc.page.width - 100, align: 'justify' });

  const ySign = Math.max(doc.y + 40, 680);
  doc.fontSize(10).fillColor(DARK).font('Helvetica')
     .text('Le prestataire', 50, ySign)
     .text('Le client (lu et approuvé)', 320, ySign);
  doc.moveTo(50, ySign + 55).lineTo(240, ySign + 55).strokeColor('#999').stroke();
  doc.moveTo(320, ySign + 55).lineTo(510, ySign + 55).strokeColor('#999').stroke();
  doc.end();
  return new Promise((resolve) => stream.on('finish', () => resolve({ filename })));
}

module.exports = { buildDevis, buildContrat };

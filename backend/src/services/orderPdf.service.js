/**
 * Geração de PDF de Ordem de Serviço — segue o modelo oficial da SEMEC.
 *
 * Layout enxuto: título, "Informações da Solicitação", "Detalhes do Serviço",
 * "Serviço Realizado" e assinaturas (Requerente / Técnico Responsável).
 * Cabeçalho e rodapé oficiais aplicados em todas as páginas.
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const HEADER_IMG = path.join(ASSETS_DIR, 'term-header.png');
const FOOTER_IMG = path.join(ASSETS_DIR, 'term-footer.png');

// ===== aplica cabeçalho e rodapé em toda página =====
function paintHeaderFooter(doc) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const margin = 40;
  const contentW = pageW - margin * 2;
  doc.save();
  if (fs.existsSync(HEADER_IMG)) {
    const h = contentW * (141 / 944); // mantém a proporção
    doc.image(HEADER_IMG, margin, 20, { width: contentW, height: h });
  }
  if (fs.existsSync(FOOTER_IMG)) {
    const h = contentW * (133 / 946);
    doc.image(FOOTER_IMG, margin, pageH - h - 15, { width: contentW, height: h });
  }
  doc.restore();
}

/**
 * Pega só o número limpo da O.S. (ex.: "OS-2025-00037" → "37").
 */
function shortNumber(fullNumber = '') {
  const m = String(fullNumber).match(/(\d+)$/);
  if (!m) return fullNumber;
  // remove zeros à esquerda
  return String(parseInt(m[1], 10));
}

function buildOrderPdf(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 130, bottom: 100, left: 60, right: 60 },
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.on('pageAdded', () => paintHeaderFooter(doc));
      paintHeaderFooter(doc);

      const contentW = doc.page.width - 120;
      const numShort = shortNumber(order.number);

      // ===== Título =====
      doc.font('Helvetica-Bold').fontSize(15).fillColor('#000')
        .text(`Ordem de Serviço Nº: ${numShort}`, 60, doc.y, { align: 'center', width: contentW });

      doc.moveDown(1.2);

      // ===== Seção 1: Informações da Solicitação =====
      sectionTitle(doc, 'Informações da Solicitação');
      labelValue(doc, 'Local', (order.school?.name || '—').toUpperCase());
      labelValue(doc, 'Requerente', order.requesterName || '—');

      doc.moveDown(0.8);

      // ===== Seção 2: Detalhes do Serviço =====
      sectionTitle(doc, 'Detalhes do Serviço');
      paragraph(doc, order.problemReported || '—');

      doc.moveDown(0.8);

      // ===== Seção 3: Serviço Realizado =====
      sectionTitle(doc, 'Serviço Realizado');
      paragraph(doc, order.serviceDone || order.diagnosis || '—');

      // ===== Equipe técnica (só se houver auxiliares) =====
      if (order.helpers && order.helpers.length > 0) {
        doc.moveDown(0.8);
        sectionTitle(doc, 'Equipe Técnica');
        const tecPrincipal = order.technician?.name || '—';
        const aux = order.helpers.map(h => h.name).filter(Boolean).join(', ');
        labelValue(doc, 'Responsável', tecPrincipal);
        labelValue(doc, 'Auxiliar(es)', aux || '—');
      }

      // ===== Assinaturas =====
      // Garante que ficarão no fim da área útil
      const minY = doc.page.height - 200;
      if (doc.y < minY) doc.y = minY;

      const sigLineY = doc.y + 20;
      const colW = 200;
      const leftX = 70;
      const rightX = doc.page.width - 70 - colW;

      // Nomes acima da linha (estilo do modelo: SEMEC / nome do técnico)
      doc.font('Helvetica').fontSize(11).fillColor('#000');
      doc.text('SEMEC', leftX, sigLineY - 16, { width: colW, align: 'center' });
      doc.text(order.technician?.name || '—', rightX, sigLineY - 16, { width: colW, align: 'center' });

      // Linhas
      doc.moveTo(leftX, sigLineY).lineTo(leftX + colW, sigLineY).strokeColor('#000').lineWidth(0.6).stroke();
      doc.moveTo(rightX, sigLineY).lineTo(rightX + colW, sigLineY).stroke();

      // Legendas
      doc.font('Helvetica').fontSize(10).fillColor('#000');
      doc.text('Assinatura do Requerente', leftX, sigLineY + 6, { width: colW, align: 'center' });
      doc.text('Assinatura do Técnico Responsável', rightX, sigLineY + 6, { width: colW, align: 'center' });

      doc.end();
    } catch (e) { reject(e); }
  });
}

// ===== helpers de layout =====
function sectionTitle(doc, text) {
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
    .text(text, 60, doc.y, { width: doc.page.width - 120 });
  doc.moveDown(0.35);
}

function labelValue(doc, label, value) {
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000')
    .text(`${label}: `, 60, y, { continued: true });
  doc.font('Helvetica').fontSize(11).fillColor('#000')
    .text(String(value || '—'));
}

function paragraph(doc, text) {
  doc.font('Helvetica').fontSize(11).fillColor('#000')
    .text(String(text), 60, doc.y, {
      width: doc.page.width - 120,
      align: 'justify',
    });
}

module.exports = { buildOrderPdf };

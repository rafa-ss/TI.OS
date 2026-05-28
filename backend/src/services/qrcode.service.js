const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

/**
 * Gera um QR code data-url (base64 PNG) para um equipamento.
 * payload contém URL pública / patrimônio.
 */
async function generateEquipmentQR(equipment, baseUrl = '') {
  const payload = JSON.stringify({
    type: 'equipment',
    patrimonio: equipment.patrimonio,
    id: equipment._id?.toString(),
    url: `${baseUrl}/equipamentos/${equipment._id}`,
  });
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
  });
  return { payload, dataUrl };
}

/**
 * Gera um PDF A4 com folha de etiquetas (3 colunas x 8 linhas = 24 por página).
 * Cada etiqueta contém: QR + patrimônio + tipo + marca/modelo.
 */
async function buildLabelsPdf(equipments, baseUrl = '') {
  const doc = new PDFDocument({ size: 'A4', margin: 20 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const cols = 3;
  const rows = 8;
  const pageW = doc.page.width - 40; // margens
  const pageH = doc.page.height - 40;
  const cellW = pageW / cols;
  const cellH = pageH / rows;

  let i = 0;
  for (const eq of equipments) {
    if (i > 0 && i % (cols * rows) === 0) doc.addPage();
    const idx = i % (cols * rows);
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = 20 + col * cellW;
    const y = 20 + row * cellH;

    const { dataUrl } = await generateEquipmentQR(eq, baseUrl);
    const imgBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const imgBuf = Buffer.from(imgBase64, 'base64');

    // Borda da etiqueta
    doc
      .roundedRect(x + 4, y + 4, cellW - 8, cellH - 8, 6)
      .strokeColor('#cbd5e1')
      .lineWidth(0.5)
      .stroke();

    const qrSize = Math.min(cellH - 30, 80);
    doc.image(imgBuf, x + 10, y + 10, { width: qrSize, height: qrSize });

    const textX = x + qrSize + 16;
    const textW = cellW - qrSize - 24;

    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('SEMED Abaetetuba', textX, y + 10, { width: textW });

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#1d4ed8')
      .text(`Pat.: ${eq.patrimonio}`, textX, y + 24, { width: textW });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#475569')
      .text(`${eq.type || ''}`.toUpperCase(), textX, y + 40, { width: textW });

    const brandModel = [eq.brand, eq.model].filter(Boolean).join(' ');
    if (brandModel) {
      doc.text(brandModel, textX, y + 52, { width: textW, ellipsis: true });
    }
    if (eq.serialNumber) {
      doc.fontSize(7).text(`S/N: ${eq.serialNumber}`, textX, y + 64, { width: textW });
    }

    i++;
  }

  doc.end();
  return await new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

module.exports = { generateEquipmentQR, buildLabelsPdf };

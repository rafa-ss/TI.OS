const PDFDocument = require('pdfkit');

const TYPE_LABEL = {
  computador: 'Computador',
 // notebook: 'Notebook',
  impressora: 'Impressora',
  roteador: 'Roteador',
  nobreak: 'Nobreak',
  tablet: 'Tablet',
  outro: 'Outro',
};

/**
 * Gera Termo de Entrega/Transferência em PDF (A4).
 * Recebe equipamento populado + dados da movimentação.
 */
function buildDeliveryTermPdf({ equipment, movement }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Cabeçalho
      doc
        .fillColor('#0f172a')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('PREFEITURA MUNICIPAL DE ABAETETUBA', { align: 'center' });
      doc
        .fontSize(11)
        .text('SECRETARIA MUNICIPAL DE EDUCAÇÃO', { align: 'center' });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#475569')
        .text('Coordenadoria de Tecnologia da Informação', { align: 'center' });

      doc.moveDown(1);
      doc
        .moveTo(50, doc.y).lineTo(545, doc.y)
        .strokeColor('#1d4ed8').lineWidth(1).stroke();

      doc.moveDown(0.8);
      const isReturn = movement.type === 'devolucao';
      const title = isReturn
        ? 'TERMO DE DEVOLUÇÃO DE EQUIPAMENTO'
        : movement.type === 'transferencia'
          ? 'TERMO DE TRANSFERÊNCIA DE EQUIPAMENTO'
          : 'TERMO DE ENTREGA DE EQUIPAMENTO';

      doc
        .fillColor('#0f172a')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(title, { align: 'center' });

      const docNum = movement.deliveryDocNumber || `TE-${Date.now()}`;
      doc
        .moveDown(0.3)
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#475569')
        .text(`Documento nº ${docNum}  |  Emitido em ${new Date(movement.date || Date.now()).toLocaleString('pt-BR')}`, { align: 'center' });

      // Bloco origem/destino
      doc.moveDown(1.2);
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('1. ORIGEM E DESTINO');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10).fillColor('#1e293b');

      const fromTxt = movement.fromSchool?.name
        ? `${movement.fromSchool.name} (INEP ${movement.fromSchool.inep || '-'})`
        : (movement.fromLocation || 'Almoxarifado / semec');
      const toTxt = movement.toSchool?.name
        ? `${movement.toSchool.name} (INEP ${movement.toSchool.inep || '-'})`
        : (movement.toLocation || '—');

      doc.text(`Origem: ${fromTxt}`);
      doc.text(`Destino: ${toTxt}`);

      // Bloco equipamento
      doc.moveDown(1);
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('2. EQUIPAMENTO');
      doc.moveDown(0.3);

      const rows = [
        ['Patrimônio', equipment.patrimonio],
        ['Tipo', TYPE_LABEL[equipment.type] || equipment.type],
        ['Marca / Modelo', [equipment.brand, equipment.model].filter(Boolean).join(' ') || '-'],
        ['Nº de série', equipment.serialNumber || '-'],
        ['Nota fiscal', equipment.invoice || '-'],
        ['Status atual', equipment.status],
      ];

      const tableX = 50;
      const colA = 130;
      const colB = 365;
      let yT = doc.y + 4;
      doc.lineWidth(0.4).strokeColor('#cbd5e1');

      rows.forEach(([k, v], idx) => {
        const rowH = 22;
        if (idx % 2 === 0) {
          doc.fillColor('#f1f5f9').rect(tableX, yT, colA + colB, rowH).fill();
        }
        doc.fillColor('#475569').font('Helvetica-Bold').fontSize(9)
          .text(k, tableX + 8, yT + 7, { width: colA - 12 });
        doc.fillColor('#0f172a').font('Helvetica').fontSize(10)
          .text(String(v || '-'), tableX + colA, yT + 6, { width: colB - 12 });
        yT += rowH;
      });
      doc.rect(tableX, doc.y + 4 - (rows.length * 22), colA + colB, rows.length * 22).stroke();
      doc.y = yT + 8;

      // Bloco responsabilidade
      doc.moveDown(0.6);
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('3. RESPONSABILIDADE');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10).fillColor('#1e293b').text(
        isReturn
          ? `Pelo presente termo, o(a) servidor(a) abaixo identificado(a) DEVOLVE o equipamento à equipe de T.I. da semec Abaetetuba, atestando seu estado de conservação no momento da devolução.`
          : `Pelo presente termo, o(a) responsável abaixo identificado(a) RECEBE o equipamento acima descrito, comprometendo-se a zelar por sua guarda, conservação e uso adequado, bem como a comunicar imediatamente à equipe de T.I. da semec qualquer dano, extravio ou necessidade de manutenção.`,
        { align: 'justify' }
      );

      if (movement.notes) {
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(10).text('Observações:');
        doc.font('Helvetica').fontSize(10).text(movement.notes, { align: 'justify' });
      }

      // Recebedor
      doc.moveDown(1.2);
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('4. IDENTIFICAÇÃO DO RECEBEDOR');
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(10).fillColor('#1e293b');
      doc.text(`Nome: ${movement.receiverName || '____________________________________________________'}`);
      doc.text(`Cargo/Função: ${movement.receiverRole || '________________________________________________'}`);
      doc.text(`CPF: ${movement.receiverCpf || '_______________________'}`);

      // Assinaturas
      doc.moveDown(3);
      const sigY = doc.y;
      doc.moveTo(70, sigY).lineTo(265, sigY).stroke();
      doc.moveTo(330, sigY).lineTo(525, sigY).stroke();
      doc.fontSize(9).fillColor('#475569')
        .text('Recebedor', 70, sigY + 5, { width: 195, align: 'center' })
        .text('Responsável T.I. / semec', 330, sigY + 5, { width: 195, align: 'center' });

      doc.moveDown(4);
      doc.fontSize(8).fillColor('#94a3b8')
        .text(`Abaetetuba/PA, ${new Date().toLocaleDateString('pt-BR')} — Documento gerado eletronicamente pelo Sistema de O.S. da semec.`, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildDeliveryTermPdf };

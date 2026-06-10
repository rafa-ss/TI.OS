/**
 * Geração do "Termo de Entrega de Laboratório de Informática"
 * baseado no modelo oficial da SEMEC/CTEC Abaetetuba.
 *
 * Inclui cabeçalho e rodapé oficiais (imagens) em todas as páginas,
 * tanto no PDF quanto no Word.
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer,
  Table, TableRow, TableCell, WidthType, ShadingType, ImageRun,
} = require('docx');
const Laboratory = require('../models/Laboratory');
const { generateTermNumber } = require('./termNumber.service');

// ====================================================================
// Imagens do modelo oficial (cabeçalho e rodapé)
// ====================================================================
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const HEADER_IMG = path.join(ASSETS_DIR, 'term-header.png');
const FOOTER_IMG = path.join(ASSETS_DIR, 'term-footer.png');

function loadImage(filePath) {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  } catch { return null; }
}

const EQUIPMENT_LABEL = {
  computador: 'Computadores (Placa-mãe DDR3, 8Gb, SSD240GB)',
  // notebook: 'Notebooks',
  impressora: 'Impressoras',
  roteador: 'Roteadores',
  nobreak: 'Nobreaks',
  estabilizador: 'Estabilizadores',
  tablet: 'Tablets',
  mouse: 'Mouses',
  teclado: 'Teclados',
  monitor: 'Monitores',
  memoria_ram: 'Memórias RAM',
  fonte: 'Fontes',
  //caixa_cabo_rj45: 'Caixas de cabo RJ45',
  outro: 'Outros',
};

// Para tipos customizados não mapeados, formata "memoria_ram" → "Memória ram"
function prettyType(t) {
  if (!t) return '-';
  if (EQUIPMENT_LABEL[t]) return EQUIPMENT_LABEL[t];
  const s = String(t).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1) + 's';
}

const CONDITION_LABEL = {
  novo: 'Novo',
  usado: 'Usado',
  recondicionado: 'Recondicionado',
};

function kindLabel(kind) {
  return kind === 'administrativo' ? 'Setor Administrativo' : 'Laboratório de Informática';
}

function formatDateBR(date = new Date()) {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const d = new Date(date);
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

async function ensureTermNumber(lab) {
  if (lab.deliveryTermNumber) return lab.deliveryTermNumber;
  // Geração 100% automática, atômica e anti-duplicidade (ano atual).
  lab.deliveryTermNumber = await generateTermNumber();
  await lab.save();
  return lab.deliveryTermNumber;
}

async function loadLabData(labId) {
  const lab = await Laboratory.findById(labId).populate('school', 'name inep municipio');
  if (!lab) throw new Error('Laboratório não encontrado');
  await ensureTermNumber(lab);
  const items = (lab.equipments || []).map((eq) => ({
    qty: eq.quantity,
    description: prettyType(eq.type),
    situation: CONDITION_LABEL[eq.condition] || 'Novo',
  }));
  return { lab, items };
}

// ====================================================================
// Conteúdo textual (fiel ao modelo)
// ====================================================================
const HEADER_FROM = 'Da: Coordenação de Tecnologia Educacional SEMEC';
const INTRO = `Recebi Da Secretaria Municipal De Educação de Abaetetuba/ Coordenação de Tecnologia Educacional, CNPJ: 21.763.283/0001-01, os itens abaixo especificados(s).`;
const POST_TABLE = `Os itens mencionados acima foram entregues novos em perfeitas condições e estão sendo recebidos pela instituição, comprometendo-se a sua guarda, conservação e utilização conforme a finalidade prevista.

Para garantir o uso eficiente e a preservação desses recursos, bem como a conformidade com as diretrizes da Secretaria Municipal de Educação (SME), solicitamos a atenção e o cumprimento das seguintes orientações:`;

const SECTIONS = [
  {
    title: '1. Realocação de Equipamentos',
    body: 'Os equipamentos do laboratório de informática (computadores, teclados, mouses, estabilizadores etc.) são de responsabilidade da Escola e foram destinados especificamente para este espaço. É expressamente proibida a realocação, empréstimo ou remoção desses equipamentos para outras dependências da escola ou fora dela sem a prévia e formal autorização da Secretaria Municipal de Educação. Qualquer necessidade de mudança deve ser comunicada e solicitada.',
  },
  {
    title: '2. Sistema Operacional e Programas',
    body: 'O sistema operacional e os softwares instalados nos computadores do laboratório foram padronizados e configurados de acordo com as orientações da Secretaria Municipal de Educação. Não é permitida a modificação do sistema operacional ou a instalação de programas que não sejam expressamente autorizados e orientados pela Secretaria Municipal de Educação. Essa medida visa garantir a segurança dos dados, a estabilidade do sistema e a uniformidade no ambiente de aprendizagem em toda a rede.',
  },
  {
    title: '3. Manutenção e Cuidados',
    body: 'Contamos com a colaboração de todos para a manutenção e conservação dos equipamentos. Pedimos que as boas práticas de uso sejam sempre incentivadas entre os alunos, como:',
    bullets: [
      'Utilizar os equipamentos com cuidado e responsabilidade.',
      'Evitar o consumo de alimentos e bebidas próximo aos computadores.',
      'Informar imediatamente Secretaria Municipal de Educação qualquer problema ou dano nos equipamentos.',
    ],
  },
];

const CLOSING = `A conscientização e o cumprimento destas diretrizes são fundamentais para que possamos usufruir ao máximo dos benefícios que este novo laboratório oferece. Agradecemos a colaboração de todos para que o ambiente seja sempre produtivo e em conformidade com as normas estabelecidas.`;

// ====================================================================
// GERADOR PDF (PDFKit) — com header/footer em todas as páginas
// ====================================================================

/**
 * Aplica o cabeçalho e o rodapé em TODAS as páginas (incluindo as novas
 * geradas automaticamente pelo PDFKit quando o conteúdo passa o limite).
 */
function paintHeaderFooter(doc) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const margin = 40;
  const contentW = pageW - margin * 2;

  // Salva o estado atual de fluxo de texto
  doc.save();

  // Cabeçalho
  if (fs.existsSync(HEADER_IMG)) {
    // proporção original 944x141 → ratio = 141/944 = ~0.149
    const headerH = contentW * (141 / 944);
    doc.image(HEADER_IMG, margin, 20, { width: contentW, height: headerH });
  }

  // Rodapé
  if (fs.existsSync(FOOTER_IMG)) {
    const footerH = contentW * (133 / 946);
    doc.image(FOOTER_IMG, margin, pageH - footerH - 15, { width: contentW, height: footerH });
  }

  doc.restore();
}

function buildPdf(labId) {
  return new Promise(async (resolve, reject) => {
    try {
      const { lab, items } = await loadLabData(labId);

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 110, bottom: 100, left: 50, right: 50 }, // margens p/ caber cabeçalho e rodapé
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Aplica cabeçalho/rodapé na primeira página e em toda nova página
      doc.on('pageAdded', () => paintHeaderFooter(doc));
      paintHeaderFooter(doc);

      const pageW = doc.page.width;
      const contentW = pageW - 100; // margens left/right

      // ============ Número do termo + data ============
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
      const titleY = doc.y;
      doc.text(`Termo de Entrega n° ${lab.deliveryTermNumber} — ${kindLabel(lab.kind)}`, 50, titleY);
      doc.font('Helvetica').text(
        `Abaetetuba, ${formatDateBR(lab.assemblyDate || new Date())}.`,
        50, titleY, { width: contentW, align: 'right' }
      );
      doc.y = titleY + 18;

      // ============ De / Para ============
      doc.font('Helvetica').fontSize(10);
      doc.text(HEADER_FROM, 50, doc.y, { width: contentW });
      doc.text(
        `Para: ${(lab.school?.name || '—').toUpperCase()}${lab.school?.inep ? '-' + lab.school.inep : ''}`,
        50, doc.y, { width: contentW }
      );
      doc.moveDown(0.6);

      // ============ Introdução ============
      doc.text(INTRO, 50, doc.y, { align: 'justify', width: contentW });
      doc.moveDown(0.5);

      // ============ Tabela ============
      doc.font('Helvetica-Bold').text('Itens Entregues', 50, doc.y, { width: contentW, align: 'center' });
      doc.moveDown(0.3);

      const tableX = 50;
      const tableW = contentW;
      const colW = [80, tableW - 80 - 110, 110];
      let y = doc.y;

      // Header da tabela
      doc.lineWidth(0.6).strokeColor('#0f172a');
      doc.rect(tableX, y, colW[0], 22).fillAndStroke('#e2e8f0', '#0f172a');
      doc.rect(tableX + colW[0], y, colW[1], 22).fillAndStroke('#e2e8f0', '#0f172a');
      doc.rect(tableX + colW[0] + colW[1], y, colW[2], 22).fillAndStroke('#e2e8f0', '#0f172a');
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10);
      doc.text('Quantitativo', tableX + 4, y + 6, { width: colW[0] - 8, align: 'center' });
      doc.text('Descrição', tableX + colW[0] + 4, y + 6, { width: colW[1] - 8, align: 'center' });
      doc.text('Situação', tableX + colW[0] + colW[1] + 4, y + 6, { width: colW[2] - 8, align: 'center' });
      y += 22;

      doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
      const rows = items.length > 0 ? items : [{ qty: '', description: '(sem itens cadastrados)', situation: '' }];
      for (const it of rows) {
        doc.rect(tableX, y, colW[0], 22).stroke();
        doc.rect(tableX + colW[0], y, colW[1], 22).stroke();
        doc.rect(tableX + colW[0] + colW[1], y, colW[2], 22).stroke();
        doc.text(String(it.qty), tableX + 4, y + 6, { width: colW[0] - 8, align: 'center' });
        doc.text(it.description, tableX + colW[0] + 4, y + 6, { width: colW[1] - 8 });
        doc.text(it.situation, tableX + colW[0] + colW[1] + 4, y + 6, { width: colW[2] - 8, align: 'center' });
        y += 22;
      }
      doc.y = y + 12;
      doc.x = 50;

      // Texto pós-tabela
      doc.font('Helvetica').fontSize(10).text(POST_TABLE, 50, doc.y, { align: 'justify', width: contentW });
      doc.moveDown(0.4);

      // Seções
      for (const sec of SECTIONS) {
        if (doc.y > doc.page.height - 180) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(10.5).text(sec.title, 50, doc.y, { width: contentW });
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(10).text(sec.body, 50, doc.y, { align: 'justify', width: contentW });
        if (sec.bullets) {
          doc.moveDown(0.2);
          for (const b of sec.bullets) {
            doc.text('• ' + b, 50, doc.y, { indent: 15, width: contentW });
          }
        }
        doc.moveDown(0.4);
      }

      // Fechamento
      if (doc.y > doc.page.height - 180) doc.addPage();
      doc.font('Helvetica').fontSize(10).text(CLOSING, 50, doc.y, { align: 'justify', width: contentW });
      doc.moveDown(0.8);
      doc.text('Atenciosamente;', 50, doc.y);

      // Assinaturas
      doc.moveDown(3);
      const sigY = doc.page.height - 180;
      doc.moveTo(70, sigY).lineTo(265, sigY).stroke();
      doc.moveTo(330, sigY).lineTo(525, sigY).stroke();
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a')
        .text('Responsável pela entrega', 70, sigY + 5, { width: 195, align: 'center' })
        .text('Responsável pelo Recebimento', 330, sigY + 5, { width: 195, align: 'center' });
      doc.font('Helvetica').fontSize(9)
        .text('SEMEC-CTEC', 70, sigY + 22, { width: 195, align: 'center' })
        .text('ESCOLA', 330, sigY + 22, { width: 195, align: 'center' });

      doc.end();
    } catch (e) { reject(e); }
  });
}

// ====================================================================
// GERADOR DOCX (Word) — com cabeçalho/rodapé em todas as páginas
// ====================================================================
async function buildDocx(labId) {
  const { lab, items } = await loadLabData(labId);

  const headerBuf = loadImage(HEADER_IMG);
  const footerBuf = loadImage(FOOTER_IMG);

  // Largura útil ~ 16cm (A4 com margens 2cm). 1cm ≈ 28.3 pixels (em 72dpi do docx é diferente
  // mas docx usa pixels diretamente para o width).
  // Vamos usar 600px de largura no header/footer (cabe na largura útil do A4).
  const HEADER_W = 600;
  const HEADER_H = Math.round(HEADER_W * (141 / 944)); // ~90
  const FOOTER_W = 600;
  const FOOTER_H = Math.round(FOOTER_W * (133 / 946)); // ~84

  const headerImageParagraph = headerBuf ? new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({
      data: headerBuf,
      transformation: { width: HEADER_W, height: HEADER_H },
      type: 'png',
    })],
  }) : new Paragraph({ children: [] });

  const footerImageParagraph = footerBuf ? new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({
      data: footerBuf,
      transformation: { width: FOOTER_W, height: FOOTER_H },
      type: 'png',
    })],
  }) : new Paragraph({ children: [] });

  const p = (text, opts = {}) => new Paragraph({
    spacing: { after: opts.after ?? 120 },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    children: [
      new TextRun({
        text, bold: opts.bold || false,
        size: opts.size || 22, font: 'Calibri',
      }),
    ],
  });

  const titleRow = new Paragraph({
    spacing: { after: 240 },
    children: [
      new TextRun({ text: `Termo de Entrega n° ${lab.deliveryTermNumber} — ${kindLabel(lab.kind)}`, bold: true, size: 22, font: 'Calibri' }),
      new TextRun({ text: '\t\t\t', size: 22, font: 'Calibri' }),
      new TextRun({
        text: `Abaetetuba, ${formatDateBR(lab.assemblyDate || new Date())}.`,
        size: 22, font: 'Calibri',
      }),
    ],
  });

  const cell = (text, bold = false, opts = {}) => new TableCell({
    width: { size: opts.width || 1500, type: WidthType.DXA },
    shading: opts.shaded ? { type: ShadingType.SOLID, color: 'E2E8F0' } : undefined,
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), bold, size: 20, font: 'Calibri' })],
    })],
  });

  const itemsTable = new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          cell('Quantitativo', true, { shaded: true, align: AlignmentType.CENTER, width: 1600 }),
          cell('Descrição', true, { shaded: true, align: AlignmentType.CENTER, width: 5400 }),
          cell('Situação', true, { shaded: true, align: AlignmentType.CENTER, width: 2000 }),
        ],
      }),
      ...(items.length === 0
        ? [new TableRow({ children: [cell('(sem itens cadastrados)', false, { align: AlignmentType.CENTER, width: 9000 })] })]
        : items.map((it) => new TableRow({
            children: [
              cell(it.qty, false, { align: AlignmentType.CENTER, width: 1600 }),
              cell(it.description, false, { width: 5400 }),
              cell(it.situation, false, { align: AlignmentType.CENTER, width: 2000 }),
            ],
          }))),
    ],
  });

  const sectionParagraphs = [];
  for (const sec of SECTIONS) {
    sectionParagraphs.push(p(sec.title, { bold: true, after: 80, align: AlignmentType.LEFT }));
    sectionParagraphs.push(p(sec.body));
    if (sec.bullets) {
      for (const b of sec.bullets) {
        sectionParagraphs.push(new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: [new TextRun({ text: b, size: 22, font: 'Calibri' })],
        }));
      }
    }
  }

  const doc = new Document({
    creator: 'CTEC - SEMEC Abaetetuba',
    title: `Termo de Entrega ${lab.deliveryTermNumber} - ${kindLabel(lab.kind)}`,
    sections: [{
      properties: {
        page: {
          margin: { top: 1800, right: 1000, bottom: 1500, left: 1000 },
        },
      },
      headers: { default: new Header({ children: [headerImageParagraph] }) },
      footers: { default: new Footer({ children: [footerImageParagraph] }) },
      children: [
        titleRow,
        p(HEADER_FROM, { after: 60, align: AlignmentType.LEFT }),
        p(
          `Para: ${(lab.school?.name || '—').toUpperCase()}${lab.school?.inep ? '-' + lab.school.inep : ''}`,
          { after: 240, align: AlignmentType.LEFT }
        ),
        p(INTRO),
        p('Itens Entregues', { bold: true, align: AlignmentType.CENTER, after: 120 }),
        itemsTable,
        new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: '' })] }),
        ...POST_TABLE.split('\n').filter(Boolean).map(line => p(line)),
        ...sectionParagraphs,
        p(CLOSING),
        p('Atenciosamente;', { after: 600, align: AlignmentType.LEFT }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({ text: 'Responsável pela entrega', bold: true, size: 22, font: 'Calibri' }),
            new TextRun({ text: '\t\t\t', size: 22 }),
            new TextRun({ text: 'Responsável pelo Recebimento', bold: true, size: 22, font: 'Calibri' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'SEMEC-CTEC', size: 20, font: 'Calibri' }),
            new TextRun({ text: '\t\t\t\t\t', size: 22 }),
            new TextRun({ text: 'ESCOLA', size: 20, font: 'Calibri' }),
          ],
        }),
      ],
    }],
  });

  return await Packer.toBuffer(doc);
}

module.exports = { buildPdf, buildDocx, ensureTermNumber };

const PDFDocument = require('pdfkit');
const AppError = require('../utils/AppError');
const { paintHeaderFooter, sectionTitle, labelValue, paragraph } = require('./orderPdf.service');

// Os campos da conversa são armazenados em texto rotulado. Pedidos antigos
// podem conter somente texto livre; nesse caso o texto original é preservado.
function parseConversation(description = '') {
  const known = new Set(['Problema', 'Locais afetados', 'Local informado', 'Horário aproximado', 'Frequência', 'Teste em outro aparelho', 'Verificação do Wi-Fi', 'Luzes do equipamento', 'Falta de energia', 'Contato anterior com a TI', 'Protocolo anterior', 'Informações adicionais', 'Resultado das verificações', 'Condição para reiniciar', 'Reinício do equipamento', 'Abrangência', 'Luzes do modem/roteador']);
  const values = {}; let current = null; let found = false;
  for (const line of String(description).split(/\r?\n/)) {
    const colon = line.indexOf(':');
    const key = colon > 0 ? line.slice(0, colon).trim() : '';
    if (known.has(key)) { found = true; current = key; values[key] = line.slice(colon + 1).trim(); }
    else if (current) values[current] += '\n' + line;
  }
  return found ? values : null;
}
function meaningful(value) {
  return value && !['Não informado', 'Não informadas'].includes(String(value).trim());
}
function buildNarrative(item) {
  const answers = parseConversation(item.description);
  const school = item.schoolName || 'A escola';
  if (!answers) return `A escola ${school} informou o seguinte problema:\n\n${item.description || 'Descrição não informada.'}\n\nSolicitamos à equipe técnica da Online Telecom a análise da situação e as providências cabíveis.`;
  const problemText = {
    'Sem internet': 'está sem acesso à internet',
    'Escola sem internet': 'está sem acesso à internet',
    'Internet lenta': 'a conexão de internet está lenta',
    'Internet lenta ou instável': 'a conexão de internet está lenta ou instável',
    'Internet cai e volta': 'a conexão de internet cai e volta',
    'Problema em um local específico': 'há um problema de conexão em um local específico',
  };
  const typed = meaningful(answers.Problema) ? answers.Problema : '';
  const fallback = { sem_internet: 'está sem acesso à internet', lenta_instavel: 'a conexão de internet está lenta ou instável', local_especifico: 'há um problema de conexão em um local específico', outro: 'há um problema com a conexão de internet' };
  const problem = problemText[typed] || (!typed || typed === 'Outro problema' ? fallback[item.issueType] : null);
  const paragraphs = [problem ? `A gestão da escola ${school} informou que ${problem}.` : `A gestão da escola ${school} relatou o seguinte problema de internet: ${typed}.`];
  const area = answers['Locais afetados'] || answers.Abrangência;
  const details = [];
  if (area === 'Toda a escola') details.push('Segundo a gestão, o problema afeta toda a escola.');
  else if (area === 'Não sei informar') details.push('A gestão não soube informar quais locais estão afetados.');
  else if (meaningful(area)) details.push(`A gestão informou que o problema afeta: ${area}.`);
  if (meaningful(answers['Local informado'])) details.push(`Os locais especificados foram: ${answers['Local informado']}.`);
  const since = { 'Hoje': 'O problema começou no dia em que a solicitação foi registrada.', 'Ontem': 'O problema começou no dia anterior ao registro da solicitação.', 'Há mais de dois dias': 'O problema começou há mais de dois dias antes do registro da solicitação.', 'Não sei informar': 'A gestão não soube informar quando o problema começou.' };
  if (meaningful(item.since)) details.push(since[item.since] || `Quanto ao início do problema, foi informado: ${item.since}.`);
  if (meaningful(answers['Horário aproximado'])) details.push(`O horário aproximado informado foi: ${answers['Horário aproximado']}.`);
  if (meaningful(answers.Frequência)) details.push(`Sobre a frequência, foi informado: ${answers.Frequência}.`);
  if (details.length) paragraphs.push(details.join(' '));
  const checks = [];
  const device = { 'Também não funciona': 'A gestão informou que a conexão também não funciona em outro aparelho.', 'Funciona em outro aparelho': 'A gestão informou que a conexão funciona em outro aparelho.', 'Não consigo verificar': 'Não foi possível verificar a conexão em outro aparelho.' };
  if (meaningful(answers['Teste em outro aparelho'])) checks.push(device[answers['Teste em outro aparelho']] || `Sobre o teste em outro aparelho, foi informado: ${answers['Teste em outro aparelho']}.`);
  const wifi = { 'Sim, conferi': 'A gestão informou que conferiu o Wi-Fi do aparelho com problema.', 'Não consigo verificar': 'Não foi possível conferir o Wi-Fi do aparelho com problema.' };
  if (meaningful(answers['Verificação do Wi-Fi'])) checks.push(wifi[answers['Verificação do Wi-Fi']] || `Sobre a verificação do Wi-Fi, foi informado: ${answers['Verificação do Wi-Fi']}.`);
  const lights = answers['Luzes do equipamento'] || answers['Luzes do modem/roteador'];
  const lightText = { 'Parecem normais': 'Segundo a gestão, as luzes do equipamento parecem normais.', 'Acesas normalmente': 'Segundo a gestão, as luzes do equipamento estão acesas normalmente.', 'Há uma luz vermelha ou apagada': 'A gestão relatou que há uma luz vermelha ou apagada no equipamento.', 'Alguma luz apagada ou vermelha': 'A gestão relatou que há uma luz vermelha ou apagada no equipamento.', 'O equipamento parece desligado': 'Segundo a gestão, o equipamento parece estar desligado.', 'Não consigo verificar': 'Não foi possível verificar as luzes do equipamento.' };
  if (meaningful(lights)) checks.push(lightText[lights] || `Quanto às luzes do equipamento, foi informado: ${lights}.`);
  const power = { 'Sim': 'A gestão informou que houve falta ou oscilação de energia antes do problema.', 'Não': 'A gestão informou que não houve falta ou oscilação de energia antes do problema.', 'Não sei informar': 'A gestão não soube informar se houve falta ou oscilação de energia antes do problema.' };
  if (meaningful(answers['Falta de energia'])) checks.push(power[answers['Falta de energia']] || `Sobre falta ou oscilação de energia, foi informado: ${answers['Falta de energia']}.`);
  const restart = { 'Reiniciei uma vez': 'A gestão informou que reiniciou o equipamento uma vez.', 'Não consegui ou não foi seguro': 'A gestão informou que não conseguiu reiniciar o equipamento ou considerou que não era seguro.' };
  if (meaningful(answers['Reinício do equipamento'])) checks.push(restart[answers['Reinício do equipamento']] || `Sobre o reinício do equipamento, foi informado: ${answers['Reinício do equipamento']}.`);
  else if (answers['Condição para reiniciar'] === 'Não sei qual é o equipamento') checks.push('A gestão informou que não soube identificar o equipamento a ser reiniciado.');
  else if (answers['Condição para reiniciar'] === 'Não posso ou não sei se é seguro') checks.push('A gestão informou que não podia reiniciar o equipamento ou não sabia se era seguro.');
  const result = { 'Não, continua com problema': 'Após essas verificações, a gestão informou que o problema continuou.', 'Não sei': 'A gestão não soube informar se a conexão voltou após as verificações.', 'Sim, voltou': 'Após as verificações, a gestão informou que a conexão voltou a funcionar.' };
  if (meaningful(answers['Resultado das verificações'])) checks.push(result[answers['Resultado das verificações']] || `Após as verificações, foi informado: ${answers['Resultado das verificações']}.`);
  if (checks.length) paragraphs.push(checks.join(' '));
  const previous = [];
  const reported = { 'Sim': 'A gestão informou que esse problema já havia sido comunicado à TI.', 'Não': 'A gestão informou que esse problema ainda não havia sido comunicado à TI.', 'Não sei informar': 'A gestão não soube informar se o problema já havia sido comunicado à TI.' };
  if (meaningful(answers['Contato anterior com a TI'])) previous.push(reported[answers['Contato anterior com a TI']] || `Sobre contato anterior com a TI, foi informado: ${answers['Contato anterior com a TI']}.`);
  if (meaningful(answers['Protocolo anterior'])) previous.push(`O protocolo anterior informado foi: ${answers['Protocolo anterior']}.`);
  if (meaningful(answers['Informações adicionais'])) previous.push(`Informações adicionais da escola: ${answers['Informações adicionais']}`);
  if (previous.length) paragraphs.push(previous.join(' '));
  paragraphs.push('Solicitamos à equipe técnica da Online Telecom a análise da situação e as providências cabíveis.');
  return paragraphs.join('\n\n');
}
function date(value) { return value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Belem' }) : 'Não informada'; }
// JPEG/PNG: limita as dimensões para reduzir risco de processamento excessivo.
function safeDimensions(buf, mime) {
  if (mime === 'image/png' && buf.length >= 24 && buf.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (mime !== 'image/jpeg' || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let p = 2;
  while (p + 8 < buf.length) {
    if (buf[p] !== 0xff) { p++; continue; }
    while (p < buf.length && buf[p] === 0xff) p++;
    const marker = buf[p++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (p + 2 > buf.length) break;
    const len = buf.readUInt16BE(p);
    if (len < 2 || p + len > buf.length) break;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && len >= 7) return [buf.readUInt16BE(p + 5), buf.readUInt16BE(p + 3)];
    p += len;
  }
  return null;
}
function preparePhotos(item, indices) {
  return indices.map(index => {
    const photo = item.photos?.[index];
    if (!photo || !photo.data) throw new AppError('Foto não encontrada. Atualize a solicitação.', 400);
    if (!['image/jpeg', 'image/png'].includes(photo.mimeType)) throw new AppError(`A foto ${index + 1} é WebP. Baixe e encaminhe separadamente ou use JPEG/PNG para incluí-la no PDF.`, 400);
    const bytes = Buffer.from(photo.data);
    const dimensions = safeDimensions(bytes, photo.mimeType);
    if (!dimensions || !dimensions[0] || !dimensions[1] || dimensions[0] * dimensions[1] > 12000000) throw new AppError(`A foto ${index + 1} é inválida ou muito grande para incluir no PDF. Encaminhe-a separadamente.`, 400);
    return { index, bytes };
  });
}
function buildPdf(item, { narrative, photoIndexes }) {
  const photos = preparePhotos(item, photoIndexes);
  return new Promise((resolve, reject) => {
    // Mesmo formato A4, margens, cabeçalho, rodapé e helpers usados nas O.S.
    const doc = new PDFDocument({ size: 'A4', margins: { top: 130, bottom: 100, left: 60, right: 60 }, info: { Title: 'Solicitação de suporte de internet', Author: 'CTEC' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      doc.on('pageAdded', () => paintHeaderFooter(doc));
      paintHeaderFooter(doc);
      const label = (name, value) => labelValue(doc, name, value || 'Não informado');
      const contentW = doc.page.width - 120;
      doc.font('Helvetica-Bold').fontSize(15).fillColor('#000')
        .text('Solicitação de Suporte de Internet', 60, doc.y, { align: 'center', width: contentW });
      doc.moveDown(1.2);
      sectionTitle(doc, 'Informações da Solicitação');
      const school = (item.schoolName || '').trim();
      const site = (item.installation?.siteName || '').trim();
      // Mantém o nome da escola se o gestor informou apenas um setor, como 'Secretaria'.
      const location = !site ? school : !school || site.toLocaleLowerCase('pt-BR').includes(school.toLocaleLowerCase('pt-BR')) ? site : `${school} — ${site}`;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text('Local/Escola: ', 60, doc.y, { width: contentW, continued: true });
      doc.font('Helvetica').fontSize(11).text(location || 'Não informado', { continued: true });
      doc.font('Helvetica-Bold').fontSize(11).text('   |   INEP: ', { continued: true });
      doc.font('Helvetica').fontSize(11).text(item.inep || 'Não informado');
      label('Endereço', item.installation?.address);
      const ids = item.installation?.identifiers || [];
      label('GPON', ids.length ? ids.map((x, i) => `${ids.length > 1 ? `${i + 1}: ` : ''}${x.number}${x.location ? ` (${x.location})` : ''}`).join(' | ') : ({ not_found: 'Não encontrado', cannot_check: 'Não foi possível verificar' }[item.installation?.gponStatus] || 'Não informado'));
      label('Solicitação recebida', date(item.createdAt));
      doc.moveDown(.8);
      sectionTitle(doc, 'Relato da Solicitação');
      paragraph(doc, narrative);
      for (const photo of photos) {
        doc.addPage();
        sectionTitle(doc, `Foto da etiqueta ${photo.index + 1}`);
        doc.font('Helvetica').fontSize(10).fillColor('#000').text('Imagem enviada pela escola. Confira se não contém senhas ou outros dados que não devem ser compartilhados.', 60, doc.y, { width: contentW });
        doc.moveDown(.6);
        // Mantém o espaço reservado ao rodapé das O.S.
        const availableHeight = doc.page.height - doc.page.margins.bottom - doc.y;
        doc.image(photo.bytes, 60, doc.y, { fit: [contentW, availableHeight], align: 'center', valign: 'center' });
      }
      doc.end();
    } catch (e) { doc.destroy(); reject(new AppError('Não foi possível gerar o PDF. Confira o texto e as fotos selecionadas.', 400)); }
  });
}
module.exports = { buildNarrative, buildPdf };

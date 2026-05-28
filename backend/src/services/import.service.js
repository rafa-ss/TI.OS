const XLSX = require('xlsx');
const School = require('../models/School');

/**
 * Importa CSV/XLSX do Censo Escolar.
 *
 * Suporta DOIS formatos:
 *  1) Arquivo COM cabeçalho (NO_ENTIDADE, CO_ENTIDADE etc.) — detecta colunas pelo nome
 *  2) Arquivo SEM cabeçalho no formato oficial do Censo Escolar (302 colunas)
 *     — detecta automaticamente pelas posições conhecidas
 *
 * Também suporta encoding Latin-1 (ISO-8859-1) e separador ';' (padrão BR).
 */

const COLUMN_MAP = {
  inep: ['co_entidade', 'codigo_inep', 'cod_inep', 'inep', 'codigo'],
  name: ['no_entidade', 'nome_escola', 'nome', 'nome_da_escola', 'escola'],
  municipio: ['no_municipio', 'municipio', 'cidade'],
  uf: ['sg_uf', 'uf'],
  situacao: ['tp_situacao_funcionamento', 'situacao', 'situacao_funcionamento'],
  dependenciaAdm: ['tp_dependencia', 'dependencia', 'dependencia_administrativa'],
  localizacao: ['tp_localizacao', 'localizacao'],
  endereco: ['ds_endereco', 'endereco', 'logradouro'],
};

// Posições fixas no layout oficial do Censo Escolar (sem cabeçalho)
// confirmado com arquivo de 302 colunas
const CENSO_POSITIONS = {
  uf: 4,            // SG_UF
  municipio: 16,    // NO_MUNICIPIO
  name: 20,         // NO_ENTIDADE
  inep: 21,         // CO_ENTIDADE
  dependenciaAdm: 22, // TP_DEPENDENCIA
  situacao: 24,     // TP_SITUACAO_FUNCIONAMENTO
  endereco: 26,     // DS_ENDERECO
  localizacao: 41,  // TP_LOCALIZACAO (aprox.)
};

const SITUACAO_MAP = {
  1: 'Ativa',
  2: 'Paralisada',
  3: 'Extinta',
  4: 'Ativa',
};

const DEPENDENCIA_MAP = {
  1: 'Federal',
  2: 'Estadual',
  3: 'Municipal',
  4: 'Privada',
};

function normalizeKey(k) {
  return String(k || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function pick(row, candidates) {
  for (const key of Object.keys(row)) {
    const nk = normalizeKey(key);
    if (candidates.includes(nk)) return row[key];
  }
  return undefined;
}

function parseSituacao(val) {
  if (val == null || val === '') return 'Ativa';
  if (SITUACAO_MAP[val]) return SITUACAO_MAP[val];
  return String(val);
}

function parseDependencia(val) {
  if (val == null || val === '') return '';
  if (DEPENDENCIA_MAP[val]) return DEPENDENCIA_MAP[val];
  return String(val);
}

/**
 * Tenta decodificar o buffer assumindo Latin-1 (caso o BOM/UTF-8 não esteja presente).
 * Retorna o buffer mais provável.
 */
function decodeBuffer(buffer) {
  // Se já é UTF-8 válido, retorna como está
  const utf8 = buffer.toString('utf8');
  // Se contém caracteres de substituição (REPLACEMENT CHARACTER), tenta latin1
  if (utf8.includes('\uFFFD')) {
    return Buffer.from(buffer.toString('latin1'), 'utf8');
  }
  return buffer;
}

/**
 * Detecta o separador olhando a primeira linha.
 */
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const semis = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (semis > commas && semis > tabs) return ';';
  if (tabs > commas) return '\t';
  return ',';
}

/**
 * Detecta se o arquivo tem cabeçalho:
 * - Olha a primeira linha; se contém marcadores conhecidos (NU_ANO, CO_ENTIDADE, NO_ENTIDADE, etc.),
 *   é COM cabeçalho. Senão é SEM cabeçalho.
 */
function hasHeader(firstRow) {
  const hints = [
    'no_entidade', 'co_entidade', 'nu_ano_censo', 'sg_uf', 'no_municipio',
    'tp_dependencia', 'tp_situacao_funcionamento',
  ];
  return Object.keys(firstRow).some((k) => hints.includes(normalizeKey(k)));
}

/**
 * Importa quando NÃO tem cabeçalho — usa posições fixas.
 */
function buildDocFromCensoRow(arr) {
  const inep = String(arr[CENSO_POSITIONS.inep] || '').trim();
  const name = String(arr[CENSO_POSITIONS.name] || '').trim();
  if (!inep || !name) return null;

  const municipio = String(arr[CENSO_POSITIONS.municipio] || 'Abaetetuba').trim();
  const uf = String(arr[CENSO_POSITIONS.uf] || 'PA').trim();
  const situacao = parseSituacao(arr[CENSO_POSITIONS.situacao]);
  const dependenciaAdm = parseDependencia(arr[CENSO_POSITIONS.dependenciaAdm]);
  const endereco = String(arr[CENSO_POSITIONS.endereco] || '').trim();

  return { inep, name, municipio, uf, situacao, dependenciaAdm, endereco };
}

/**
 * Importa quando TEM cabeçalho — usa nomes das colunas.
 */
function buildDocFromHeaderRow(row) {
  const inep = String(pick(row, COLUMN_MAP.inep) || '').trim();
  const name = String(pick(row, COLUMN_MAP.name) || '').trim();
  if (!inep || !name) return null;

  return {
    inep,
    name,
    municipio: String(pick(row, COLUMN_MAP.municipio) || 'Abaetetuba').trim(),
    uf: String(pick(row, COLUMN_MAP.uf) || 'PA').trim(),
    situacao: parseSituacao(pick(row, COLUMN_MAP.situacao)),
    dependenciaAdm: parseDependencia(pick(row, COLUMN_MAP.dependenciaAdm)),
    localizacao: String(pick(row, COLUMN_MAP.localizacao) || '').trim(),
    endereco: String(pick(row, COLUMN_MAP.endereco) || '').trim(),
  };
}

async function importCensoBuffer(buffer, originalName = 'censo') {
  const decoded = decodeBuffer(buffer);

  // tenta detectar separador / encoding pelo conteúdo CSV
  const text = decoded.toString('utf8');
  const delimiter = detectDelimiter(text);

  // Lê com XLSX (funciona pra .xlsx, .xls e .csv com separadores diversos)
  const wb = XLSX.read(decoded, {
    type: 'buffer',
    cellDates: false,
    raw: true,
    FS: delimiter, // separador para CSV
  });
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // Primeiro tenta como objeto (com cabeçalho)
  const rowsAsObj = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const useHeader = rowsAsObj.length > 0 && hasHeader(rowsAsObj[0]);

  let docs = [];
  let totalRows = 0;

  if (useHeader) {
    totalRows = rowsAsObj.length;
    docs = rowsAsObj.map(buildDocFromHeaderRow).filter(Boolean);
  } else {
    // Lê como array (sem cabeçalho) — formato oficial do Censo
    const rowsAsArr = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    totalRows = rowsAsArr.length;
    docs = rowsAsArr.map(buildDocFromCensoRow).filter(Boolean);
  }

  let inserted = 0;
  let updated = 0;
  const errors = [];

  if (docs.length) {
    const bulk = docs.map((d) => ({
      updateOne: {
        filter: { inep: d.inep },
        update: {
          $set: { ...d, importedFrom: originalName, lastImportedAt: new Date() },
        },
        upsert: true,
      },
    }));

    try {
      const res = await School.bulkWrite(bulk, { ordered: false });
      inserted = res.upsertedCount || 0;
      updated = res.modifiedCount || 0;
    } catch (err) {
      errors.push(err.message);
    }
  }

  return {
    totalRows,
    inserted,
    updated,
    skipped: totalRows - docs.length,
    errors,
    detected: {
      hasHeader: useHeader,
      delimiter,
      encoding: decoded === buffer ? 'utf8' : 'latin1',
    },
  };
}

module.exports = { importCensoBuffer };

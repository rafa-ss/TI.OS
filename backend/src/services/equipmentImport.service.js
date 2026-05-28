const XLSX = require('xlsx');
const Equipment = require('../models/Equipment');
const School = require('../models/School');

const COLUMN_MAP = {
  patrimonio: ['patrimonio', 'patrimônio', 'tombamento', 'nº_patrimonio', 'numero_patrimonio'],
  type: ['tipo', 'categoria', 'type'],
  brand: ['marca', 'brand', 'fabricante'],
  model: ['modelo', 'model'],
  serialNumber: ['numero_de_serie', 'numero_serie', 'serial', 'serial_number', 'nº_serie', 'n_serie', 'serie'],
  status: ['status', 'situacao', 'situação'],
  location: ['local', 'localizacao', 'localização', 'setor', 'almoxarifado'],
  schoolInep: ['inep', 'codigo_inep', 'cod_inep', 'co_entidade'],
  schoolName: ['escola', 'nome_escola', 'unidade'],
  acquisitionDate: ['data_aquisicao', 'aquisicao', 'data_compra'],
  invoice: ['nota_fiscal', 'nf', 'invoice'],
  notes: ['observacoes', 'observação', 'observacao', 'notas', 'notes'],
};

// Aliases de tipo (aceita pt-br comum)
const TYPE_ALIASES = {
  pc: 'computador',
  desktop: 'computador',
  computador: 'computador',
  computadores: 'computador',
  notebook: 'notebook',
  laptop: 'notebook',
  impressora: 'impressora',
  printer: 'impressora',
  roteador: 'roteador',
  router: 'roteador',
  nobreak: 'nobreak',
  'no-break': 'nobreak',
  tablet: 'tablet',
};

// Aliases de status
const STATUS_ALIASES = {
  estoque: 'em_estoque',
  em_estoque: 'em_estoque',
  'em estoque': 'em_estoque',
  novo: 'em_estoque',
  disponivel: 'em_estoque',
  disponível: 'em_estoque',
  em_uso: 'em_uso',
  'em uso': 'em_uso',
  uso: 'em_uso',
  instalado: 'em_uso',
  ativo: 'em_uso',
  manutencao: 'em_manutencao',
  manutenção: 'em_manutencao',
  em_manutencao: 'em_manutencao',
  'em manutenção': 'em_manutencao',
  aguardando_peca: 'aguardando_peca',
  'aguardando peça': 'aguardando_peca',
  inativo: 'inativo',
  descartado: 'descartado',
  baixado: 'descartado',
};

function normalizeKey(k) {
  return String(k || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[°º]/g, '')
    .replace(/\s+/g, '_');
}

function pick(row, candidates) {
  for (const key of Object.keys(row)) {
    const nk = normalizeKey(key);
    if (candidates.includes(nk)) {
      const v = row[key];
      if (v === null || v === undefined || v === '') return undefined;
      return v;
    }
  }
  return undefined;
}

function parseType(v) {
  if (!v) return 'outro';
  const n = normalizeKey(v);
  return TYPE_ALIASES[n] || 'outro';
}

function parseStatus(v) {
  if (!v) return 'em_estoque';
  const n = normalizeKey(v);
  return STATUS_ALIASES[n] || 'em_estoque';
}

function parseDate(v) {
  if (!v) return null;
  // dd/mm/yyyy
  if (typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(v)) {
    const [d, m, y] = v.split('/');
    return new Date(`${y}-${m}-${d}`);
  }
  if (typeof v === 'number') {
    // serial date Excel
    const date = XLSX.SSF.parse_date_code(v);
    if (date) return new Date(date.y, date.m - 1, date.d);
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function importEquipmentBuffer(buffer, originalName = 'equipamentos') {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  // Pré-carrega INEPs para resolver escola por código
  const inepSet = new Set();
  rows.forEach((r) => {
    const inep = pick(r, COLUMN_MAP.schoolInep);
    if (inep) inepSet.add(String(inep).trim());
  });
  let schoolByInep = new Map();
  if (inepSet.size) {
    const found = await School.find({ inep: { $in: Array.from(inepSet) } }).select('_id inep');
    schoolByInep = new Map(found.map((s) => [s.inep, s._id]));
  }

  const bulk = [];
  rows.forEach((row, idx) => {
    const patrimonio = String(pick(row, COLUMN_MAP.patrimonio) || '').trim();
    if (!patrimonio) {
      skipped++;
      return;
    }

    const inep = pick(row, COLUMN_MAP.schoolInep);
    const schoolId = inep ? schoolByInep.get(String(inep).trim()) : null;

    const doc = {
      patrimonio,
      type: parseType(pick(row, COLUMN_MAP.type)),
      brand: String(pick(row, COLUMN_MAP.brand) || '').trim(),
      model: String(pick(row, COLUMN_MAP.model) || '').trim(),
      serialNumber: String(pick(row, COLUMN_MAP.serialNumber) || '').trim(),
      status: parseStatus(pick(row, COLUMN_MAP.status)),
      location: String(pick(row, COLUMN_MAP.location) || '').trim(),
      invoice: String(pick(row, COLUMN_MAP.invoice) || '').trim(),
      notes: String(pick(row, COLUMN_MAP.notes) || '').trim(),
    };

    const dt = parseDate(pick(row, COLUMN_MAP.acquisitionDate));
    if (dt) doc.acquisitionDate = dt;
    if (schoolId) doc.school = schoolId;

    bulk.push({
      updateOne: {
        filter: { patrimonio },
        update: { $set: doc },
        upsert: true,
      },
    });
  });

  if (bulk.length) {
    try {
      const res = await Equipment.bulkWrite(bulk, { ordered: false });
      inserted = res.upsertedCount || 0;
      updated = res.modifiedCount || 0;
    } catch (err) {
      errors.push(err.message);
    }
  }

  return {
    totalRows: rows.length,
    inserted,
    updated,
    skipped,
    errors,
    file: originalName,
  };
}

module.exports = { importEquipmentBuffer };

const StockItem = require('../models/StockItem');
const AppError = require('../utils/AppError');

/**
 * Verifica disponibilidade no estoque para um conjunto de equipamentos.
 */
async function checkAvailability(equipments) {
  const missing = [];
  for (const eq of equipments) {
    const stockTotal = await StockItem.aggregate([
      { $match: { type: String(eq.type).toLowerCase().trim(), condition: eq.condition } },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);
    const available = stockTotal[0]?.total || 0;
    if (available < eq.quantity) {
      missing.push({
        type: eq.type, condition: eq.condition,
        requested: eq.quantity, available,
        shortage: eq.quantity - available,
      });
    }
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Debita as quantidades do estoque (consome lotes do mais antigo para o mais novo).
 */
async function debitStock(equipments) {
  const check = await checkAvailability(equipments);
  if (!check.ok) {
    const msg = check.missing
      .map((m) => `${m.type} (${m.condition}): pedido ${m.requested}, disponível ${m.available}`)
      .join(' · ');
    throw new AppError(`Estoque insuficiente: ${msg}`, 400, check.missing);
  }

  for (const eq of equipments) {
    let needed = eq.quantity;
    const type = String(eq.type).toLowerCase().trim();
    const lots = await StockItem.find({ type, condition: eq.condition })
      .sort({ createdAt: 1 });
    for (const lot of lots) {
      if (needed <= 0) break;
      const take = Math.min(lot.quantity, needed);
      lot.quantity -= take;
      needed -= take;
      if (lot.quantity === 0) await lot.deleteOne();
      else await lot.save();
    }
  }
}

/**
 * Devolve quantidades ao estoque (cria/incrementa lotes).
 */
async function returnToStock(equipments, location = 'Almoxarifado SEMED', notes = '') {
  for (const eq of equipments) {
    const type = String(eq.type).toLowerCase().trim();
    const existing = await StockItem.findOne({
      type, condition: eq.condition, location,
    });
    if (existing) {
      existing.quantity += eq.quantity;
      await existing.save();
    } else {
      await StockItem.create({
        type, condition: eq.condition,
        quantity: eq.quantity, location,
        notes: notes || 'Retorno de laboratório',
      });
    }
  }
}

/**
 * Calcula delta entre equipamentos antigos e novos.
 * Retorna { toDebit, toReturn }.
 */
function diffEquipments(oldEqs = [], newEqs = []) {
  const key = (e) => `${String(e.type).toLowerCase().trim()}|${e.condition}`;
  const oldMap = new Map();
  for (const e of oldEqs) {
    const k = key(e);
    oldMap.set(k, (oldMap.get(k) || 0) + Number(e.quantity || 0));
  }
  const newMap = new Map();
  for (const e of newEqs) {
    const k = key(e);
    newMap.set(k, (newMap.get(k) || 0) + Number(e.quantity || 0));
  }
  const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);
  const toDebit = [];
  const toReturn = [];
  for (const k of allKeys) {
    const [type, condition] = k.split('|');
    const diff = (newMap.get(k) || 0) - (oldMap.get(k) || 0);
    if (diff > 0) toDebit.push({ type, condition, quantity: diff });
    else if (diff < 0) toReturn.push({ type, condition, quantity: -diff });
  }
  return { toDebit, toReturn };
}

module.exports = { checkAvailability, debitStock, returnToStock, diffEquipments };

const StockItem = require('../models/StockItem');
const AppError = require('../utils/AppError');

/**
 * Verifica disponibilidade no estoque para um conjunto de equipamentos.
 * Retorna {ok, missing[]} — se ok=false, missing detalha o que falta.
 */
async function checkAvailability(equipments) {
  const missing = [];
  for (const eq of equipments) {
    const stockTotal = await StockItem.aggregate([
      { $match: { type: eq.type, condition: eq.condition } },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);
    const available = stockTotal[0]?.total || 0;
    if (available < eq.quantity) {
      missing.push({
        type: eq.type,
        condition: eq.condition,
        requested: eq.quantity,
        available,
        shortage: eq.quantity - available,
      });
    }
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Debita as quantidades do estoque (consome lotes do mais antigo para o mais novo).
 * Lança erro se não houver estoque suficiente.
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
    const lots = await StockItem.find({ type: eq.type, condition: eq.condition })
      .sort({ createdAt: 1 }); // FIFO
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
 * Usado quando um laboratório é desativado ou cancelado.
 */
async function returnToStock(equipments, location = 'Almoxarifado SEMED', notes = '') {
  for (const eq of equipments) {
    // Tenta achar lote existente do mesmo tipo/condição/local
    const existing = await StockItem.findOne({
      type: eq.type, condition: eq.condition, location,
    });
    if (existing) {
      existing.quantity += eq.quantity;
      await existing.save();
    } else {
      await StockItem.create({
        type: eq.type,
        condition: eq.condition,
        quantity: eq.quantity,
        location,
        notes: notes || 'Retorno de laboratório',
      });
    }
  }
}

module.exports = { checkAvailability, debitStock, returnToStock };

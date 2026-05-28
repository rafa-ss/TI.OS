const Equipment = require('../models/Equipment');
const StockThreshold = require('../models/StockThreshold');
const Notification = require('../models/Notification');
const User = require('../models/User');

const DEFAULT_TYPES = ['computador', 'notebook', 'impressora', 'roteador', 'nobreak', 'tablet'];

/**
 * Retorna o status do estoque por tipo:
 * [{ type, inStock, minQty, low: bool }]
 */
async function getStockReport() {
  const counts = await Equipment.aggregate([
    { $match: { status: 'em_estoque' } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  const thresholds = await StockThreshold.find();
  const thMap = Object.fromEntries(thresholds.map((t) => [t.type, t.minQty]));

  const types = Array.from(new Set([...DEFAULT_TYPES, ...thresholds.map((t) => t.type)]));
  return types.map((type) => {
    const inStock = countMap[type] || 0;
    const minQty = thMap[type] ?? 0;
    return {
      type,
      inStock,
      minQty,
      low: minQty > 0 && inStock < minQty,
    };
  });
}

/**
 * Verifica alertas e cria notificações para admins quando estoque está baixo.
 * Evita criar duplicata para o mesmo tipo nas últimas 24h.
 */
async function checkAndNotifyLowStock() {
  const report = await getStockReport();
  const low = report.filter((r) => r.low);
  if (!low.length) return { triggered: 0, items: [] };

  const admins = await User.find({ role: 'admin', active: true }).select('_id');
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const triggered = [];

  for (const item of low) {
    const tag = `LOW_STOCK:${item.type}`;
    // verifica se já notificou hoje
    const exists = await Notification.findOne({
      'meta.tag': tag,
      createdAt: { $gte: since },
    });
    if (exists) continue;

    const docs = admins.map((u) => ({
      user: u._id,
      title: `⚠️ Estoque baixo: ${item.type}`,
      message: `Restam ${item.inStock} unidade(s) em estoque (mínimo: ${item.minQty}).`,
      type: 'warning',
      link: '/equipamentos?status=em_estoque',
      meta: { tag, equipmentType: item.type },
    }));
    if (docs.length) {
      await Notification.insertMany(docs);
      triggered.push(item);
    }
  }
  return { triggered: triggered.length, items: triggered };
}

module.exports = { getStockReport, checkAndNotifyLowStock };

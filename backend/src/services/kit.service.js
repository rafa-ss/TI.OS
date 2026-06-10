const Kit = require('../models/Kit');
const AppError = require('../utils/AppError');
const labService = require('./laboratory.service');

/**
 * Normaliza a lista de kits selecionados que vem do frontend.
 * Formato esperado: [{ kit: <kitId>, quantity: N }]
 * Retorna: [{ kit: <kitId>, quantity: N }] (apenas válidos, quantity > 0).
 */
function normalizeKitSelection(kits = []) {
  return (kits || [])
    .map((k) => ({
      kit: k.kit || k.kitId || k._id || k.id,
      quantity: Math.max(0, Number(k.quantity) || 0),
    }))
    .filter((k) => k.kit && k.quantity > 0);
}

/**
 * "Explode" uma lista de kits selecionados em componentes individuais de estoque.
 *
 * @param {Array<{kit, quantity}>} selection - kits selecionados
 * @returns {Promise<{ components: Array<{type,condition,quantity}>, snapshots: Array }>}
 *   - components: lista plana já AGREGADA por (type|condition) com a quantidade total
 *   - snapshots:  registro do que foi montado (kit + nome + componentes), para
 *                 exibição no laboratório.
 */
async function expandKits(selection = []) {
  const norm = normalizeKitSelection(selection);
  if (norm.length === 0) return { components: [], snapshots: [] };

  const ids = norm.map((k) => k.kit);
  const kits = await Kit.find({ _id: { $in: ids } });
  const byId = new Map(kits.map((k) => [String(k._id), k]));

  // Agrega componentes por tipo+condição para o débito de estoque
  const acc = new Map(); // key: type|condition -> quantity
  const snapshots = [];

  for (const sel of norm) {
    const kit = byId.get(String(sel.kit));
    if (!kit) throw new AppError(`Kit não encontrado (id: ${sel.kit})`, 404);
    if (!kit.active) throw new AppError(`O kit "${kit.name}" está inativo e não pode ser usado`, 400);

    const snapComponents = [];
    for (const comp of kit.components) {
      const type = String(comp.type).toLowerCase().trim();
      const condition = comp.condition || 'novo';
      const qty = (Number(comp.quantityPerKit) || 1) * sel.quantity;
      const key = `${type}|${condition}`;
      acc.set(key, (acc.get(key) || 0) + qty);
      snapComponents.push({ type, condition, quantity: qty });
    }

    snapshots.push({
      kit: kit._id,
      slug: kit.slug,
      name: kit.name,
      quantity: sel.quantity,
      components: snapComponents,
    });
  }

  const components = Array.from(acc.entries()).map(([key, quantity]) => {
    const [type, condition] = key.split('|');
    return { type, condition, quantity };
  });

  return { components, snapshots };
}

/**
 * Combina componentes vindos de kits com equipamentos avulsos, agregando
 * por (type|condition). Retorna a lista final que representa o inventário
 * real do laboratório (a fonte da verdade para débito/estorno/termo).
 */
function mergeComponents(...lists) {
  const acc = new Map();
  for (const list of lists) {
    for (const e of list || []) {
      const type = String(e.type || '').toLowerCase().trim();
      const condition = e.condition || 'novo';
      const quantity = Number(e.quantity) || 0;
      if (!type || quantity <= 0) continue;
      const key = `${type}|${condition}`;
      acc.set(key, (acc.get(key) || 0) + quantity);
    }
  }
  return Array.from(acc.entries()).map(([key, quantity]) => {
    const [type, condition] = key.split('|');
    return { type, condition, quantity };
  });
}

/**
 * Valida se há estoque suficiente para um conjunto de componentes e, em caso
 * de falta, lança um AppError com a mensagem detalhada de quais itens faltam.
 */
async function ensureStock(components, contextMsg = 'Estoque insuficiente') {
  if (!components || components.length === 0) return;
  const check = await labService.checkAvailability(components);
  if (!check.ok) {
    const detalhe = check.missing
      .map((m) => `${m.type} (${m.condition}): faltam ${m.shortage} (pedido ${m.requested}, disponível ${m.available})`)
      .join(' · ');
    throw new AppError(`${contextMsg}: ${detalhe}`, 400, check.missing);
  }
}

module.exports = {
  normalizeKitSelection,
  expandKits,
  mergeComponents,
  ensureStock,
};

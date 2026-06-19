/**
 * Fila offline para CRIAÇÃO de Ordens de Serviço.
 *
 * Quando o usuário cria uma O.S. sem internet, o payload é guardado no
 * localStorage. Assim que a conexão volta (ou periodicamente), a fila é
 * enviada automaticamente ao servidor.
 *
 * Escopo intencionalmente restrito a CRIAÇÃO (sem edição offline) para
 * evitar conflitos de dados.
 */
import api from './api';

const STORAGE_KEY = 'tios_offline_orders';
const listeners = new Set();

function uid() {
  return `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Lê a fila do localStorage (sempre retorna array). */
export function getQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  emit();
}

/** Quantidade de O.S. pendentes na fila. */
export function pendingCount() {
  return getQueue().length;
}

/** Inscreve um listener para mudanças na fila. Retorna função de cancelamento. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  const count = pendingCount();
  listeners.forEach((fn) => {
    try { fn(count); } catch { /* ignore */ }
  });
}

/** Adiciona uma O.S. à fila offline. */
export function enqueueOrder(payload) {
  const queue = getQueue();
  const item = {
    _localId: uid(),
    payload,
    createdAt: new Date().toISOString(),
    tries: 0,
  };
  queue.push(item);
  saveQueue(queue);
  return item;
}

function removeFromQueue(localId) {
  saveQueue(getQueue().filter((i) => i._localId !== localId));
}

/** Heurística: o erro foi por falta de rede (e não erro de validação do servidor)? */
export function isNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  // axios: sem err.response normalmente = falha de rede / servidor inacessível
  if (err && !err.response) return true;
  const code = err?.code;
  if (code === 'ERR_NETWORK' || code === 'ECONNABORTED') return true;
  return false;
}

let syncing = false;

/**
 * Tenta enviar todas as O.S. pendentes ao servidor.
 * Retorna { sent, failed }.
 * - Itens com erro de REDE permanecem na fila (tenta de novo depois).
 * - Itens com erro de VALIDAÇÃO (4xx) são removidos para não travar a fila
 *   eternamente (o servidor rejeitou o conteúdo).
 */
export async function flushQueue() {
  if (syncing) return { sent: 0, failed: 0, skipped: true };
  const queue = getQueue();
  if (queue.length === 0) return { sent: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { sent: 0, failed: queue.length, offline: true };
  }

  syncing = true;
  let sent = 0;
  let failed = 0;

  try {
    for (const item of [...queue]) {
      try {
        await api.post('/orders', item.payload, { headers: { 'X-Offline-Sync': '1' } });
        removeFromQueue(item._localId);
        sent += 1;
      } catch (err) {
        if (isNetworkError(err)) {
          // Continua offline — para o loop, tenta tudo de novo na próxima.
          failed += 1;
          break;
        }
        // Erro do servidor (validação/duplicado): descarta para não travar a fila.
        const cur = getQueue().map((i) =>
          i._localId === item._localId ? { ...i, tries: (i.tries || 0) + 1, lastError: err?.response?.data?.message || 'Rejeitado pelo servidor' } : i
        );
        saveQueue(cur);
        // Se já tentou demais (servidor rejeita sempre), remove.
        const updated = getQueue().find((i) => i._localId === item._localId);
        if (updated && updated.tries >= 3) {
          removeFromQueue(item._localId);
        }
        failed += 1;
      }
    }
  } finally {
    syncing = false;
  }

  return { sent, failed };
}

/**
 * Controle de tentativas de login em memória (por e-mail).
 *
 * Regras:
 *  - Conta tentativas falhadas dentro de uma "janela" de 10 minutos
 *  - Após 5 falhas consecutivas, bloqueia o login daquele e-mail por 15 minutos
 *  - Login bem-sucedido limpa as tentativas
 *
 * Em produção com múltiplas instâncias, isso deveria estar no Redis —
 * mas para um sistema interno em 1 servidor, memória é suficiente e simples.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;   // 10 min para acumular tentativas
const LOCK_MS   = 15 * 60 * 1000;   // 15 min de bloqueio

// Map<email, { count, firstAt, lockedUntil }>
const attempts = new Map();

function _key(email) {
  return String(email || '').toLowerCase().trim();
}

/**
 * Verifica se a conta está bloqueada agora. Retorna { locked: bool, secondsLeft? }
 */
function getLockStatus(email) {
  const k = _key(email);
  const rec = attempts.get(k);
  if (!rec) return { locked: false };
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
    return {
      locked: true,
      secondsLeft: Math.ceil((rec.lockedUntil - Date.now()) / 1000),
    };
  }
  return { locked: false };
}

/**
 * Registra uma tentativa falhada. Retorna o número de tentativas e
 * se o bloqueio foi ativado nesta chamada.
 */
function registerFailure(email) {
  const k = _key(email);
  let rec = attempts.get(k);
  const now = Date.now();

  // Se passou a janela, reseta
  if (rec && now - rec.firstAt > WINDOW_MS) {
    rec = null;
  }

  if (!rec) {
    rec = { count: 0, firstAt: now, lockedUntil: 0 };
  }
  rec.count += 1;

  let justLocked = false;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOCK_MS;
    justLocked = true;
  }

  attempts.set(k, rec);
  return {
    count: rec.count,
    remaining: Math.max(0, MAX_ATTEMPTS - rec.count),
    justLocked,
    lockSeconds: rec.lockedUntil ? Math.ceil((rec.lockedUntil - now) / 1000) : 0,
  };
}

/**
 * Limpa as tentativas (após login bem-sucedido).
 */
function clear(email) {
  attempts.delete(_key(email));
}

/**
 * Limpeza periódica de registros expirados.
 */
setInterval(() => {
  const now = Date.now();
  for (const [k, rec] of attempts.entries()) {
    const expired =
      (rec.lockedUntil && rec.lockedUntil < now) ||
      (!rec.lockedUntil && now - rec.firstAt > WINDOW_MS);
    if (expired) attempts.delete(k);
  }
}, 60 * 1000).unref?.();

module.exports = {
  getLockStatus,
  registerFailure,
  clear,
  MAX_ATTEMPTS,
  LOCK_MS,
};
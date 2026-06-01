const env = require('./env');

/**
 * Lazy-load do cliente Supabase.
 * Só é instanciado quando o storage realmente é usado.
 * Retorna null se as credenciais não estiverem configuradas de verdade
 * (o storage cai pro fallback local automaticamente).
 */
let _client = null;

function isConfigured() {
  const url = env.SUPABASE_URL || '';
  const key = env.SUPABASE_SERVICE_KEY || '';
  // Considera não configurado se for placeholder ou string incompleta
  if (!url || !key) return false;
  if (url.includes('xxxxxxxx') || url.includes('xxxx')) return false;
  if (key.length < 30 || key.includes('...')) return false;
  return true;
}

function getSupabase() {
  if (_client) return _client;
  if (!isConfigured()) return null;

  try {
    const { createClient } = require('@supabase/supabase-js');
    _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 0 } },
    });
    return _client;
  } catch (err) {
    // Se o SDK falhar (ex.: Node antigo), volta pro fallback local
    return null;
  }
}

module.exports = getSupabase;
module.exports.getSupabase = getSupabase;

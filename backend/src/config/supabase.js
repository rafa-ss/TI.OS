const env = require('./env');

/**
 * Lazy-load do cliente Supabase.
 * Só é instanciado quando o storage realmente é usado, evitando travar o boot
 * em Node < 22 (problema do realtime-js sem WebSocket nativo).
 */
let _client = null;

function getSupabase() {
  if (_client) return _client;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return null;

  const { createClient } = require('@supabase/supabase-js');
  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 0 } },
  });
  return _client;
}

module.exports = getSupabase;
module.exports.getSupabase = getSupabase;

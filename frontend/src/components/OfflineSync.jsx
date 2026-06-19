import { useEffect, useState, useCallback } from 'react';
import { CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { flushQueue, pendingCount, subscribe } from '../services/offlineQueue';
import { useAuth } from '../context/AuthContext';

/**
 * Provider invisível que mantém a sincronização automática das O.S. criadas
 * offline. Também renderiza um indicador flutuante quando há pendências ou
 * quando o aparelho está offline.
 *
 * - Sincroniza ao voltar a conexão (evento 'online').
 * - Sincroniza periodicamente (a cada 30s) como rede de segurança.
 * - Sincroniza ao montar (caso tenha ficado algo da sessão anterior).
 */
export default function OfflineSync() {
  const { user } = useAuth();
  const [pending, setPending] = useState(pendingCount());
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  const doSync = useCallback(async (announce = false) => {
    if (pendingCount() === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    setSyncing(true);
    try {
      const { sent } = await flushQueue();
      if (sent > 0 && announce) {
        toast.success(`${sent} O.S. enviada(s) com sucesso ao servidor.`);
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  // Mantém o contador em sincronia com a fila
  useEffect(() => subscribe(setPending), []);

  // Eventos de conexão
  useEffect(() => {
    function goOnline() { setOnline(true); doSync(true); }
    function goOffline() { setOnline(false); }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [doSync]);

  // Sincroniza ao montar (sessão logada) e a cada 30s
  useEffect(() => {
    if (!user) return;
    doSync(false);
    const id = setInterval(() => doSync(true), 30000);
    return () => clearInterval(id);
  }, [user, doSync]);

  // Nada a mostrar quando online e sem pendências
  if (online && pending === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-1 w-[calc(100%-2rem)] sm:w-auto sm:left-auto sm:right-4 sm:translate-x-0">
      <div
        onClick={() => doSync(true)}
        title={pending > 0 ? 'Clique para tentar sincronizar agora' : undefined}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium cursor-pointer select-none
          ${!online
            ? 'bg-slate-800 text-white'
            : 'bg-amber-500 text-white'}`}
      >
        {!online ? (
          <>
            <CloudOff size={18} className="shrink-0" />
            <span>
              Sem conexão
              {pending > 0 && <> · <b>{pending}</b> O.S. aguardando envio</>}
            </span>
          </>
        ) : syncing ? (
          <>
            <RefreshCw size={18} className="shrink-0 animate-spin" />
            <span>Sincronizando {pending} O.S...</span>
          </>
        ) : (
          <>
            <RefreshCw size={18} className="shrink-0" />
            <span><b>{pending}</b> O.S. pendente(s) — toque para enviar</span>
          </>
        )}
      </div>
    </div>
  );
}

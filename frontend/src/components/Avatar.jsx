import { useState } from 'react';

/**
 * Avatar reutilizável.
 * - Se houver `src` válido (URL não-vazia), mostra a imagem.
 * - Se a imagem falhar ao carregar (erro de rede/permissão), faz fallback automático.
 * - Sem `src`: mostra a inicial colorida do nome.
 *
 * Cor de fallback baseada no role:
 *   admin     → vermelho
 *   tecnico   → azul
 *   atendente → amarelo
 */
export default function Avatar({ src, name = '', role, size = 40, className = '', ring = false }) {
  const [errored, setErrored] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();
  const colorClass =
    role === 'admin'     ? 'bg-pref-vermelho-500' :
    role === 'tecnico'   ? 'bg-pref-azul-500'     :
    role === 'atendente' ? 'bg-pref-amarelo-500'  :
    'bg-slate-500';

  const ringClass = ring ? 'ring-2 ring-white dark:ring-slate-900' : '';
  const sizePx = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  // Considera "válido" se for string não-vazia e não-erro
  const hasImage = !!src && typeof src === 'string' && src.length > 0 && !errored;

  if (hasImage) {
    return (
      <img
        src={src}
        alt={name}
        style={sizePx}
        className={`rounded-full object-cover shrink-0 ${ringClass} ${className}`}
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <div
      style={sizePx}
      className={`rounded-full text-white font-bold flex items-center justify-center shrink-0 ${colorClass} ${ringClass} ${className}`}
    >
      {initial}
    </div>
  );
}
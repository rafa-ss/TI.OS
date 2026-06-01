import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Check, X } from 'lucide-react';
import Modal from './Modal';

/**
 * Cropper de avatar circular (sem dependências externas).
 *
 * Mostra a imagem dentro de um quadrado com máscara circular.
 * O usuário pode:
 *  - arrastar a imagem para reposicionar
 *  - dar zoom in/out com slider ou botões
 *  - resetar
 * Ao confirmar, gera um PNG quadrado (256x256 por padrão) da área visível.
 */
export default function AvatarCropper({ file, open, onClose, onConfirm }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Tamanho da área visível (e do resultado final, em pixels CSS)
  const VIEW_SIZE = 280; // px na tela
  const OUTPUT_SIZE = 320; // px do PNG gerado

  useEffect(() => {
    if (!file) {
      setImgSrc(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result);
    reader.readAsDataURL(file);
    // reseta posição e zoom ao trocar de imagem
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [file]);

  function onImgLoad() {
    if (imgRef.current) {
      setNaturalSize({
        w: imgRef.current.naturalWidth,
        h: imgRef.current.naturalHeight,
      });
      // Centraliza a imagem inicial
      setOffset({ x: 0, y: 0 });
      // Zoom inicial: pelo menos cobre o quadrado
      const min = VIEW_SIZE / Math.min(imgRef.current.naturalWidth, imgRef.current.naturalHeight);
      setZoom(Math.max(1, min));
    }
  }

  // ===== drag =====
  function onMouseDown(e) {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }
  function onMouseMove(e) {
    if (!dragging || !dragStart) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }
  function onMouseUp() { setDragging(false); }
  function onTouchStart(e) {
    const t = e.touches[0];
    setDragging(true);
    setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y });
  }
  function onTouchMove(e) {
    if (!dragging || !dragStart) return;
    const t = e.touches[0];
    setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
  }

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [dragging]);

  function reset() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    if (imgRef.current) {
      const min = VIEW_SIZE / Math.min(naturalSize.w, naturalSize.h);
      setZoom(Math.max(1, min));
    }
  }

  // ===== gera o blob =====
  async function confirm() {
    if (!imgSrc) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');

    // Fundo branco (caso a imagem tenha transparência)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    // Máscara circular
    ctx.save();
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Carrega a imagem novamente pra ter HTMLImageElement limpo
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = rej;
      img.src = imgSrc;
    });

    // Mesmo zoom e offset da tela, mas escalados para OUTPUT_SIZE
    const scale = OUTPUT_SIZE / VIEW_SIZE;
    const drawW = img.naturalWidth * zoom * scale;
    const drawH = img.naturalHeight * zoom * scale;
    const cx = OUTPUT_SIZE / 2 + offset.x * scale;
    const cy = OUTPUT_SIZE / 2 + offset.y * scale;
    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
    ctx.restore();

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], 'avatar.png', { type: 'image/png' });
        onConfirm(croppedFile);
      }
    }, 'image/png', 0.92);
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustar foto de perfil"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">
            <X size={16}/> Cancelar
          </button>
          <button onClick={confirm} disabled={!imgSrc} className="btn-primary">
            <Check size={16}/> Aplicar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 text-center">
          Arraste a imagem para posicionar e use o controle para dar zoom.
        </p>

        {/* Área de recorte */}
        <div className="flex justify-center">
          <div
            ref={containerRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onMouseUp}
            style={{ width: VIEW_SIZE, height: VIEW_SIZE }}
            className="relative bg-slate-900 overflow-hidden rounded-2xl select-none cursor-grab active:cursor-grabbing shadow-inner"
          >
            {imgSrc && (
              <img
                ref={imgRef}
                src={imgSrc}
                alt="preview"
                onLoad={onImgLoad}
                draggable={false}
                style={{
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                  transformOrigin: 'center',
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  maxWidth: 'none',
                }}
              />
            )}
            {/* Máscara circular (sobreposta) */}
            <div className="absolute inset-0 pointer-events-none">
              <svg width="100%" height="100%" viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}>
                <defs>
                  <mask id="circle-mask">
                    <rect width={VIEW_SIZE} height={VIEW_SIZE} fill="white"/>
                    <circle cx={VIEW_SIZE/2} cy={VIEW_SIZE/2} r={VIEW_SIZE/2 - 4} fill="black"/>
                  </mask>
                </defs>
                <rect width={VIEW_SIZE} height={VIEW_SIZE} fill="rgba(0,0,0,0.55)" mask="url(#circle-mask)"/>
                <circle cx={VIEW_SIZE/2} cy={VIEW_SIZE/2} r={VIEW_SIZE/2 - 4}
                  fill="none" stroke="white" strokeWidth="2"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Controle de zoom */}
        <div className="flex items-center gap-3 px-4">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
            className="btn-ghost p-1.5" title="Diminuir zoom">
            <ZoomOut size={18}/>
          </button>
          <input
            type="range"
            min="0.5" max="3" step="0.01"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-pref-azul-600"
          />
          <button onClick={() => setZoom(z => Math.min(3, z + 0.1))}
            className="btn-ghost p-1.5" title="Aumentar zoom">
            <ZoomIn size={18}/>
          </button>
          <button onClick={reset} className="btn-ghost p-1.5" title="Resetar">
            <RotateCcw size={16}/>
          </button>
        </div>
      </div>
    </Modal>
  );
}

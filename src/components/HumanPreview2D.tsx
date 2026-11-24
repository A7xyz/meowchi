import { ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createCustomizedHumanCanvas } from '../engine/SpriteCustomizer';
import { HumanAppearance } from '../types/game';

interface HumanPreview2DProps {
  appearance: HumanAppearance;
  focusFace?: boolean;
}

/**
 * Animated 2D Chibi character preview canvas with live hair, skin, outfit & footwear
 * customization plus face zoom and animation toggle for the Human Creator & Wardrobe.
 */
export function HumanPreview2D({ appearance, focusFace = false }: HumanPreview2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoomed, setZoomed] = useState(focusFace);
  const [previewAction, setPreviewAction] = useState<'idle' | 'walk' | 'pet_cat'>('idle');
  const [sheetImg, setSheetImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setZoomed(focusFace);
  }, [focusFace]);

  useEffect(() => {
    let active = true;
    const img = new Image();
    img.src = `./sprites/human/${appearance.gender}/${previewAction}.png`;
    img.onload = () => {
      if (active) setSheetImg(img);
    };
    return () => {
      active = false;
    };
  }, [appearance.gender, previewAction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sheetImg) return;

    const customSheet = createCustomizedHumanCanvas(sheetImg, appearance, 256);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let frameIdx = 0;
    let lastSwap = performance.now();
    const fps = previewAction === 'walk' ? 11 : previewAction === 'pet_cat' ? 9 : 7;
    const intervalMs = 1000 / fps;

    const draw = (now: number) => {
      rafId = requestAnimationFrame(draw);
      if (now - lastSwap >= intervalMs) {
        frameIdx = (frameIdx + 1) % 8;
        lastSwap = now;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Soft cozy pedestal shadow
      if (!zoomed) {
        ctx.save();
        ctx.fillStyle = 'rgba(92, 68, 46, 0.16)';
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.9, 64, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const col = frameIdx % 4;
      const row = Math.floor(frameIdx / 4);
      const sx = col * 256;
      const sy = row * 256;

      const drawSize = zoomed ? 340 : 212;
      const anchorY = zoomed ? h * 1.46 : h * 0.94;

      ctx.save();
      ctx.drawImage(
        customSheet,
        sx,
        sy,
        256,
        256,
        (w - drawSize) * 0.5,
        anchorY - drawSize * 0.94,
        drawSize,
        drawSize
      );
      ctx.restore();
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [sheetImg, appearance, zoomed, previewAction]);

  return (
    <div
      style={{
        width: '100%',
        height: 225,
        borderRadius: 18,
        background: 'radial-gradient(circle at 50% 35%, #fdf8f0 0%, #e5d6c2 100%)',
        border: '1px solid rgba(139, 114, 92, 0.18)',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <canvas
        ref={canvasRef}
        width={340}
        height={225}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />

      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          display: 'flex',
          gap: 5
        }}
      >
        {(['idle', 'walk', 'pet_cat'] as const).map((act) => (
          <button
            key={act}
            type="button"
            className="chip-btn"
            onClick={() => setPreviewAction(act)}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              background:
                previewAction === act ? 'rgba(200, 122, 86, 0.92)' : 'rgba(255, 251, 245, 0.85)',
              color: previewAction === act ? '#fff' : '#4a3a2f',
              border: '1px solid rgba(139, 114, 92, 0.2)',
              borderRadius: 999,
              cursor: 'pointer'
            }}
          >
            {act === 'idle' ? 'Idle' : act === 'walk' ? 'Walk' : 'Pet'}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="icon-btn"
        onClick={() => setZoomed((z) => !z)}
        aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
        style={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          width: 32,
          height: 32
        }}
      >
        {zoomed ? <ZoomOut size={15} /> : <ZoomIn size={15} />}
      </button>
    </div>
  );
}

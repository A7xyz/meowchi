import { useEffect, useRef, useState } from 'react';
import { getBreedDefinition } from '../config/breeds';
import { createCustomizedCatCanvas } from '../engine/SpriteCustomizer';
import { CatIdentity } from '../types/game';

interface CatPreview2DProps {
  identity: CatIdentity;
}

/**
 * Animated 2D sprite preview canvas for the kitten adoption & breed customization screen.
 * Plays real sequential 8-frame idle animation with live breed morphology, fur color,
 * fur pattern, eye color, and accessory customization.
 */
export function CatPreview2D({ identity }: CatPreview2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sheetImg, setSheetImg] = useState<HTMLImageElement | null>(null);
  const [facingRight, setFacingRight] = useState(true);

  useEffect(() => {
    const img = new Image();
    img.src = './sprites/cat/idle.png';
    img.onload = () => setSheetImg(img);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sheetImg) return;

    const customSheet = createCustomizedCatCanvas(sheetImg, identity, 'baby_kitten', 256);
    const morph = getBreedDefinition(identity.breed).morphology;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let frameIdx = 0;
    let lastSwap = performance.now();
    const frameIntervalMs = 1000 / 7;

    const draw = (now: number) => {
      rafId = requestAnimationFrame(draw);
      if (now - lastSwap >= frameIntervalMs) {
        frameIdx = (frameIdx + 1) % 8;
        lastSwap = now;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Soft warm ground cushion shadow
      ctx.save();
      ctx.fillStyle = 'rgba(92, 68, 46, 0.16)';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.84, 72, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const col = frameIdx % 4;
      const row = Math.floor(frameIdx / 4);
      const sx = col * 256;
      const sy = row * 256;

      const scaleX = (morph.torsoLength > 1.05 ? 1.04 : 1.0) * (facingRight ? 1 : -1);
      const scaleY = morph.legLength < 0.72 ? 0.88 : 1.0;
      const drawSize = 196;

      ctx.save();
      ctx.translate(w * 0.5, h * 0.86);
      ctx.scale(scaleX, scaleY);
      ctx.drawImage(
        customSheet,
        sx,
        sy,
        256,
        256,
        -drawSize * 0.5,
        -drawSize * 0.9,
        drawSize,
        drawSize
      );
      ctx.restore();
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [sheetImg, identity, facingRight]);

  return (
    <div
      onClick={() => setFacingRight((v) => !v)}
      title="Tap to flip direction"
      style={{
        width: '100%',
        height: 190,
        borderRadius: 18,
        background: 'radial-gradient(circle at 50% 35%, #fdf8f0 0%, #e7d9c6 100%)',
        border: '1px solid rgba(139, 114, 92, 0.18)',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <canvas ref={canvasRef} width={320} height={190} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
}

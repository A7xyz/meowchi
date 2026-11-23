import * as THREE from 'three';
import { FurPattern } from '../types/game';

const textureCache = new Map<string, THREE.CanvasTexture>();

function createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function makeSeededRng(initialSeed: number): () => number {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/**
 * Generates an ultra-detailed directional feline fur coat texture with natural undercoat
 * tonal variation and 22,000+ fine tapered hair strands across all 7 realistic coat patterns.
 */
export function createFurTexture(
  primaryHex: string,
  secondaryHex: string,
  pattern: FurPattern
): THREE.CanvasTexture {
  const key = `fur_v3_${primaryHex}_${secondaryHex}_${pattern}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(512, 512);
  ctx.fillStyle = primaryHex;
  ctx.fillRect(0, 0, 512, 512);

  const rand = makeSeededRng(1337);

  // Soft natural undercoat tonal clouding so fur never looks flat or synthetic
  for (let i = 0; i < 40; i++) {
    const cx = rand() * 512;
    const cy = rand() * 512;
    const r = 35 + rand() * 65;
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    grad.addColorStop(0, rand() > 0.5 ? 'rgba(255,250,242,0.08)' : 'rgba(30,20,12,0.07)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (pattern === 'tabby') {
    // Soft feathered tabby mackerel stripes with organic fur-broken edges
    ctx.strokeStyle = secondaryHex;
    for (let i = 0; i < 20; i++) {
      ctx.globalAlpha = 0.42 + (i % 3) * 0.08;
      ctx.lineWidth = 8 + (i % 4) * 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const y = (i / 20) * 512;
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 24) {
        ctx.lineTo(x, y + Math.sin(x * 0.03 + i * 0.9) * 14);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'spotted') {
    for (let i = 0; i < 46; i++) {
      const cx = rand() * 480 + 16;
      const cy = rand() * 480 + 16;
      const rx = 13 + rand() * 14;
      const ry = 9 + rand() * 11;
      const grad = ctx.createRadialGradient(cx, cy, rx * 0.2, cx, cy, rx);
      grad.addColorStop(0, primaryHex);
      grad.addColorStop(0.55, secondaryHex);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'calico') {
    const patches = [
      { x: 110, y: 120, r: 98, c: secondaryHex },
      { x: 375, y: 145, r: 90, c: '#2e2927' },
      { x: 245, y: 360, r: 108, c: secondaryHex },
      { x: 425, y: 410, r: 78, c: '#2e2927' },
      { x: 75, y: 385, r: 70, c: '#2e2927' }
    ];
    for (const p of patches) {
      const grad = ctx.createRadialGradient(p.x, p.y, p.r * 0.25, p.x, p.y, p.r);
      grad.addColorStop(0, p.c);
      grad.addColorStop(0.78, p.c);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pattern === 'tortoiseshell') {
    for (let i = 0; i < 75; i++) {
      const cx = rand() * 512;
      const cy = rand() * 512;
      const r = 16 + rand() * 34;
      const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      const col = rand() > 0.36 ? secondaryHex : '#e6b274';
      grad.addColorStop(0, col);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'bicolor') {
    const grad = ctx.createLinearGradient(0, 265, 0, 512);
    grad.addColorStop(0, 'rgba(246,242,236,0)');
    grad.addColorStop(0.35, secondaryHex);
    grad.addColorStop(1, secondaryHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 260, 512, 252);
  } else if (pattern === 'colorpoint') {
    const grad = ctx.createRadialGradient(256, 256, 65, 256, 256, 330);
    grad.addColorStop(0, primaryHex);
    grad.addColorStop(1, '#d8c5ae');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
  }

  // Pass 1: Dense soft undercoat fur strokes
  for (let i = 0; i < 14000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 7 + rand() * 14;
    const drift = (rand() - 0.5) * 3.5;
    const bright = rand() > 0.46;
    ctx.strokeStyle = bright ? 'rgba(255,251,245,0.14)' : 'rgba(24,16,10,0.13)';
    ctx.lineWidth = 0.7 + rand() * 0.85;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + drift, y + len);
    ctx.stroke();
  }

  // Pass 2: Fine guard-hair highlights for realistic silky sheen & directional grain
  for (let i = 0; i < 8000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 10 + rand() * 16;
    const drift = (rand() - 0.5) * 2.5;
    ctx.strokeStyle = rand() > 0.35 ? 'rgba(255,253,248,0.16)' : 'rgba(20,14,10,0.11)';
    ctx.lineWidth = 0.45 + rand() * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + drift, y + len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Directional fine-strand bump map for feline fur so light breaks organically
 * across hair strands rather than reflecting like smooth plastic.
 */
export function createFurBumpTexture(): THREE.CanvasTexture {
  const key = 'fur_bump_v3';
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(256, 256);
  ctx.fillStyle = '#787878';
  ctx.fillRect(0, 0, 256, 256);

  const rand = makeSeededRng(9001);
  for (let i = 0; i < 7500; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const len = 6 + rand() * 12;
    const shade = Math.floor(80 + rand() * 145);
    ctx.strokeStyle = `rgba(${shade},${shade},${shade},0.48)`;
    ctx.lineWidth = 0.65 + rand() * 0.65;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 2, y + len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  textureCache.set(key, tex);
  return tex;
}

/**
 * Volumetric Fur Shell Alpha Texture (Shell & Fin real-time fur technique).
 * Layer index `0..totalLayers-1` tapers hair strand thickness & density from thick undercoat
 * at the base to ultra-fine gossamer tips at the outer silhouette!
 */
export function createFurShellAlphaTexture(
  layerIndex: number,
  totalLayers: number
): THREE.CanvasTexture {
  const key = `fur_shell_alpha_${layerIndex}_${totalLayers}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(256, 256);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 256);

  const heightNorm = (layerIndex + 1) / totalLayers; // 0.16 .. 1.0
  const rand = makeSeededRng(7717); // Identical seed across shells so strands align continuously!
  const strandCount = 3400;

  for (let i = 0; i < strandCount; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const maxHeight = 0.25 + rand() * 0.78;
    const baseRadius = 1.6 + rand() * 1.45;
    const combX = (rand() - 0.5) * 2.2;
    const combY = 2.6 + rand() * 3.2;

    if (heightNorm > maxHeight) continue;

    // Taper smoothly toward tip
    const t = heightNorm / maxHeight;
    const r = Math.max(0.45, baseRadius * (1 - t * 0.68));
    const sx = (x + combX * heightNorm * 2.2 + 256) % 256;
    const sy = (y + combY * heightNorm * 2.2 + 256) % 256;
    const alpha = Math.floor((1 - t * 0.35) * 255);

    ctx.fillStyle = `rgb(${alpha},${alpha},${alpha})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * 0.85, r * 1.35, 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.2, 3.2);
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generates an ultra-fine alpha-feathered feline fur tuft card texture (72 fine hair wisps)
 * for layered cheek ruffs, chest mane, belly fluff, ear furnishings, and plush tail plumes.
 */
export function createFurCardAlphaTexture(): THREE.CanvasTexture {
  const key = 'fur_card_alpha_v3';
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);

  const rand = makeSeededRng(5521);

  // Soft dense feathery core
  const core = ctx.createRadialGradient(64, 68, 4, 64, 64, 34);
  core.addColorStop(0, 'rgba(255,255,255,0.92)');
  core.addColorStop(0.65, 'rgba(255,255,255,0.45)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(64, 64, 34, 0, Math.PI * 2);
  ctx.fill();

  // 76 individual fine tapered hair strands fanning naturally outward
  for (let i = 0; i < 76; i++) {
    const angle = (i / 76) * Math.PI * 2 + (rand() - 0.5) * 0.14;
    const len = 36 + rand() * 24;
    const startR = 6 + rand() * 10;
    const x1 = 64 + Math.cos(angle) * startR;
    const y1 = 64 + Math.sin(angle) * startR;
    const x2 = 64 + Math.cos(angle) * len;
    const y2 = 64 + Math.sin(angle) * len;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.62)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6 + rand() * 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(
      (x1 + x2) * 0.5 + (rand() - 0.5) * 6,
      (y1 + y2) * 0.5 + (rand() - 0.5) * 6,
      x2,
      y2
    );
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  textureCache.set(key, tex);
  return tex;
}

/**
 * High-resolution realistic feline iris texture with radial fibrous stroma,
 * dark limbal ring, warm collarette glow, and subtle top eyelid occlusion.
 */
export function createFelineIrisTexture(eyeHex: string): THREE.CanvasTexture {
  const key = `feline_iris_${eyeHex}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(256, 256);
  const cx = 128;
  const cy = 128;
  const baseCol = new THREE.Color(eyeHex);
  const darkOuter = baseCol.clone().multiplyScalar(0.32).getStyle();
  const brightMid = baseCol.clone().lerp(new THREE.Color('#fff5d8'), 0.25).getStyle();
  const warmInner = baseCol.clone().lerp(new THREE.Color('#f6d482'), 0.45).getStyle();

  const rad = ctx.createRadialGradient(cx, cy, 18, cx, cy, 122);
  rad.addColorStop(0, warmInner);
  rad.addColorStop(0.35, brightMid);
  rad.addColorStop(0.78, eyeHex);
  rad.addColorStop(0.92, darkOuter);
  rad.addColorStop(1, '#121010');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, 256, 256);

  // Fine radial feline iris stroma fibers
  const rand = makeSeededRng(31415);
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2 + (rand() - 0.5) * 0.04;
    const r0 = 26 + rand() * 14;
    const r1 = 96 + rand() * 24;
    ctx.strokeStyle =
      rand() > 0.45 ? 'rgba(255,250,230,0.22)' : 'rgba(20,14,8,0.22)';
    ctx.lineWidth = 1.0 + rand() * 1.6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a + (rand() - 0.5) * 0.06) * r1, cy + Math.sin(a + (rand() - 0.5) * 0.06) * r1);
    ctx.stroke();
  }

  // Subtle top-lid ambient shadow for natural feline depth
  const lidShade = ctx.createLinearGradient(0, 0, 0, 128);
  lidShade.addColorStop(0, 'rgba(12,10,8,0.45)');
  lidShade.addColorStop(0.55, 'rgba(12,10,8,0.08)');
  lidShade.addColorStop(1, 'rgba(12,10,8,0)');
  ctx.fillStyle = lidShade;
  ctx.fillRect(0, 0, 256, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Pebbled feline nose leather (rhinarium) texture with subtle natural sheen variation.
 */
export function createCatNoseTexture(noseHex: string): THREE.CanvasTexture {
  const key = `cat_nose_${noseHex}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(128, 128);
  ctx.fillStyle = noseHex;
  ctx.fillRect(0, 0, 128, 128);

  const rand = makeSeededRng(2026);
  for (let i = 0; i < 420; i++) {
    const x = rand() * 128;
    const y = rand() * 128;
    const r = 1.2 + rand() * 2.2;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,240,238,0.16)' : 'rgba(40,18,18,0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Soft, smooth, seamless Chibi skin texture.
 * When `withFaceBlush` is true, paints adorable warm rosy cheek blushes seamlessly
 * onto the Chibi face UV region so cheeks glow softly with zero seam lines.
 */
export function createChibiSkinTexture(
  skinHex: string,
  withFaceBlush = false
): THREE.CanvasTexture {
  const key = `chibi_skin_${skinHex}_${withFaceBlush ? 'face' : 'body'}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(512, 512);
  ctx.fillStyle = skinHex;
  ctx.fillRect(0, 0, 512, 512);

  // Ultra-soft subtle porcelain warmth gradient
  const warm = ctx.createLinearGradient(0, 0, 0, 512);
  warm.addColorStop(0, 'rgba(255,248,242,0.06)');
  warm.addColorStop(0.5, 'rgba(255,240,232,0)');
  warm.addColorStop(1, 'rgba(195,120,100,0.07)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, 512, 512);

  if (withFaceBlush) {
    // On Three.js SphereGeometry UV, +Z front face sits around u = 0.25 (after rotating sphere -PI/2) or u = 0.75.
    // We orient our Chibi head UV so u = 0.5 is exact front face (+Z)!
    // Cheeks sit symmetrically around u = 0.415 and u = 0.585, v = 0.585!
    const drawBlush = (bx: number, by: number) => {
      const grad = ctx.createRadialGradient(bx, by, 4, bx, by, 44);
      grad.addColorStop(0, 'rgba(242, 132, 132, 0.36)');
      grad.addColorStop(0.55, 'rgba(244, 148, 142, 0.18)');
      grad.addColorStop(1, 'rgba(244, 148, 142, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(bx, by, 46, 30, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    drawBlush(512 * 0.42, 512 * 0.585);
    drawBlush(512 * 0.58, 512 * 0.585);

    // Subtle soft peach tip on nose center
    const noseGlow = ctx.createRadialGradient(256, 512 * 0.545, 2, 256, 512 * 0.545, 14);
    noseGlow.addColorStop(0, 'rgba(242, 152, 138, 0.18)');
    noseGlow.addColorStop(1, 'rgba(242, 152, 138, 0)');
    ctx.fillStyle = noseGlow;
    ctx.beginPath();
    ctx.arc(256, 512 * 0.545, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Glossy, expressive Chibi anime-style eye iris texture with deep upper gradient,
 * luminous lower crescent glow, delicate pupil, and crisp sparkle catchlights.
 */
export function createChibiEyeTexture(eyeHex: string): THREE.CanvasTexture {
  const key = `chibi_eye_${eyeHex}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(256, 256);
  const base = new THREE.Color(eyeHex);
  const deepTop = base.clone().multiplyScalar(0.32).getStyle();
  const brightBottom = base.clone().lerp(new THREE.Color('#fff1d2'), 0.48).getStyle();
  const rimDark = base.clone().multiplyScalar(0.22).getStyle();

  // Smooth white sclera background around oval iris
  ctx.fillStyle = '#fdfbf8';
  ctx.fillRect(0, 0, 256, 256);

  // Outer iris circle
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(128, 132, 92, 98, 0, 0, Math.PI * 2);
  ctx.clip();

  const grad = ctx.createLinearGradient(0, 34, 0, 230);
  grad.addColorStop(0, deepTop);
  grad.addColorStop(0.42, eyeHex);
  grad.addColorStop(0.82, brightBottom);
  grad.addColorStop(1, eyeHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Luminous crescent highlight in lower iris
  const glow = ctx.createRadialGradient(128, 178, 8, 128, 178, 62);
  glow.addColorStop(0, 'rgba(255, 252, 236, 0.72)');
  glow.addColorStop(0.6, 'rgba(255, 245, 220, 0.22)');
  glow.addColorStop(1, 'rgba(255, 245, 220, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(128, 178, 66, 44, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft dark central pupil
  ctx.fillStyle = '#1c1412';
  ctx.beginPath();
  ctx.ellipse(128, 130, 38, 42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dark upper eyelid shadow inside iris
  const upperShadow = ctx.createLinearGradient(0, 30, 0, 125);
  upperShadow.addColorStop(0, 'rgba(18, 12, 10, 0.65)');
  upperShadow.addColorStop(1, 'rgba(18, 12, 10, 0)');
  ctx.fillStyle = upperShadow;
  ctx.fillRect(0, 0, 256, 125);

  // Outer iris limbal rim
  ctx.strokeStyle = rimDark;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(128, 132, 88, 94, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Crisp glossy double sparkle catchlights (signature adorable Chibi eyes!)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(92, 92, 24, 20, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(162, 166, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(76, 126, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Silky brushed Chibi hair texture with delicate strand lines and soft glossy sheen band.
 */
export function createChibiHairTexture(hairHex: string): THREE.CanvasTexture {
  const key = `chibi_hair_${hairHex}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(256, 256);
  ctx.fillStyle = hairHex;
  ctx.fillRect(0, 0, 256, 256);

  const rand = makeSeededRng(8844);
  for (let i = 0; i < 620; i++) {
    const x = rand() * 256;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(255,248,240,0.11)' : 'rgba(18,12,8,0.14)';
    ctx.lineWidth = 0.8 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (rand() - 0.5) * 8, 85, x + (rand() - 0.5) * 8, 170, x, 256);
    ctx.stroke();
  }

  // Soft anime hair angel-ring sheen band
  const sheen = ctx.createLinearGradient(0, 72, 0, 124);
  sheen.addColorStop(0, 'rgba(255,250,245,0)');
  sheen.addColorStop(0.5, 'rgba(255,250,245,0.22)');
  sheen.addColorStop(1, 'rgba(255,250,245,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 72, 256, 52);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Cozy textured Chibi clothing material map (soft knit, subtle plaid, or fine cotton).
 */
export function createChibiOutfitTexture(
  baseHex: string,
  variant: 'knit' | 'plaid' | 'cotton'
): THREE.CanvasTexture {
  const key = `chibi_outfit_${baseHex}_${variant}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  if (variant === 'knit') {
    for (let y = 0; y < 256; y += 12) {
      for (let x = 0; x < 256; x += 12) {
        ctx.strokeStyle = 'rgba(255,255,255,0.11)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2);
        ctx.lineTo(x + 6, y + 9);
        ctx.lineTo(x + 10, y + 2);
        ctx.stroke();
      }
    }
  } else if (variant === 'plaid') {
    ctx.fillStyle = 'rgba(255,250,245,0.22)';
    for (let i = 0; i < 256; i += 44) {
      ctx.fillRect(i, 0, 12, 256);
      ctx.fillRect(0, i, 256, 12);
    }
    ctx.fillStyle = 'rgba(45,28,22,0.16)';
    for (let i = 20; i < 256; i += 44) {
      ctx.fillRect(i, 0, 4, 256);
      ctx.fillRect(0, i, 256, 4);
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < 256; y += 6) ctx.fillRect(0, y, 256, 1);
    ctx.fillStyle = 'rgba(30,22,16,0.05)';
    for (let x = 0; x < 256; x += 6) ctx.fillRect(x, 0, 1, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.5, 2.5);
  textureCache.set(key, tex);
  return tex;
}

export function createWoodFloorTexture(): THREE.CanvasTexture {
  const key = 'wood_floor_oak';
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(512, 512);
  ctx.fillStyle = '#c89f74';
  ctx.fillRect(0, 0, 512, 512);

  const plankRows = 8;
  const plankH = 512 / plankRows;

  for (let r = 0; r < plankRows; r++) {
    const y = r * plankH;
    const shadeOffset = ((r * 37) % 18) - 9;
    ctx.fillStyle = `rgb(${198 + shadeOffset}, ${156 + shadeOffset}, ${112 + shadeOffset})`;
    ctx.fillRect(0, y, 512, plankH - 2);

    ctx.strokeStyle = 'rgba(110, 72, 38, 0.14)';
    ctx.lineWidth = 1.4;
    for (let g = 0; g < 14; g++) {
      const gy = y + 4 + (g / 14) * (plankH - 8);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(170, gy + ((r + g) % 3) - 1, 340, gy - ((r + g) % 3) + 1, 512, gy);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(85, 56, 32, 0.35)';
    ctx.fillRect(0, y + plankH - 2, 512, 2);

    const jointX = ((r * 173 + 90) % 420) + 40;
    ctx.fillRect(jointX, y, 2, plankH);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.2, 3.2);
  textureCache.set(key, tex);
  return tex;
}

export function createWovenFabricTexture(baseHex: string): THREE.CanvasTexture {
  const key = `fabric_${baseHex}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 0; y < 256; y += 6) {
    ctx.fillRect(0, y, 256, 2);
  }
  ctx.fillStyle = 'rgba(40,30,20,0.06)';
  for (let x = 0; x < 256; x += 6) {
    ctx.fillRect(x, 0, 2, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  textureCache.set(key, tex);
  return tex;
}

export function createSisalTexture(): THREE.CanvasTexture {
  const key = 'sisal_rope';
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(256, 256);
  ctx.fillStyle = '#c8aa7e';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 8) {
    ctx.fillStyle = y % 16 === 0 ? 'rgba(130, 96, 54, 0.25)' : 'rgba(255, 240, 210, 0.18)';
    ctx.fillRect(0, y, 256, 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 6);
  textureCache.set(key, tex);
  return tex;
}

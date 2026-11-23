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

/**
 * Generates an organic directional fur coat texture supporting all 7 patterns:
 * solid, tabby, bicolor, tortoiseshell, calico, colorpoint, and spotted (rosette).
 */
export function createFurTexture(
  primaryHex: string,
  secondaryHex: string,
  pattern: FurPattern
): THREE.CanvasTexture {
  const key = `fur_v2_${primaryHex}_${secondaryHex}_${pattern}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(512, 512);
  ctx.fillStyle = primaryHex;
  ctx.fillRect(0, 0, 512, 512);

  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  if (pattern === 'tabby') {
    ctx.strokeStyle = secondaryHex;
    ctx.globalAlpha = 0.52;
    for (let i = 0; i < 18; i++) {
      ctx.lineWidth = 9 + (i % 3) * 5;
      ctx.beginPath();
      const y = (i / 18) * 512;
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 28) {
        ctx.lineTo(x, y + Math.sin(x * 0.032 + i) * 14);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'spotted') {
    // Bengal-inspired soft rosettes & spots
    for (let i = 0; i < 42; i++) {
      const cx = rand() * 480 + 16;
      const cy = rand() * 480 + 16;
      const rx = 14 + rand() * 14;
      const ry = 10 + rand() * 12;
      ctx.fillStyle = secondaryHex;
      ctx.globalAlpha = 0.68;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      // Lighter inner rosette core
      ctx.fillStyle = primaryHex;
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'calico') {
    const patches = [
      { x: 110, y: 120, r: 95, c: secondaryHex },
      { x: 370, y: 150, r: 88, c: '#302b29' },
      { x: 240, y: 360, r: 105, c: secondaryHex },
      { x: 420, y: 410, r: 75, c: '#302b29' },
      { x: 75, y: 380, r: 68, c: '#302b29' }
    ];
    for (const p of patches) {
      const grad = ctx.createRadialGradient(p.x, p.y, p.r * 0.25, p.x, p.y, p.r);
      grad.addColorStop(0, p.c);
      grad.addColorStop(0.82, p.c);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pattern === 'tortoiseshell') {
    for (let i = 0; i < 65; i++) {
      const cx = rand() * 512;
      const cy = rand() * 512;
      const r = 18 + rand() * 34;
      const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      const col = rand() > 0.35 ? secondaryHex : '#e6b274';
      grad.addColorStop(0, col);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'bicolor') {
    const grad = ctx.createLinearGradient(0, 285, 0, 512);
    grad.addColorStop(0, 'rgba(246,242,236,0)');
    grad.addColorStop(0.38, secondaryHex);
    grad.addColorStop(1, secondaryHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 280, 512, 232);
  } else if (pattern === 'colorpoint') {
    const grad = ctx.createRadialGradient(256, 256, 70, 256, 256, 320);
    grad.addColorStop(0, primaryHex);
    grad.addColorStop(1, '#d8c5ae');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
  }

  // Dense multi-tone fine fur strands for soft velvety realism
  for (let i = 0; i < 11000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 6 + rand() * 12;
    const bright = rand() > 0.48;
    ctx.strokeStyle = bright ? 'rgba(255,250,244,0.12)' : 'rgba(22,15,10,0.11)';
    ctx.lineWidth = 0.8 + rand() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 4, y + len);
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
 * Generates an alpha-feathered fur-strand card texture used on layered
 * cheek ruffs, chest fluff, belly fur, ear tufts, and fluffy tails.
 */
export function createFurCardAlphaTexture(): THREE.CanvasTexture {
  const key = 'fur_card_alpha';
  const cached = textureCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);

  // Soft feathery clump of fur strands fanning outward
  for (let i = 0; i < 42; i++) {
    const angle = (i / 42) * Math.PI * 2;
    const len = 34 + (i % 5) * 6;
    const x2 = 64 + Math.cos(angle) * len;
    const y2 = 64 + Math.sin(angle) * len;
    const grad = ctx.createLinearGradient(64, 64, x2, y2);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.65, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 5 + (i % 3) * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
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

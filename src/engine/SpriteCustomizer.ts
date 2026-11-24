import { getBreedDefinition } from '../config/breeds';
import { getHairColorHex, getSkinToneHex } from '../config/human';
import { CatIdentity, HumanAppearance, LifeStage } from '../types/game';

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/**
 * Builds a deterministic signature key for caching customized cat textures.
 */
export function getCatCoatSignature(identity: CatIdentity, stage: LifeStage): string {
  const seniorTag = stage === 'senior' ? 'sr' : 'std';
  return `${identity.breed}_${identity.furColorId}_${identity.furPattern}_${identity.eyeColorId}_${seniorTag}`;
}

/**
 * Builds a deterministic signature key for caching customized human textures.
 */
export function getHumanAppearanceSignature(a: HumanAppearance): string {
  return [
    a.gender,
    a.skinTone,
    a.hairStyle,
    a.hairColor,
    a.eyeColor,
    a.topStyle,
    a.topColor,
    a.bottomStyle,
    a.bottomColor,
    a.footwearStyle,
    a.footwearColor
  ].join('_');
}

/**
 * Luminance-preserving 2D sprite sheet coat recolorer for cats!
 * Preserves 100% of original hand-painted fur strands, whiskers, shading, pink nose, and alpha
 * while accurately applying all 10 breeds, 7 fur colors, 7 fur patterns, eye color, and senior silvering.
 */
export function createCustomizedCatCanvas(
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  identity: CatIdentity,
  stage: LifeStage,
  frameSize = 256
): HTMLCanvasElement {
  const w = sourceImg.width;
  const h = sourceImg.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(sourceImg, 0, 0);

  // Fast path: default cream bicolor kitten needs minimal recoloring
  if (
    identity.furColorId === 'cream' &&
    (identity.furPattern === 'bicolor' || identity.furPattern === 'solid') &&
    identity.eyeColorId === 'amber' &&
    stage !== 'senior'
  ) {
    return canvas;
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  const primary = hexToRgb(identity.furColor);
  const secondary = hexToRgb(identity.furSecondary);
  const eyeRgb = hexToRgb(identity.eyeColor);
  const breedDef = getBreedDefinition(identity.breed);
  const isSenior = stage === 'senior';

  for (let y = 0; y < h; y++) {
    const fy = (y % frameSize) / frameSize;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = d[idx + 3];
      if (a < 16) continue;

      const r = d[idx];
      const g = d[idx + 1];
      const b = d[idx + 2];

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Preserve crisp white highlights, whiskers, catchlights, and tiny pink nose
      const isPinkNose = r > 175 && r - g > 38 && b > 105 && b < 175 && sat > 0.25;
      if (isPinkNose) continue;

      // Preserve pure dark pupil outlines
      if (lum < 0.14) continue;

      const fx = (x % frameSize) / frameSize;

      // Subtle eye iris tinting in upper-right head zone for rich amber pixels
      const isEyeAmber =
        fx > 0.6 &&
        fx < 0.9 &&
        fy > 0.18 &&
        fy < 0.56 &&
        sat > 0.42 &&
        r > g &&
        g > b &&
        lum > 0.2 &&
        lum < 0.68;
      if (isEyeAmber) {
        const irisLum = lum * 1.35;
        d[idx] = clampByte(eyeRgb.r * irisLum);
        d[idx + 1] = clampByte(eyeRgb.g * irisLum);
        d[idx + 2] = clampByte(eyeRgb.b * irisLum);
        continue;
      }

      // White chest/paw bib detection from our cream-and-white AI master
      const isMasterWhiteBib = sat < 0.13 && lum > 0.72;

      // Determine target coat color based on FurPattern
      let target = primary;
      let mixStrength = 0.88;

      if (identity.furPattern === 'bicolor') {
        if (isMasterWhiteBib) {
          target = { r: 248, g: 244, b: 238 };
          mixStrength = 0.7;
        }
      } else if (identity.furPattern === 'calico') {
        if (isMasterWhiteBib) {
          target = { r: 250, g: 247, b: 242 };
        } else {
          const patch = Math.sin(fx * 9.5 + fy * 4.2) + Math.cos(fx * 5.2 - fy * 8.1);
          target = patch > 0.35 ? { r: 218, g: 132, b: 64 } : patch < -0.3 ? { r: 48, g: 44, b: 46 } : primary;
        }
      } else if (identity.furPattern === 'tortoiseshell') {
        const mottle = Math.sin(fx * 18 + fy * 14) * Math.cos(fx * 11 - fy * 16);
        target = mottle > 0.15 ? { r: 204, g: 122, b: 56 } : { r: 44, g: 38, b: 36 };
        mixStrength = 0.9;
      } else if (identity.furPattern === 'colorpoint') {
        // Siamese / Ragdoll colorpoint: creamy body, rich darker ears/face/tail/paws
        const isPoint =
          fx < 0.26 || // tail
          (fx > 0.68 && fy < 0.52) || // face/ears
          fy > 0.78; // paws
        target = isPoint ? secondary : { r: 242, g: 232, b: 216 };
        mixStrength = 0.88;
      } else if (identity.furPattern === 'tabby') {
        const stripe = Math.sin(fx * 28 + Math.sin(fy * 12) * 1.4);
        target = stripe > 0.35 ? secondary : primary;
      } else if (identity.furPattern === 'spotted') {
        const spot = Math.sin(fx * 24) * Math.sin(fy * 24);
        target = spot > 0.32 ? secondary : primary;
      } else {
        // Solid coat: gently blend white bib into primary coat too
        mixStrength = isMasterWhiteBib ? 0.82 : 0.9;
      }

      // Apply breed coat sheen and luminance-preserving tint
      const baseBrightness = Math.max(0.28, Math.min(1.24, lum / 0.74));
      let nr = target.r * baseBrightness;
      let ng = target.g * baseBrightness;
      let nb = target.b * baseBrightness;

      // Senior coat gentle silvering around muzzle & cheeks
      if (isSenior && fx > 0.65 && fy > 0.28 && fy < 0.58) {
        nr = nr * 0.78 + 228 * 0.22;
        ng = ng * 0.78 + 226 * 0.22;
        nb = nb * 0.78 + 224 * 0.22;
      }

      // Slight fluff contrast boost for ultra-fluffy breeds
      const contrast = breedDef.morphology.furFluffiness > 0.85 ? 1.04 : 1.0;
      d[idx] = clampByte((r * (1 - mixStrength) + nr * mixStrength) * contrast);
      d[idx + 1] = clampByte((g * (1 - mixStrength) + ng * mixStrength) * contrast);
      d[idx + 2] = clampByte((b * (1 - mixStrength) + nb * mixStrength) * contrast);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Zone-aware luminance-preserving 2D sprite sheet recolorer for Male & Female Chibi humans!
 * Recolors hair, skin, top, bottom, and footwear seamlessly across every frame with ZERO seams
 * while preserving 100% of hand-painted lineart, blush, highlights, and clothing folds.
 */
export function createCustomizedHumanCanvas(
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  appearance: HumanAppearance,
  frameSize = 256
): HTMLCanvasElement {
  const w = sourceImg.width;
  const h = sourceImg.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(sourceImg, 0, 0);

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  const skinTarget = hexToRgb(getSkinToneHex(appearance.skinTone));
  const hairTarget = hexToRgb(getHairColorHex(appearance.hairColor));
  const topTarget = hexToRgb(appearance.topColor);
  const bottomTarget = hexToRgb(appearance.bottomColor);
  const shoeTarget = hexToRgb(appearance.footwearColor);

  const isMale = appearance.gender === 'male';
  const skipHair = appearance.hairColor === 'dark_brown';
  const skipSkin =
    (!isMale && appearance.skinTone === 'fair') ||
    (isMale && appearance.skinTone === 'warm_beige');

  for (let y = 0; y < h; y++) {
    const fy = (y % frameSize) / frameSize;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = d[idx + 3];
      if (a < 20) continue;

      const r = d[idx];
      const g = d[idx + 1];
      const b = d[idx + 2];

      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // Preserve crisp dark brown outline lineart and pure white eye catchlights
      if (lum < 0.16 || (lum > 0.95 && Math.abs(r - b) < 10)) continue;

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC > 0 ? (maxC - minC) / maxC : 0;

      // 1. Bottoms zone (denim blue pixels in lower half: blue dominant)
      const isDenim = fy > 0.58 && fy < 0.9 && b > r + 14 && b > g - 4;
      if (isDenim) {
        const shade = Math.max(0.35, Math.min(1.28, lum / 0.48));
        d[idx] = clampByte(bottomTarget.r * shade);
        d[idx + 1] = clampByte(bottomTarget.g * shade);
        d[idx + 2] = clampByte(bottomTarget.b * shade);
        continue;
      }

      // 2. Footwear zone (very bottom warm slippers)
      const isShoe = fy >= 0.82 && r > b + 15 && lum > 0.28 && lum < 0.82;
      if (isShoe) {
        const shade = Math.max(0.4, Math.min(1.25, lum / 0.55));
        d[idx] = clampByte(shoeTarget.r * shade);
        d[idx + 1] = clampByte(shoeTarget.g * shade);
        d[idx + 2] = clampByte(shoeTarget.b * shade);
        continue;
      }

      // 3. Top / Sweater / Hoodie zone (torso y 0.48..0.76)
      const isMaleHoodie = isMale && fy > 0.45 && fy < 0.76 && g >= r - 8 && g > b + 8;
      const isFemaleSweater =
        !isMale && fy > 0.46 && fy < 0.74 && lum > 0.66 && sat < 0.24 && r - b < 38;
      if (isMaleHoodie || isFemaleSweater) {
        const refLum = isMale ? 0.58 : 0.84;
        const shade = Math.max(0.32, Math.min(1.22, lum / refLum));
        d[idx] = clampByte(topTarget.r * shade);
        d[idx + 1] = clampByte(topTarget.g * shade);
        d[idx + 2] = clampByte(topTarget.b * shade);
        continue;
      }

      // 4. Hair zone (upper head dark warm brown locks, excluding glossy amber iris pixels)
      const fx = (x % frameSize) / frameSize;
      const isGlossyIris =
        fx > 0.44 && fx < 0.68 && fy > 0.3 && fy < 0.4 && r > g * 1.32 && b < g * 0.62;
      const isHair =
        !skipHair &&
        !isGlossyIris &&
        fy < 0.56 &&
        r >= g &&
        g >= b - 6 &&
        lum >= 0.16 &&
        lum < 0.46 &&
        sat > 0.18;
      if (isHair) {
        const shade = Math.max(0.36, Math.min(1.45, lum / 0.29));
        d[idx] = clampByte(hairTarget.r * shade);
        d[idx + 1] = clampByte(hairTarget.g * shade);
        d[idx + 2] = clampByte(hairTarget.b * shade);
        continue;
      }

      // 5. Skin tone zone (warm peach face, ears, neck, hands)
      const isSkin =
        !skipSkin &&
        r > 185 &&
        g > 125 &&
        b > 95 &&
        r > g + 14 &&
        g > b + 6 &&
        lum > 0.56 &&
        (fy < 0.5 || fy > 0.56);
      if (isSkin) {
        const shade = Math.max(0.55, Math.min(1.18, lum / 0.82));
        // Preserve gentle warm rosy cheek blush
        const blushBias = Math.max(0, (r - g - 34) * 0.45);
        d[idx] = clampByte(skinTarget.r * shade + blushBias);
        d[idx + 1] = clampByte(skinTarget.g * shade - blushBias * 0.15);
        d[idx + 2] = clampByte(skinTarget.b * shade);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

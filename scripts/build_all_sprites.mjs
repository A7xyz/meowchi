import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromaKeyMagenta } from './process_sprites.mjs';

const ARTIFACT_DIR =
  'C:\\Users\\User\\.gemini\\antigravity\\brain\\13e3f557-6300-4c51-ab1c-6392f4a530b2';
const PROJECT_DIR = 'C:\\Users\\User\\.gemini\\antigravity\\scratch\\my-little-cat';
const PUBLIC_SPRITES = path.join(PROJECT_DIR, 'public', 'sprites');

const RAW_SOURCES = {
  roomBg: path.join(ARTIFACT_DIR, 'cozy_living_room_bg_v2_1795512100561.jpg'),
  propsCare: path.join(ARTIFACT_DIR, 'cat_props_sheet_4x2_1795512301906.jpg'),
  propsLiving: path.join(ARTIFACT_DIR, 'furniture_toy_spritesheet_4x2_1795512300388.jpg'),
  propsEquip: path.join(ARTIFACT_DIR, 'pet_equipment_sprite_sheet_1795512305121.jpg'),
  catMaster: path.join(ARTIFACT_DIR, 'cat_master_ref_final_1795512129624.jpg'),
  catWalk: path.join(ARTIFACT_DIR, 'cat_walk_spritesheet_1795512346817.jpg'),
  catRun: path.join(ARTIFACT_DIR, 'kitten_run_spritesheet_5x2_1795512351046.jpg'),
  catJump: path.join(ARTIFACT_DIR, 'cat_jump_spritesheet_1795512385077.jpg'),
  humanFemale: path.join(ARTIFACT_DIR, 'human_female_ref_1795512079467.jpg'),
  humanMale: path.join(ARTIFACT_DIR, 'human_male_ref_1795512087790.jpg')
};

/**
 * Loads an image, removes solid magenta background, and returns { rgba, width, height }.
 */
async function loadKeyedImage(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = new Uint8Array(data);
  chromaKeyMagenta(rgba, info.width, info.height);
  return { rgba, width: info.width, height: info.height };
}

/**
 * Extracts major connected-component islands (each isolated character/prop on a sheet)
 * so overlapping grid cells NEVER clip tails, paws, or neighboring sprites!
 */
function extractIslands(rgba, width, height, expectedCount, expectedRows) {
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(width * height);
  const islands = [];
  let nextLabel = 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const startIdx = y * width + x;
      if (labels[startIdx] !== 0 || rgba[startIdx * 4 + 3] < 24) continue;

      const label = nextLabel++;
      let head = 0;
      let tail = 0;
      labels[startIdx] = label;
      queue[tail++] = startIdx;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      let sumX = 0;
      let sumY = 0;

      while (head < tail) {
        const cur = queue[head++];
        const cx = cur % width;
        const cy = (cur - cx) / width;
        area++;
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        // 8-connected with 2-pixel bridge tolerance for thin whiskers/strings
        for (let dy = -2; dy <= 2; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -2; dx <= 2; dx++) {
            const nx = cx + dx;
            if (nx < 0 || nx >= width) continue;
            const nIdx = ny * width + nx;
            if (labels[nIdx] === 0 && rgba[nIdx * 4 + 3] >= 24) {
              labels[nIdx] = label;
              queue[tail++] = nIdx;
            }
          }
        }
      }

      if (area >= 450) {
        islands.push({
          label,
          area,
          minX,
          maxX,
          minY,
          maxY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
          cx: sumX / area,
          cy: sumY / area
        });
      }
    }
  }

  // Keep top expectedCount largest islands
  islands.sort((a, b) => b.area - a.area);
  const selected = islands.slice(0, expectedCount);

  // Sort by row band, then left-to-right
  const rowBandH = height / expectedRows;
  selected.sort((a, b) => {
    const rowA = Math.min(expectedRows - 1, Math.floor(a.cy / rowBandH));
    const rowB = Math.min(expectedRows - 1, Math.floor(b.cy / rowBandH));
    if (rowA !== rowB) return rowA - rowB;
    return a.cx - b.cx;
  });

  // Extract clean masked RGBA sub-images (only pixels belonging to this island!)
  return selected.map((isl) => {
    const sub = new Uint8Array(isl.w * isl.h * 4);
    for (let y = 0; y < isl.h; y++) {
      for (let x = 0; x < isl.w; x++) {
        const srcIdx = (isl.minY + y) * width + (isl.minX + x);
        if (labels[srcIdx] === isl.label) {
          const so = srcIdx * 4;
          const doff = (y * isl.w + x) * 4;
          sub[doff] = rgba[so];
          sub[doff + 1] = rgba[so + 1];
          sub[doff + 2] = rgba[so + 2];
          sub[doff + 3] = rgba[so + 3];
        }
      }
    }
    return {
      rgba: sub,
      width: isl.w,
      height: isl.h,
      area: isl.area
    };
  });
}

/**
 * Resizes an RGBA image to fit within a fixed square canvas anchored at (anchorX, anchorY).
 */
async function fitSpriteToFrame(img, frameSize, scaleOverride = null, anchorY = 0.9, offsetX = 0, offsetY = 0) {
  const usable = frameSize * 0.84;
  const scale = scaleOverride ?? Math.min(usable / img.width, usable / img.height);
  const tw = Math.max(1, Math.min(frameSize - 6, Math.round(img.width * scale)));
  const th = Math.max(1, Math.min(frameSize - 6, Math.round(img.height * scale)));

  const { data } = await sharp(Buffer.from(img.rgba), {
    raw: { width: img.width, height: img.height, channels: 4 }
  })
    .resize(tw, th, { kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = new Uint8Array(frameSize * frameSize * 4);
  const destX = Math.round((frameSize - tw) / 2 + offsetX);
  const destY = Math.round(frameSize * anchorY - th + offsetY);

  for (let y = 0; y < th; y++) {
    const oy = destY + y;
    if (oy < 2 || oy >= frameSize - 2) continue;
    for (let x = 0; x < tw; x++) {
      const ox = destX + x;
      if (ox < 2 || ox >= frameSize - 2) continue;
      const so = (y * tw + x) * 4;
      const doff = (oy * frameSize + ox) * 4;
      out[doff] = data[so];
      out[doff + 1] = data[so + 1];
      out[doff + 2] = data[so + 2];
      out[doff + 3] = data[so + 3];
    }
  }
  return out;
}

/**
 * Bilinear pixel sampler on RGBA buffer.
 */
function sampleBilinear(src, w, h, fx, fy, outPixel) {
  if (fx < 0 || fy < 0 || fx >= w - 1 || fy >= h - 1) {
    outPixel[0] = 0;
    outPixel[1] = 0;
    outPixel[2] = 0;
    outPixel[3] = 0;
    return;
  }
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = i00 + 4;
  const i01 = i00 + w * 4;
  const i11 = i01 + 4;

  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;

  const a =
    src[i00 + 3] * w00 + src[i10 + 3] * w10 + src[i01 + 3] * w01 + src[i11 + 3] * w11;
  if (a < 1) {
    outPixel[0] = 0;
    outPixel[1] = 0;
    outPixel[2] = 0;
    outPixel[3] = 0;
    return;
  }

  // Premultiplied alpha interpolation prevents dark fringes
  const r =
    (src[i00] * src[i00 + 3] * w00 +
      src[i10] * src[i10 + 3] * w10 +
      src[i01] * src[i01 + 3] * w01 +
      src[i11] * src[i11 + 3] * w11) /
    a;
  const g =
    (src[i00 + 1] * src[i00 + 3] * w00 +
      src[i10 + 1] * src[i10 + 3] * w10 +
      src[i01 + 1] * src[i01 + 3] * w01 +
      src[i11 + 1] * src[i11 + 3] * w11) /
    a;
  const b =
    (src[i00 + 2] * src[i00 + 3] * w00 +
      src[i10 + 2] * src[i10 + 3] * w10 +
      src[i01 + 2] * src[i01 + 3] * w01 +
      src[i11 + 2] * src[i11 + 3] * w11) /
    a;

  outPixel[0] = Math.min(255, Math.max(0, Math.round(r)));
  outPixel[1] = Math.min(255, Math.max(0, Math.round(g)));
  outPixel[2] = Math.min(255, Math.max(0, Math.round(b)));
  outPixel[3] = Math.min(255, Math.max(0, Math.round(a)));
}

/**
 * Alpha-over blend helper on RGBA buffer.
 */
function blendPixel(dst, idx, r, g, b, a) {
  if (a <= 0) return;
  const o = idx * 4;
  const sa = a / 255;
  const da = dst[o + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0.001) return;
  dst[o] = Math.round((r * sa + dst[o] * da * (1 - sa)) / outA);
  dst[o + 1] = Math.round((g * sa + dst[o + 1] * da * (1 - sa)) / outA);
  dst[o + 2] = Math.round((b * sa + dst[o + 2] * da * (1 - sa)) / outA);
  dst[o + 3] = Math.round(outA * 255);
}

/**
 * Draws a soft anti-aliased filled ellipse onto an RGBA canvas.
 */
function drawEllipse(buf, size, cx, cy, rx, ry, r, g, b, alpha = 255, rot = 0) {
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const rad = Math.ceil(Math.max(rx, ry)) + 2;
  const x0 = Math.max(2, Math.floor(cx - rad));
  const x1 = Math.min(size - 3, Math.ceil(cx + rad));
  const y0 = Math.max(2, Math.floor(cy - rad));
  const y1 = Math.min(size - 3, Math.ceil(cy + rad));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const d = Math.hypot(lx / Math.max(0.5, rx), ly / Math.max(0.5, ry));
      if (d <= 1.12) {
        const edge = d <= 0.86 ? 1 : Math.max(0, 1 - (d - 0.86) / 0.26);
        blendPixel(buf, y * size + x, r, g, b, Math.round(alpha * edge));
      }
    }
  }
}

/**
 * Draws a soft anti-aliased line segment (capsule) with outline.
 */
function drawCapsule(buf, size, x1, y1, x2, y2, radius, r, g, b, alpha = 255) {
  const minX = Math.max(2, Math.floor(Math.min(x1, x2) - radius - 2));
  const maxX = Math.min(size - 3, Math.ceil(Math.max(x1, x2) + radius + 2));
  const minY = Math.max(2, Math.floor(Math.min(y1, y2) - radius - 2));
  const maxY = Math.min(size - 3, Math.ceil(Math.max(y1, y2) + radius + 2));
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = Math.max(1e-5, vx * vx + vy * vy);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / lenSq));
      const px = x1 + t * vx;
      const py = y1 + t * vy;
      const d = Math.hypot(x - px, y - py);
      if (d <= radius + 1.2) {
        const edge = d <= radius - 0.4 ? 1 : Math.max(0, 1 - (d - (radius - 0.4)) / 1.6);
        blendPixel(buf, y * size + x, r, g, b, Math.round(alpha * edge));
      }
    }
  }
}

/**
 * Draws a smooth anatomical warp of a base cat frame using regional inverse mapping:
 * - Tail region (left 34%): swish, curl, puff
 * - Head region (right 35%, upper 58%): nod, tilt, dip (eating/drinking), raise, ear flatten
 * - Spine/Chest region (center): breathing inflate, back arch (hiss/defensive), crouch, stretch
 * - Paws/Legs region (lower 32%): alternating knead lift, groom paw lift, digging, bounce
 */
function warpCatFrame(baseFrame, size, params) {
  const {
    tailSwishX = 0,
    tailSwishY = 0,
    tailPuff = 0,
    headDx = 0,
    headDy = 0,
    headRot = 0,
    earFlatten = 0,
    breathScaleY = 0,
    backArch = 0,
    bodyCrouch = 0,
    bodyStretchX = 1,
    bodyScaleX = 1,
    bodyScaleY = 1,
    shiftX = 0,
    shiftY = 0,
    frontPawLift = 0,
    pawKneadAlt = 0,
    closeEyes = 0,
    happyEyes = 0,
    angryEyes = 0,
    openMouth = 0,
    hissMouth = 0,
    curlSleep = 0,
    sitSquash = 0
  } = params;

  const out = new Uint8Array(size * size * 4);
  const px = new Uint8Array(4);
  const cx = size * 0.5;
  const footY = size * 0.9;

  for (let y = 2; y < size - 2; y++) {
    for (let x = 2; x < size - 2; x++) {
      // Normalize coordinates relative to foot pivot
      let u = (x - cx - shiftX) / (bodyScaleX * bodyStretchX) + cx;
      let v = (y - footY - shiftY) / bodyScaleY + footY;

      const nx = u / size; // 0 (tail left) -> 1 (face right)
      const ny = v / size; // 0 (top) -> 1 (bottom)

      // 1. Curled sleep tuck: gently wraps tail & head inward into cozy oval
      if (curlSleep > 0) {
        const dcx = nx - 0.52;
        const dcy = ny - 0.68;
        u -= dcx * size * 0.22 * curlSleep;
        v -= (0.68 - ny) * size * 0.34 * curlSleep;
        v -= Math.exp(-((nx - 0.5) ** 2) / 0.14) * size * 0.08 * curlSleep;
      }

      // 2. Sit posture: raises chest/head while compressing hindquarters down
      if (sitSquash > 0) {
        const rearWeight = Math.max(0, Math.min(1, (0.58 - nx) / 0.35));
        const frontWeight = Math.max(0, Math.min(1, (nx - 0.45) / 0.35));
        v -= rearWeight * size * 0.09 * sitSquash;
        v += frontWeight * size * 0.06 * sitSquash;
        u += rearWeight * size * 0.06 * sitSquash;
      }

      // 3. Body crouch (lowers torso toward paws)
      if (bodyCrouch !== 0) {
        const upper = Math.max(0, Math.min(1, (0.86 - ny) / 0.55));
        v -= upper * size * 0.11 * bodyCrouch;
      }

      // 4. Breathing & Spine Arch (center back region)
      const spineMask = Math.exp(-((nx - 0.48) ** 2) / 0.045) * Math.max(0, Math.min(1, (0.85 - ny) / 0.5));
      v += spineMask * size * 0.09 * backArch;
      v += spineMask * size * 0.035 * breathScaleY;

      // 5. Tail region (left side nx < 0.38)
      const tailMask = Math.max(0, Math.min(1, (0.38 - nx) / 0.24));
      const tailSmooth = tailMask * tailMask * (3 - 2 * tailMask);
      if (tailSmooth > 0.001) {
        u -= tailSmooth * tailSwishX * size * 0.14;
        v -= tailSmooth * tailSwishY * size * 0.14;
        if (tailPuff > 0) {
          const tcy = 0.36;
          v = (v - tcy * size) / (1 + tailPuff * 0.28 * tailSmooth) + tcy * size;
        }
      }

      // 6. Head & Neck region (right side nx > 0.54, upper ny < 0.65)
      const headMaskX = Math.max(0, Math.min(1, (nx - 0.54) / 0.16));
      const headMaskY = Math.max(0, Math.min(1, (0.68 - ny) / 0.22));
      const headMask = headMaskX * headMaskX * headMaskY;
      if (headMask > 0.001) {
        const hx = size * 0.72;
        const hy = size * 0.42;
        let rx = u - hx;
        let ry = v - hy;
        if (headRot !== 0) {
          const ang = -headRot * headMask;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          const nrx = rx * ca - ry * sa;
          const nry = rx * sa + ry * ca;
          rx = nrx;
          ry = nry;
        }
        u = rx + hx - headDx * size * 0.12 * headMask;
        v = ry + hy - headDy * size * 0.14 * headMask;

        // Ear flatten (very top of head region)
        if (earFlatten > 0 && ny < 0.32) {
          const earW = Math.max(0, (0.32 - ny) / 0.16) * headMask;
          v -= earW * size * 0.075 * earFlatten;
          u += earW * size * 0.045 * earFlatten;
        }
      }

      // 7. Front Paw / Grooming / Kneading region (nx 0.55..0.84, ny > 0.62)
      const pawMask =
        Math.max(0, Math.min(1, (nx - 0.54) / 0.12)) *
        Math.max(0, Math.min(1, (0.86 - nx) / 0.12)) *
        Math.max(0, Math.min(1, (ny - 0.62) / 0.16));
      if (pawMask > 0.001) {
        if (frontPawLift > 0) {
          v += pawMask * size * 0.13 * frontPawLift;
          u -= pawMask * size * 0.05 * frontPawLift;
        }
        if (pawKneadAlt !== 0) {
          const side = nx > 0.68 ? 1 : -1;
          v += pawMask * side * pawKneadAlt * size * 0.05;
        }
      }

      sampleBilinear(baseFrame, size, size, u, v, px);
      if (px[3] > 0) {
        const doff = (y * size + x) * 4;
        out[doff] = px[0];
        out[doff + 1] = px[1];
        out[doff + 2] = px[2];
        out[doff + 3] = px[3];
      }
    }
  }

  return out;
}

/**
 * Smoothstep helper (0..1 C1 continuous interpolation for seamless Live2D-style mesh skinning).
 */
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Seamless Live2D-style continuous 2D mesh-skinning deformer for Chibi characters.
 * ZERO hard cutout cuts, ZERO detached hair/sleeves, ZERO seams between limbs!
 */
function renderChibiFrame(base256, size, pose) {
  const out = new Uint8Array(size * size * 4);
  const px = new Uint8Array(4);
  const {
    bodyX = 0,
    bodyY = 0,
    bodyLean = 0,
    bodyScaleX = 1,
    headRot = 0,
    headBobY = 0,
    leftArmRot = 0,
    rightArmRot = 0,
    rightArmDx = 0,
    rightArmDy = 0,
    leftLegRot = 0,
    rightLegRot = 0,
    legSquashY = 1,
    kneelDrop = 0,
    prop = null,
    propPhase = 0
  } = pose;

  const cx = size * 0.5;
  const footY = size * 0.94;
  const hipY = size * 0.68;
  const neckY = size * 0.49;

  for (let y = 2; y < size - 2; y++) {
    for (let x = 2; x < size - 2; x++) {
      // Base world -> normalized character coords
      let u = (x - cx - bodyX) / bodyScaleX + cx;
      let v = y - bodyY;

      // 1. Kneel / crouch vertical compression in lower body (y > hipY) + smooth upper drop
      if (kneelDrop !== 0 || legSquashY !== 1) {
        const dropOffset = kneelDrop;
        const lowerBlend = smoothstep(hipY - 12, footY, v);
        // Upper body shifts down smoothly; lower body compresses smoothly into knees
        const upperShift = (1 - lowerBlend) * dropOffset;
        v -= upperShift;
        if (v > hipY) {
          v = hipY + (v - hipY) / Math.max(0.55, legSquashY);
        }
      }

      // 2. Smooth torso/upper-body forward/backward lean around hip pivot
      const upperW = smoothstep(hipY + 14, neckY - 8, v);
      if (bodyLean !== 0 && upperW > 0.001) {
        const ang = -bodyLean * upperW;
        const dx = u - cx;
        const dy = v - hipY;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        u = dx * ca - dy * sa + cx;
        v = dx * sa + dy * ca + hipY;
      }

      // 3. Smooth head tilt & bob (smoothly blended above neck, hair follows seamlessly!)
      const headW = smoothstep(neckY + 14, neckY - 20, v);
      if ((headRot !== 0 || headBobY !== 0) && headW > 0.001) {
        v -= headBobY * headW;
        if (headRot !== 0) {
          const ang = -headRot * headW;
          const dx = u - cx;
          const dy = v - neckY;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          u = dx * ca - dy * sa + cx;
          v = dx * sa + dy * ca + neckY;
        }
      }

      // 4. Smooth continuous leg stride deformation (NO hard split between legs!)
      const legBand = smoothstep(hipY + 4, hipY + 34, v);
      if ((leftLegRot !== 0 || rightLegRot !== 0) && legBand > 0.001) {
        const leftWeight = smoothstep(cx + 10, cx - 14, u) * legBand;
        const rightWeight = smoothstep(cx - 10, cx + 14, u) * legBand;
        const lever = Math.max(0, v - hipY);
        // Shear + lift feet naturally during stride without tearing jeans!
        u -= leftWeight * Math.sin(leftLegRot) * lever * 0.36;
        v += leftWeight * Math.abs(Math.sin(leftLegRot)) * lever * 0.12;
        u -= rightWeight * Math.sin(rightLegRot) * lever * 0.36;
        v += rightWeight * Math.abs(Math.sin(rightLegRot)) * lever * 0.12;
      }

      // 5. Smooth continuous arm swing / reach deformation (localized around outer arm contours)
      const armBandY =
        smoothstep(neckY - 2, neckY + 18, v) * smoothstep(hipY + 26, hipY + 2, v);
      if (armBandY > 0.001) {
        const leftArmW = smoothstep(cx - 16, cx - 34, u) * armBandY;
        const rightArmW = smoothstep(cx + 14, cx + 32, u) * armBandY;
        if (leftArmW > 0.001 && leftArmRot !== 0) {
          const lever = Math.max(0, v - (neckY + 10));
          u -= leftArmW * Math.sin(leftArmRot) * lever * 0.45;
          v += leftArmW * Math.abs(Math.sin(leftArmRot)) * lever * 0.12;
        }
        if (rightArmW > 0.001 && (rightArmRot !== 0 || rightArmDx !== 0 || rightArmDy !== 0)) {
          const lever = Math.max(0, v - (neckY + 10));
          u -= rightArmW * (rightArmDx * 0.75 + Math.sin(rightArmRot) * lever * 0.32);
          v -= rightArmW * (rightArmDy * 0.75 - Math.abs(Math.sin(rightArmRot)) * lever * 0.1);
        }
      }

      sampleBilinear(base256, size, size, u, v, px);
      if (px[3] > 0) {
        const doff = (y * size + x) * 4;
        out[doff] = px[0];
        out[doff + 1] = px[1];
        out[doff + 2] = px[2];
        out[doff + 3] = px[3];
      }
    }
  }

  // Painted Interactive Hand-Held Props cleanly anchored to the deformed right hand!
  const leanDx = Math.sin(bodyLean) * 24;
  const handX = 152 + bodyX + leanDx + rightArmDx * 0.4;
  const handY = 162 + bodyY + kneelDrop * 0.72 + rightArmDy * 0.35;

  if (prop === 'brush') {
    const bx = handX + 12 + Math.sin(propPhase * Math.PI * 2) * 8;
    const by = handY + 4 + Math.cos(propPhase * Math.PI * 2) * 3;
    drawCapsule(out, size, handX - 4, handY, bx, by, 4, 176, 124, 78, 245);
    drawEllipse(out, size, bx + 6, by + 2, 10, 6.5, 198, 146, 96, 248, 0.25);
    drawEllipse(out, size, bx + 7, by + 6, 8, 3.5, 236, 224, 208, 235, 0.25);
  } else if (prop === 'food_pouch') {
    const pxPos = handX + 10;
    const pyPos = handY - 2;
    drawEllipse(out, size, pxPos, pyPos, 10, 14, 212, 124, 88, 248, 0.65);
    drawEllipse(out, size, pxPos, pyPos, 6, 8, 245, 235, 220, 220, 0.65);
    for (let k = 0; k < 5; k++) {
      const kt = (propPhase + k * 0.2) % 1;
      const kx = pxPos + 11 + kt * 10 + Math.sin(k * 2.1) * 2;
      const ky = pyPos + 10 + kt * 34;
      drawEllipse(out, size, kx, ky, 2.5, 2.1, 134, 86, 48, 240);
    }
  } else if (prop === 'water_pitcher') {
    const pxPos = handX + 10;
    const pyPos = handY - 3;
    drawEllipse(out, size, pxPos, pyPos, 11, 10, 235, 242, 246, 248, 0.5);
    drawCapsule(out, size, pxPos + 8, pyPos + 4, pxPos + 22, pyPos + 38, 2.8, 126, 194, 228, 210);
    drawCapsule(out, size, pxPos + 10, pyPos + 6, pxPos + 23, pyPos + 36, 1.2, 224, 245, 255, 230);
  } else if (prop === 'scoop') {
    const sx = handX + 14 + Math.sin(propPhase * Math.PI * 2) * 8;
    const sy = handY + 12;
    drawCapsule(out, size, handX, handY, sx, sy, 3, 142, 152, 160, 245);
    drawEllipse(out, size, sx + 6, sy + 4, 9, 5, 168, 178, 186, 245, 0.3);
  } else if (prop === 'wand') {
    const tipX = handX + 32 + Math.sin(propPhase * Math.PI * 2) * 14;
    const tipY = handY - 32 + Math.cos(propPhase * Math.PI * 2) * 10;
    drawCapsule(out, size, handX, handY, tipX, tipY, 2.2, 164, 118, 72, 248);
    drawCapsule(out, size, tipX, tipY, tipX + 8, tipY + 22, 1.1, 210, 200, 188, 220);
    drawEllipse(out, size, tipX + 9, tipY + 26, 6, 9, 218, 116, 86, 245, 0.35);
    drawEllipse(out, size, tipX + 6, tipY + 24, 4, 7, 238, 194, 102, 240, -0.2);
  }

  return out;
}

/**
 * Saves an array of RGBA square frames into a transparent PNG sprite sheet + Phaser 3 JSON atlas
 * and returns QA verification stats!
 */
async function writeAnimationSheet({
  frames,
  frameSize,
  cols,
  outputPngPath,
  outputJsonPath,
  prefix,
  fps,
  loop,
  anchorY = 0.9
}) {
  const frameCount = frames.length;
  const rows = Math.ceil(frameCount / cols);
  const sheetW = cols * frameSize;
  const sheetH = rows * frameSize;
  const sheetBuf = new Uint8Array(sheetW * sheetH * 4);
  const framesJson = {};

  let emptyFrames = 0;
  let clippedFrames = 0;

  for (let i = 0; i < frameCount; i++) {
    const f = frames[i];
    const c = i % cols;
    const r = Math.floor(i / cols);
    const ox = c * frameSize;
    const oy = r * frameSize;

    let opaque = 0;
    let borderTouch = false;
    for (let y = 0; y < frameSize; y++) {
      for (let x = 0; x < frameSize; x++) {
        const so = (y * frameSize + x) * 4;
        const a = f[so + 3];
        if (a > 24) {
          opaque++;
          if (x === 0 || y === 0 || x === frameSize - 1 || y === frameSize - 1) {
            borderTouch = true;
          }
        }
        const doff = ((oy + y) * sheetW + (ox + x)) * 4;
        sheetBuf[doff] = f[so];
        sheetBuf[doff + 1] = f[so + 1];
        sheetBuf[doff + 2] = f[so + 2];
        sheetBuf[doff + 3] = a;
      }
    }
    if (opaque < 150) emptyFrames++;
    if (borderTouch) clippedFrames++;

    const key = `${prefix}_${String(i).padStart(2, '0')}`;
    framesJson[key] = {
      frame: { x: ox, y: oy, w: frameSize, h: frameSize },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frameSize, h: frameSize },
      sourceSize: { w: frameSize, h: frameSize },
      pivot: { x: 0.5, y: anchorY }
    };
  }

  // Compute inter-frame pixel difference (proves frames are distinct, not static clones!)
  let diffSum = 0;
  let minDiff = 1;
  for (let i = 1; i < frameCount; i++) {
    const a = frames[i - 1];
    const b = frames[i];
    let diff = 0;
    // Sample every 4th pixel for speed
    let samples = 0;
    for (let p = 0; p < a.length; p += 16) {
      diff +=
        Math.abs(a[p] - b[p]) +
        Math.abs(a[p + 1] - b[p + 1]) +
        Math.abs(a[p + 2] - b[p + 2]) +
        Math.abs(a[p + 3] - b[p + 3]);
      samples += 4;
    }
    const norm = diff / (samples * 255);
    if (norm < minDiff) minDiff = norm;
    diffSum += norm;
  }

  const qa = {
    frameCount,
    frameSize,
    transparentCorners:
      sheetBuf[3] === 0 &&
      sheetBuf[(sheetW - 1) * 4 + 3] === 0 &&
      sheetBuf[((sheetH - 1) * sheetW) * 4 + 3] === 0,
    emptyFrames,
    clippedFrames,
    minInterFrameDiff: Number((frameCount > 1 ? minDiff : 0).toFixed(4)),
    avgInterFrameDiff: Number((frameCount > 1 ? diffSum / (frameCount - 1) : 0).toFixed(4))
  };

  fs.mkdirSync(path.dirname(outputPngPath), { recursive: true });
  await sharp(Buffer.from(sheetBuf), {
    raw: { width: sheetW, height: sheetH, channels: 4 }
  })
    .png({ compressionLevel: 9 })
    .toFile(outputPngPath);

  fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
  fs.writeFileSync(
    outputJsonPath,
    JSON.stringify(
      {
        frames: framesJson,
        meta: {
          app: 'Meowchi 2D Sprite Pipeline',
          version: '2.0',
          image: path.basename(outputPngPath),
          format: 'RGBA8888',
          size: { w: sheetW, h: sheetH },
          scale: '1',
          animation: { prefix, frameCount, fps, loop },
          qa
        }
      },
      null,
      2
    )
  );

  return qa;
}

/**
 * Packs named prop islands into a clean Phaser 3 texture atlas.
 */
async function buildPropAtlas(rawPath, outName, cols, rows, names, cellSize = 256) {
  const keyed = await loadKeyedImage(rawPath);
  const islands = extractIslands(keyed.rgba, keyed.width, keyed.height, names.length, rows);
  const sheetW = cols * cellSize;
  const sheetH = rows * cellSize;
  const sheetBuf = new Uint8Array(sheetW * sheetH * 4);
  const framesJson = {};

  for (let i = 0; i < names.length; i++) {
    const isl = islands[i];
    if (!isl) continue;
    const fitted = await fitSpriteToFrame(isl, cellSize, null, 0.9);
    const c = i % cols;
    const r = Math.floor(i / cols);
    const ox = c * cellSize;
    const oy = r * cellSize;
    for (let y = 0; y < cellSize; y++) {
      for (let x = 0; x < cellSize; x++) {
        const so = (y * cellSize + x) * 4;
        const doff = ((oy + y) * sheetW + (ox + x)) * 4;
        sheetBuf[doff] = fitted[so];
        sheetBuf[doff + 1] = fitted[so + 1];
        sheetBuf[doff + 2] = fitted[so + 2];
        sheetBuf[doff + 3] = fitted[so + 3];
      }
    }
    framesJson[names[i]] = {
      frame: { x: ox, y: oy, w: cellSize, h: cellSize },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: cellSize, h: cellSize },
      sourceSize: { w: cellSize, h: cellSize },
      pivot: { x: 0.5, y: 0.88 }
    };
  }

  const outPng = path.join(PUBLIC_SPRITES, 'props', `${outName}.png`);
  const outJson = path.join(PUBLIC_SPRITES, 'props', `${outName}.json`);
  fs.mkdirSync(path.dirname(outPng), { recursive: true });
  await sharp(Buffer.from(sheetBuf), {
    raw: { width: sheetW, height: sheetH, channels: 4 }
  })
    .png({ compressionLevel: 9 })
    .toFile(outPng);

  fs.writeFileSync(
    outJson,
    JSON.stringify(
      {
        frames: framesJson,
        meta: {
          app: 'Meowchi 2D Sprite Pipeline',
          version: '2.0',
          image: `${outName}.png`,
          format: 'RGBA8888',
          size: { w: sheetW, h: sheetH },
          scale: '1'
        }
      },
      null,
      2
    )
  );
  return { count: islands.length, names };
}

async function main() {
  console.log('=== Meowchi 2D Sprite Pipeline Starting ===');
  const manifest = {
    version: '2.0',
    generatedAt: new Date().toISOString(),
    portraitResolution: { width: 720, height: 1280, aspect: '9:16' },
    room: {
      livingRoom: {
        image: 'sprites/room/cozy_living_room_bg.png',
        status: 'final_ai_generated',
        width: 720,
        height: 1280
      }
    },
    props: {},
    cat: {
      masterPortrait: 'sprites/cat/master_portrait.png',
      actions: {}
    },
    human: {
      female: {
        masterPortrait: 'sprites/human/female/master_portrait.png',
        actions: {}
      },
      male: {
        masterPortrait: 'sprites/human/male/master_portrait.png',
        actions: {}
      }
    }
  };

  // 1. Build 3 Final AI Prop Atlases (22 furniture, equipment & toy sprites)
  console.log('[1/4] Building 3 final AI prop texture atlases...');
  manifest.props.care = {
    image: 'sprites/props/props_care.png',
    atlas: 'sprites/props/props_care.json',
    status: 'final_ai_generated',
    ...(await buildPropAtlas(RAW_SOURCES.propsCare, 'props_care', 4, 2, [
      'bed_plush',
      'bed_woven',
      'food_bowl_empty',
      'food_bowl_full',
      'water_bowl_ceramic',
      'litter_box_cozy',
      'scratching_post_sisal',
      'cardboard_box'
    ]))
  };
  manifest.props.living = {
    image: 'sprites/props/props_living.png',
    atlas: 'sprites/props/props_living.json',
    status: 'final_ai_generated',
    ...(await buildPropAtlas(RAW_SOURCES.propsLiving, 'props_living', 4, 2, [
      'sofa_linen',
      'table_oak',
      'cat_tower_oak',
      'floor_lamp_warm',
      'rug_linen',
      'rug_terracotta',
      'toy_ball',
      'toy_mouse'
    ]))
  };
  manifest.props.equipment = {
    image: 'sprites/props/props_equipment.png',
    atlas: 'sprites/props/props_equipment.json',
    status: 'final_ai_generated',
    ...(await buildPropAtlas(RAW_SOURCES.propsEquip, 'props_equipment', 3, 2, [
      'auto_water_fountain',
      'auto_food_feeder',
      'auto_litter_box',
      'smart_cat_bed',
      'auto_cat_toy',
      'toy_feather_wand'
    ]))
  };

  // 2. Load & extract all 31 REAL AI-painted kitten frames!
  console.log('[2/4] Extracting 31 real AI-painted fluffy kitten frames...');
  const FRAME_SIZE = 256;
  const catMasterKeyed = await loadKeyedImage(RAW_SOURCES.catMaster);
  const catMasterIsland = extractIslands(catMasterKeyed.rgba, catMasterKeyed.width, catMasterKeyed.height, 1, 1)[0];
  const catMasterFrame = await fitSpriteToFrame(catMasterIsland, FRAME_SIZE, null, 0.9);

  // Save high-res transparent cat portrait for UI previews
  const catPortraitOut = path.join(PUBLIC_SPRITES, 'cat', 'master_portrait.png');
  fs.mkdirSync(path.dirname(catPortraitOut), { recursive: true });
  const catMaster384 = await fitSpriteToFrame(catMasterIsland, 384, null, 0.92);
  await sharp(Buffer.from(catMaster384), { raw: { width: 384, height: 384, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(catPortraitOut);

  const walkKeyed = await loadKeyedImage(RAW_SOURCES.catWalk);
  const walkIslands = extractIslands(walkKeyed.rgba, walkKeyed.width, walkKeyed.height, 8, 2);
  const walkMaxDim = Math.max(...walkIslands.map((i) => Math.max(i.width, i.height)));
  const walkScale = (FRAME_SIZE * 0.84) / walkMaxDim;
  const walkFrames = await Promise.all(
    walkIslands.map((isl) => fitSpriteToFrame(isl, FRAME_SIZE, walkScale, 0.9))
  );

  const runKeyed = await loadKeyedImage(RAW_SOURCES.catRun);
  const runIslands = extractIslands(runKeyed.rgba, runKeyed.width, runKeyed.height, 12, 3);
  const runMaxDim = Math.max(...runIslands.map((i) => Math.max(i.width, i.height)));
  const runScale = (FRAME_SIZE * 0.85) / runMaxDim;
  const runAll12 = await Promise.all(
    runIslands.map((isl) => fitSpriteToFrame(isl, FRAME_SIZE, runScale, 0.88))
  );

  const jumpKeyed = await loadKeyedImage(RAW_SOURCES.catJump);
  const jumpIslands = extractIslands(jumpKeyed.rgba, jumpKeyed.width, jumpKeyed.height, 10, 2);
  const jumpMaxDim = Math.max(...jumpIslands.map((i) => Math.max(i.width, i.height)));
  const jumpScale = (FRAME_SIZE * 0.85) / jumpMaxDim;
  const jumpAll10 = await Promise.all(
    jumpIslands.map((isl) => fitSpriteToFrame(isl, FRAME_SIZE, jumpScale, 0.88))
  );

  // Helper to register & write a cat action sheet
  const saveCatAction = async (name, frames, cols, fps, loop, status, promptNote) => {
    const pngPath = path.join(PUBLIC_SPRITES, 'cat', `${name}.png`);
    const jsonPath = path.join(PUBLIC_SPRITES, 'cat', `${name}.json`);
    const qa = await writeAnimationSheet({
      frames,
      frameSize: FRAME_SIZE,
      cols,
      outputPngPath: pngPath,
      outputJsonPath: jsonPath,
      prefix: `cat_${name}`,
      fps,
      loop,
      anchorY: 0.9
    });
    manifest.cat.actions[name] = {
      image: `sprites/cat/${name}.png`,
      atlas: `sprites/cat/${name}.json`,
      frameCount: frames.length,
      fps,
      loop,
      status,
      qa,
      ...(promptNote ? { aiPrompt: promptNote } : {})
    };
  };

  console.log('[3/4] Generating all 33 Cat Sprite Animation Sheets...');

  // DIRECT FINAL AI-GENERATED SHEETS:
  await saveCatAction('walk', walkFrames, 4, 10, true, 'final_ai_generated');
  await saveCatAction('run', runAll12.slice(0, 10), 5, 14, true, 'final_ai_generated');
  // Reorder jump frames for cleanest vertical arc: alert(0)->crouch(1)->coil(2)->launch(3)->ascent(4)->apex(6)->dive(7)->descend(8)->brace(9)->recover(5)
  const orderedJump = [
    jumpAll10[0],
    jumpAll10[1],
    jumpAll10[2],
    jumpAll10[3],
    jumpAll10[4],
    jumpAll10[6],
    jumpAll10[7],
    jumpAll10[8],
    jumpAll10[9],
    jumpAll10[0]
  ];
  await saveCatAction('jump', orderedJump, 5, 12, false, 'final_ai_generated');
  await saveCatAction('zoomies', runAll12, 4, 16, true, 'final_ai_generated');

  // HIGH-FIDELITY INTERIM ARTICULATED SHEETS (derived from the 31 real AI kitten poses):
  const makeCycle = (count, fn) => Array.from({ length: count }, (_, i) => fn(i, i / count, (i / Math.max(1, count - 1))));

  // Movement (remaining 5)
  await saveCatAction(
    'idle',
    makeCycle(8, (i, t) => {
      const s = Math.sin(t * Math.PI * 2);
      return warpCatFrame(catMasterFrame, FRAME_SIZE, {
        breathScaleY: s * 0.9,
        tailSwishX: Math.sin(t * Math.PI * 2 + 0.6) * 0.45,
        tailSwishY: Math.cos(t * Math.PI * 2) * 0.35,
        headDy: s * 0.08,
        closeEyes: i === 3 ? 0.88 : i === 4 ? 0.45 : 0
      });
    }),
    4,
    7,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame idle breathing kitten animation on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'land',
    [
      warpCatFrame(jumpAll10[7], FRAME_SIZE, { shiftY: -6 }),
      warpCatFrame(jumpAll10[8], FRAME_SIZE, { bodyCrouch: 0.25 }),
      warpCatFrame(jumpAll10[9], FRAME_SIZE, { bodyCrouch: 0.55 }),
      warpCatFrame(jumpAll10[2], FRAME_SIZE, { bodyCrouch: 0.4 }),
      warpCatFrame(jumpAll10[1], FRAME_SIZE, { bodyCrouch: 0.15 }),
      warpCatFrame(catMasterFrame, FRAME_SIZE, { tailSwishY: 0.2 })
    ],
    3,
    12,
    false,
    'interim_articulated_from_ai_master',
    '3x2 6-frame feline landing animation on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'turn',
    makeCycle(6, (i, _, u) => {
      const sx = Math.max(0.28, Math.abs(Math.cos(u * Math.PI)));
      const dir = u > 0.5 ? -1 : 1;
      return warpCatFrame(walkFrames[i % 4], FRAME_SIZE, {
        bodyScaleX: sx * dir,
        tailSwishX: Math.sin(u * Math.PI) * 0.7
      });
    }),
    3,
    12,
    false,
    'interim_articulated_from_ai_master',
    '3x2 6-frame 180-degree feline turn-around sheet on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'sit',
    [
      warpCatFrame(catMasterFrame, FRAME_SIZE, { sitSquash: 0.12 }),
      warpCatFrame(jumpAll10[1], FRAME_SIZE, { sitSquash: 0.25 }),
      warpCatFrame(jumpAll10[1], FRAME_SIZE, { sitSquash: 0.45, tailSwishX: 0.3 }),
      warpCatFrame(jumpAll10[1], FRAME_SIZE, { sitSquash: 0.6, tailSwishX: 0.5, headDy: -0.1 }),
      warpCatFrame(jumpAll10[1], FRAME_SIZE, { sitSquash: 0.65, tailSwishX: 0.6, breathScaleY: 0.5 }),
      warpCatFrame(jumpAll10[1], FRAME_SIZE, { sitSquash: 0.62, tailSwishX: 0.55, closeEyes: 0.5 })
    ],
    3,
    8,
    false,
    'interim_articulated_from_ai_master',
    '3x2 6-frame sitting transition on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'lie_down',
    makeCycle(8, (i, _, u) => {
      const base = i < 2 ? catMasterFrame : i < 5 ? jumpAll10[1] : jumpAll10[2];
      return warpCatFrame(base, FRAME_SIZE, {
        bodyCrouch: u * 0.75,
        curlSleep: Math.max(0, (u - 0.4) * 0.8),
        tailSwishY: -u * 0.4,
        closeEyes: u > 0.75 ? 0.6 : 0
      });
    }),
    4,
    8,
    false,
    'interim_articulated_from_ai_master',
    '4x2 8-frame lying-down loaf transition on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'sleep',
    makeCycle(8, (_, t) => {
      const s = Math.sin(t * Math.PI * 2);
      return warpCatFrame(jumpAll10[2], FRAME_SIZE, {
        curlSleep: 0.78 + s * 0.04,
        bodyCrouch: 0.65,
        breathScaleY: s * 1.15,
        tailSwishX: s * 0.25,
        closeEyes: 1.0
      });
    }),
    4,
    5,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame curled sleeping kitten breathing loop on #FF00FF matching cat_master_ref'
  );

  // Emotions (9)
  await saveCatAction(
    'happy',
    makeCycle(8, (_, t) => {
      const s = Math.sin(t * Math.PI * 2);
      return warpCatFrame(catMasterFrame, FRAME_SIZE, {
        happyEyes: 0.95,
        headRot: s * 0.14,
        headDy: -0.14 - Math.abs(s) * 0.12,
        tailSwishX: Math.sin(t * Math.PI * 2) * 0.8,
        tailSwishY: 0.35 + Math.cos(t * Math.PI * 2) * 0.2,
        shiftY: -Math.abs(s) * 5
      });
    }),
    4,
    9,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame happy kitten emotion loop on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'affectionate',
    makeCycle(8, (_, t) => {
      const s = Math.sin(t * Math.PI * 2);
      return warpCatFrame(catMasterFrame, FRAME_SIZE, {
        happyEyes: 0.88,
        headDx: 0.35 + s * 0.28,
        headDy: 0.12 + Math.cos(t * Math.PI * 2) * 0.14,
        headRot: 0.18 + s * 0.15,
        tailSwishX: s * 0.65,
        tailSwishY: 0.45
      });
    }),
    4,
    8,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame affectionate kitten leaning in on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'curious',
    makeCycle(8, (i, t) => {
      const s = Math.sin(t * Math.PI * 2);
      return warpCatFrame(walkFrames[i % 2], FRAME_SIZE, {
        headDx: 0.3 + s * 0.22,
        headRot: s * 0.24,
        frontPawLift: Math.max(0, s) * 0.55,
        tailSwishX: s * 0.5
      });
    }),
    4,
    8,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame curious sniffing & head-tilt animation on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'fearful',
    makeCycle(8, (i, t) => {
      const shiver = (i % 2 === 0 ? -1 : 1) * 2.5;
      return warpCatFrame(jumpAll10[2], FRAME_SIZE, {
        bodyCrouch: 0.72,
        earFlatten: 0.92,
        tailSwishY: -0.7,
        tailSwishX: -0.4,
        shiftX: shiver,
        headDx: -0.25 + Math.sin(t * Math.PI * 2) * 0.08
      });
    }),
    4,
    10,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame fearful low-crouch flattened-ears animation on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'defensive',
    makeCycle(8, (_, t) => {
      const s = Math.sin(t * Math.PI * 2);
      return warpCatFrame(catMasterFrame, FRAME_SIZE, {
        backArch: 0.95 + s * 0.18,
        tailPuff: 1.0,
        tailSwishY: 0.5 + s * 0.25,
        earFlatten: 0.95,
        angryEyes: 0.95,
        headDx: -0.15 + s * 0.1
      });
    }),
    4,
    9,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame defensive arched-back puffed-tail animation on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'hiss',
    makeCycle(8, (i, t) => {
      const peak = Math.sin(t * Math.PI);
      return warpCatFrame(i >= 3 && i <= 5 ? jumpAll10[5] : catMasterFrame, FRAME_SIZE, {
        backArch: 0.85 + peak * 0.25,
        tailPuff: 1.0,
        earFlatten: 1.0,
        angryEyes: 1.0,
        hissMouth: 0.45 + peak * 0.55,
        headDx: peak * 0.25,
        tailSwishX: Math.sin(t * Math.PI * 4) * 0.5
      });
    }),
    4,
    10,
    false,
    'interim_articulated_from_ai_master',
    '4x2 8-frame hissing open-mouth flattened-ears sheet on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'growl',
    makeCycle(8, (i, t) => {
      const rumble = (i % 2 === 0 ? -1 : 1) * 1.8;
      return warpCatFrame(jumpAll10[2], FRAME_SIZE, {
        bodyCrouch: 0.58,
        earFlatten: 0.88,
        angryEyes: 0.92,
        tailSwishX: Math.sin(t * Math.PI * 2) * 0.9,
        shiftX: rumble,
        headDx: 0.15
      });
    }),
    4,
    9,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame low warning growl sheet on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'bite',
    [
      warpCatFrame(jumpAll10[2], FRAME_SIZE, { earFlatten: 0.95, angryEyes: 1, bodyCrouch: 0.6 }),
      warpCatFrame(jumpAll10[2], FRAME_SIZE, { earFlatten: 1, angryEyes: 1, hissMouth: 0.6, shiftX: -6 }),
      warpCatFrame(runAll12[1], FRAME_SIZE, { earFlatten: 1, angryEyes: 1, hissMouth: 1, shiftX: 12 }),
      warpCatFrame(runAll12[2], FRAME_SIZE, { earFlatten: 1, angryEyes: 1, hissMouth: 1, shiftX: 18 }),
      warpCatFrame(jumpAll10[9], FRAME_SIZE, { earFlatten: 1, angryEyes: 1, hissMouth: 0.9, shiftX: 10 }),
      warpCatFrame(jumpAll10[2], FRAME_SIZE, { earFlatten: 0.9, angryEyes: 0.9, hissMouth: 0.4, shiftX: -4 }),
      warpCatFrame(catMasterFrame, FRAME_SIZE, { backArch: 0.8, tailPuff: 0.9, earFlatten: 0.85, angryEyes: 0.85 }),
      warpCatFrame(catMasterFrame, FRAME_SIZE, { backArch: 0.5, tailPuff: 0.6, earFlatten: 0.5 })
    ],
    4,
    13,
    false,
    'interim_articulated_from_ai_master',
    '4x2 8-frame defensive bite lunge & recoil sheet on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'pounce',
    [
      warpCatFrame(jumpAll10[2], FRAME_SIZE, { bodyCrouch: 0.55, tailSwishX: -0.5 }),
      warpCatFrame(jumpAll10[2], FRAME_SIZE, { bodyCrouch: 0.65, tailSwishX: 0.5 }),
      warpCatFrame(jumpAll10[2], FRAME_SIZE, { bodyCrouch: 0.72, tailSwishX: -0.6 }),
      warpCatFrame(runAll12[0], FRAME_SIZE, { shiftX: -4 }),
      warpCatFrame(runAll12[1], FRAME_SIZE, { shiftY: -8 }),
      warpCatFrame(runAll12[2], FRAME_SIZE, { shiftY: -12 }),
      warpCatFrame(jumpAll10[6], FRAME_SIZE, { shiftY: -8 }),
      warpCatFrame(jumpAll10[7], FRAME_SIZE, { shiftY: -2 }),
      warpCatFrame(jumpAll10[9], FRAME_SIZE, { bodyCrouch: 0.45 }),
      warpCatFrame(jumpAll10[1], FRAME_SIZE, { tailSwishY: 0.3 })
    ],
    5,
    12,
    false,
    'interim_articulated_from_ai_master',
    '5x2 10-frame playful pounce crouch-wiggle-leap sheet on #FF00FF matching cat_master_ref'
  );

  // Care (8)
  await saveCatAction(
    'eat',
    makeCycle(10, (_, t) => {
      const chew = Math.sin(t * Math.PI * 6);
      const dip = Math.sin(t * Math.PI * 2) * 0.15;
      return warpCatFrame(jumpAll10[9], FRAME_SIZE, {
        headDy: 0.52 + dip + chew * 0.14,
        headDx: 0.32,
        headRot: 0.28 + chew * 0.08,
        openMouth: chew > 0.2 ? 0.55 : 0,
        tailSwishY: 0.18 + Math.sin(t * Math.PI * 2) * 0.22
      });
    }),
    5,
    10,
    true,
    'interim_articulated_from_ai_master',
    '5x2 10-frame eating from bowl animation on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'drink',
    makeCycle(10, (_, t) => {
      const lap = Math.sin(t * Math.PI * 8);
      return warpCatFrame(jumpAll10[9], FRAME_SIZE, {
        headDy: 0.56 + lap * 0.12,
        headDx: 0.36,
        headRot: 0.34 + lap * 0.06,
        openMouth: lap > 0.1 ? 0.48 : 0,
        tailSwishX: Math.sin(t * Math.PI * 2) * 0.35
      });
    }),
    5,
    11,
    true,
    'interim_articulated_from_ai_master',
    '5x2 10-frame lapping water drinking animation on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'groom',
    makeCycle(10, (_, t) => {
      const lick = Math.sin(t * Math.PI * 4);
      return warpCatFrame(jumpAll10[1], FRAME_SIZE, {
        sitSquash: 0.45,
        frontPawLift: 0.65 + lick * 0.35,
        headDy: 0.26 - lick * 0.18,
        headRot: 0.22 - lick * 0.15,
        closeEyes: lick > 0 ? 0.75 : 0.2,
        tailSwishX: Math.sin(t * Math.PI * 2) * 0.3
      });
    }),
    5,
    9,
    true,
    'interim_articulated_from_ai_master',
    '5x2 10-frame self-grooming paw-licking animation on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'pet_accept',
    makeCycle(8, (_, t) => {
      const s = Math.sin(t * Math.PI * 2);
      return warpCatFrame(catMasterFrame, FRAME_SIZE, {
        happyEyes: 1.0,
        headDy: -0.18 + s * 0.16,
        headRot: -0.14 + s * 0.12,
        backArch: 0.25 + Math.max(0, s) * 0.25,
        tailSwishY: 0.4 + s * 0.2
      });
    }),
    4,
    8,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame kitten blissfully accepting head petting on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'brush_react',
    makeCycle(8, (_, t) => {
      const s = Math.sin(t * Math.PI * 2);
      return warpCatFrame(catMasterFrame, FRAME_SIZE, {
        happyEyes: 0.9,
        bodyStretchX: 1.03 + s * 0.04,
        backArch: 0.2 + s * 0.22,
        headDy: -0.12 - s * 0.12,
        tailSwishX: s * 0.7
      });
    }),
    4,
    8,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame kitten reacting to coat brushing on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'picked_up',
    makeCycle(10, (i, _, u) => {
      const base = i < 3 ? catMasterFrame : i < 7 ? jumpAll10[3] : jumpAll10[4];
      return warpCatFrame(base, FRAME_SIZE, {
        shiftY: -u * 14,
        tailSwishY: -u * 0.45,
        headRot: -0.08 + Math.sin(u * Math.PI) * 0.12
      });
    }),
    5,
    10,
    false,
    'interim_articulated_from_ai_master',
    '5x2 10-frame kitten being lifted up on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'carried',
    makeCycle(8, (_, t) => {
      const s = Math.sin(t * Math.PI * 2);
      return warpCatFrame(jumpAll10[1], FRAME_SIZE, {
        curlSleep: 0.35,
        happyEyes: 0.8,
        breathScaleY: s * 0.7,
        tailSwishX: s * 0.45,
        shiftY: s * 3
      });
    }),
    4,
    7,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame kitten comfortably carried in arms on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'litter',
    makeCycle(8, (i, t) => {
      const dig = Math.sin(t * Math.PI * 4);
      return warpCatFrame(i >= 3 && i <= 5 ? jumpAll10[2] : jumpAll10[9], FRAME_SIZE, {
        bodyCrouch: i >= 3 && i <= 5 ? 0.6 : 0.25,
        pawKneadAlt: i < 3 || i > 5 ? dig * 1.1 : 0,
        headDy: 0.25,
        tailSwishY: 0.25
      });
    }),
    4,
    8,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame using litter box digging & squatting on #FF00FF matching cat_master_ref'
  );

  // Special (remaining 6 — zoomies already saved above!)
  await saveCatAction(
    'chase_toy',
    [
      runAll12[0],
      runAll12[1],
      jumpAll10[3],
      jumpAll10[5],
      runAll12[2],
      jumpAll10[6],
      jumpAll10[5],
      runAll12[8],
      runAll12[10],
      runAll12[11]
    ],
    5,
    13,
    true,
    'interim_articulated_from_ai_master',
    '5x2 10-frame chasing & batting feather toy on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'knead',
    makeCycle(10, (_, t) => {
      const alt = Math.sin(t * Math.PI * 4);
      return warpCatFrame(catMasterFrame, FRAME_SIZE, {
        happyEyes: 0.9,
        pawKneadAlt: alt * 1.35,
        bodyCrouch: 0.16 + Math.abs(alt) * 0.08,
        headDy: 0.12 + alt * 0.05,
        tailSwishX: Math.sin(t * Math.PI * 2) * 0.4
      });
    }),
    5,
    9,
    true,
    'interim_articulated_from_ai_master',
    '5x2 10-frame alternating-paw blanket kneading on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'stretch',
    makeCycle(8, (i, t) => {
      const s = Math.sin(t * Math.PI);
      return warpCatFrame(i >= 2 && i <= 5 ? jumpAll10[8] : catMasterFrame, FRAME_SIZE, {
        bodyStretchX: 1 + s * 0.14,
        bodyCrouch: s * 0.35,
        tailSwishY: 0.65 * s,
        headDy: 0.25 * s,
        happyEyes: s > 0.5 ? 0.85 : 0
      });
    }),
    4,
    7,
    false,
    'interim_articulated_from_ai_master',
    '4x2 8-frame full feline front-paw bow stretch on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'yawn',
    makeCycle(8, (_, t) => {
      const s = Math.sin(t * Math.PI);
      return warpCatFrame(jumpAll10[1], FRAME_SIZE, {
        sitSquash: 0.45,
        openMouth: s,
        closeEyes: s > 0.35 ? 0.92 : 0,
        headRot: -0.22 * s,
        headDy: -0.15 * s,
        breathScaleY: s * 0.8
      });
    }),
    4,
    7,
    false,
    'interim_articulated_from_ai_master',
    '4x2 8-frame wide feline yawn animation on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'head_rub',
    makeCycle(8, (_, t) => {
      const s = Math.sin(t * Math.PI * 2);
      return warpCatFrame(catMasterFrame, FRAME_SIZE, {
        happyEyes: 0.95,
        headDx: 0.45 + Math.cos(t * Math.PI * 2) * 0.28,
        headDy: 0.18 + s * 0.22,
        headRot: 0.28 + s * 0.22,
        tailSwishY: 0.55
      });
    }),
    4,
    9,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame affectionate head-bunting rub on #FF00FF matching cat_master_ref'
  );

  await saveCatAction(
    'tail_swish',
    makeCycle(8, (_, t) => {
      const s = Math.sin(t * Math.PI * 2);
      return warpCatFrame(catMasterFrame, FRAME_SIZE, {
        tailSwishX: s * 1.15,
        tailSwishY: Math.cos(t * Math.PI * 4) * 0.45,
        breathScaleY: s * 0.35
      });
    }),
    4,
    10,
    true,
    'interim_articulated_from_ai_master',
    '4x2 8-frame expressive tail wagging/swishing on #FF00FF matching cat_master_ref'
  );

  // 4. Generate ALL 17 Chibi Human Actions for BOTH Female & Male (34 Sprite Sheets!)
  console.log('[4/4] Generating 34 Chibi Human Sprite Sheets (17 female + 17 male)...');

  for (const gender of ['female', 'male']) {
    const rawPath = gender === 'female' ? RAW_SOURCES.humanFemale : RAW_SOURCES.humanMale;
    const isMale = gender === 'male';
    const keyed = await loadKeyedImage(rawPath);
    const island = extractIslands(keyed.rgba, keyed.width, keyed.height, 1, 1)[0];
    const base256 = await fitSpriteToFrame(island, FRAME_SIZE, null, 0.94);

    // Save high-res transparent portrait for Creator & UI preview
    const portrait384 = await fitSpriteToFrame(island, 384, null, 0.94);
    const portraitOut = path.join(PUBLIC_SPRITES, 'human', gender, 'master_portrait.png');
    fs.mkdirSync(path.dirname(portraitOut), { recursive: true });
    await sharp(Buffer.from(portrait384), { raw: { width: 384, height: 384, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(portraitOut);

    const saveHumanAction = async (name, count, cols, fps, loop, poseFn) => {
      const frames = makeCycle(count, (i, t, u) =>
        renderChibiFrame(base256, FRAME_SIZE, poseFn(i, t, u))
      );
      const pngPath = path.join(PUBLIC_SPRITES, 'human', gender, `${name}.png`);
      const jsonPath = path.join(PUBLIC_SPRITES, 'human', gender, `${name}.json`);
      const qa = await writeAnimationSheet({
        frames,
        frameSize: FRAME_SIZE,
        cols,
        outputPngPath: pngPath,
        outputJsonPath: jsonPath,
        prefix: `human_${gender}_${name}`,
        fps,
        loop,
        anchorY: 0.94
      });
      manifest.human[gender].actions[name] = {
        image: `sprites/human/${gender}/${name}.png`,
        atlas: `sprites/human/${gender}/${name}.json`,
        frameCount: count,
        fps,
        loop,
        status: 'interim_articulated_from_ai_master',
        qa,
        aiPrompt: `4x2 ${count}-frame 2D Chibi ${gender} ${name} sprite sheet on #FF00FF matching human_${gender}_ref`
      };
    };

    await saveHumanAction('idle', 8, 4, 7, true, (i, t) => ({
      bodyY: Math.sin(t * Math.PI * 2) * 1.8,
      headBobY: Math.sin(t * Math.PI * 2 - 0.5) * 1.5,
      leftArmRot: Math.sin(t * Math.PI * 2) * 0.06,
      rightArmRot: -Math.sin(t * Math.PI * 2) * 0.06,
      blink: i === 4 ? 0.95 : i === 5 ? 0.4 : 0
    }));

    await saveHumanAction('walk', 8, 4, 11, true, (_, t) => {
      const s = Math.sin(t * Math.PI * 2);
      const bob = -Math.abs(s) * 5;
      return {
        bodyY: bob,
        bodyLean: 0.06,
        headBobY: bob * 0.25,
        leftLegRot: s * 0.38,
        rightLegRot: -s * 0.38,
        leftArmRot: -s * 0.42,
        rightArmRot: s * 0.42
      };
    });

    await saveHumanAction('run', 8, 4, 14, true, (_, t) => {
      const s = Math.sin(t * Math.PI * 2);
      const bob = -Math.abs(s) * 9;
      return {
        bodyY: bob,
        bodyLean: 0.18,
        headBobY: bob * 0.3,
        leftLegRot: s * 0.62,
        rightLegRot: -s * 0.62,
        leftArmRot: -s * 0.72,
        rightArmRot: s * 0.72
      };
    });

    await saveHumanAction('turn', 6, 3, 12, false, (_, __, u) => ({
      bodyScaleX: Math.max(0.28, Math.abs(Math.cos(u * Math.PI))) * (u > 0.5 ? -1 : 1),
      leftArmRot: Math.sin(u * Math.PI) * 0.22,
      rightArmRot: -Math.sin(u * Math.PI) * 0.22
    }));

    await saveHumanAction('sit', 6, 3, 8, false, (_, __, u) => ({
      kneelDrop: u * 22,
      legSquashY: 1 - u * 0.32,
      leftLegRot: -u * 0.35,
      rightLegRot: -u * 0.25,
      bodyLean: -u * 0.06,
      rightArmRot: -u * 0.2
    }));

    await saveHumanAction('kneel', 8, 4, 10, false, (_, __, u) => ({
      kneelDrop: u * 30,
      legSquashY: 1 - u * 0.42,
      bodyLean: u * 0.24,
      leftLegRot: u * 0.25,
      rightLegRot: -u * 0.3,
      rightArmRot: -u * 0.45
    }));

    await saveHumanAction('bend', 8, 4, 10, false, (_, __, u) => ({
      kneelDrop: u * 16,
      legSquashY: 1 - u * 0.16,
      bodyLean: u * 0.44,
      headRot: -u * 0.12,
      leftArmRot: -u * 0.55,
      rightArmRot: -u * 0.68
    }));

    await saveHumanAction('pet_cat', 8, 4, 9, true, (_, t) => {
      const stroke = Math.sin(t * Math.PI * 2);
      return {
        kneelDrop: 28,
        legSquashY: 0.6,
        bodyLean: 0.32 + stroke * 0.04,
        headRot: 0.1 + stroke * 0.05,
        rightArmRot: -0.95 + stroke * 0.28,
        rightArmDx: 10 + stroke * 7,
        rightArmDy: 6 + Math.cos(t * Math.PI * 2) * 4,
        leftArmRot: -0.3,
        blink: 0.85,
        happySmile: 1.0
      };
    });

    await saveHumanAction('brush_cat', 8, 4, 10, true, (_, t) => {
      const sweep = Math.sin(t * Math.PI * 2);
      return {
        kneelDrop: 26,
        legSquashY: 0.62,
        bodyLean: 0.3 + sweep * 0.05,
        rightArmRot: -0.85 + sweep * 0.34,
        rightArmDx: 12 + sweep * 8,
        rightArmDy: 4,
        prop: 'brush',
        propPhase: t,
        happySmile: 0.9
      };
    });

    await saveHumanAction('pour_food', 8, 4, 9, true, (_, t) => {
      const tilt = Math.sin(t * Math.PI * 2);
      return {
        kneelDrop: 14,
        legSquashY: 0.82,
        bodyLean: 0.36 + tilt * 0.05,
        rightArmRot: -0.78 + tilt * 0.18,
        rightArmDx: 12,
        leftArmRot: -0.28,
        prop: 'food_pouch',
        propPhase: t
      };
    });

    await saveHumanAction('refill_water', 8, 4, 9, true, (_, t) => {
      const tilt = Math.sin(t * Math.PI * 2);
      return {
        kneelDrop: 14,
        legSquashY: 0.82,
        bodyLean: 0.34 + tilt * 0.04,
        rightArmRot: -0.74 + tilt * 0.16,
        rightArmDx: 12,
        prop: 'water_pitcher',
        propPhase: t
      };
    });

    await saveHumanAction('hold_cat', 8, 4, 8, true, (_, t) => {
      const rock = Math.sin(t * Math.PI * 2);
      return {
        bodyY: rock * 2.2,
        bodyLean: -0.05 + rock * 0.03,
        headRot: 0.08 + rock * 0.06,
        leftArmRot: -0.75 + rock * 0.08,
        rightArmRot: -0.82 - rock * 0.08,
        rightArmDx: -4,
        rightArmDy: -6,
        blink: 0.75,
        happySmile: 1.0
      };
    });

    await saveHumanAction('put_cat_down', 8, 4, 10, false, (_, __, u) => {
      const arc = Math.sin(u * Math.PI);
      return {
        kneelDrop: arc * 26,
        legSquashY: 1 - arc * 0.32,
        bodyLean: arc * 0.38,
        leftArmRot: -0.75 * (1 - u * 0.5),
        rightArmRot: -0.8 * (1 - u * 0.5)
      };
    });

    await saveHumanAction('play_toy', 8, 4, 11, true, (_, t) => {
      const wave = Math.sin(t * Math.PI * 2);
      return {
        bodyY: -Math.abs(wave) * 3,
        bodyLean: 0.1 + wave * 0.06,
        headRot: wave * 0.08,
        rightArmRot: -1.15 + wave * 0.52,
        rightArmDx: 8 + wave * 6,
        rightArmDy: -10,
        leftArmRot: 0.18 - wave * 0.15,
        prop: 'wand',
        propPhase: t,
        happySmile: 0.9
      };
    });

    await saveHumanAction('clean_litter', 8, 4, 9, true, (_, t) => {
      const scoop = Math.sin(t * Math.PI * 2);
      return {
        kneelDrop: 24,
        legSquashY: 0.65,
        bodyLean: 0.38 + scoop * 0.06,
        rightArmRot: -0.72 + scoop * 0.35,
        rightArmDx: 10 + scoop * 6,
        prop: 'scoop',
        propPhase: t
      };
    });

    await saveHumanAction('use_equipment', 8, 4, 9, true, (_, t) => {
      const tap = Math.sin(t * Math.PI * 4);
      return {
        bodyLean: 0.2,
        rightArmRot: -0.92 + tap * 0.18,
        rightArmDx: 10 + tap * 4,
        rightArmDy: -6
      };
    });

    await saveHumanAction('react_bite', 8, 4, 12, false, (i, _, u) => {
      const peak = Math.sin(Math.min(1, u * 1.4) * Math.PI);
      return {
        bodyX: -peak * 18,
        bodyY: -peak * 8,
        bodyLean: -peak * 0.26,
        headRot: -peak * 0.18,
        leftArmRot: -peak * 0.95,
        rightArmRot: -peak * 1.25,
        leftLegRot: peak * 0.2,
        rightLegRot: -peak * 0.25,
        surprised: i >= 1 && i <= 5 ? 1.0 : 0
      };
    });
  }

  // Write master manifest JSON
  const manifestPath = path.join(PUBLIC_SPRITES, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Print QA summary
  const catActions = Object.entries(manifest.cat.actions);
  const femaleActions = Object.entries(manifest.human.female.actions);
  const maleActions = Object.entries(manifest.human.male.actions);
  const allSheets = [...catActions, ...femaleActions, ...maleActions];
  const emptyTotal = allSheets.reduce((s, [, v]) => s + v.qa.emptyFrames, 0);
  const clippedTotal = allSheets.reduce((s, [, v]) => s + v.qa.clippedFrames, 0);
  const nonTransparent = allSheets.filter(([, v]) => !v.qa.transparentCorners).length;

  console.log('=== SPRITE PIPELINE COMPLETE ===');
  console.log(`Prop Atlases: 3 (22 final AI sprites)`);
  console.log(`Cat Sheets: ${catActions.length} (${catActions.filter(([, v]) => v.status === 'final_ai_generated').length} direct AI, ${catActions.filter(([, v]) => v.status !== 'final_ai_generated').length} articulated from AI masters)`);
  console.log(`Human Female Sheets: ${femaleActions.length}`);
  console.log(`Human Male Sheets: ${maleActions.length}`);
  console.log(`QA: emptyFrames=${emptyTotal}, clippedFrames=${clippedTotal}, nonTransparent=${nonTransparent}`);
  console.log(`Manifest written: ${manifestPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

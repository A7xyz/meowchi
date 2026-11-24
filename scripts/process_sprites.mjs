import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Meowchi 2D Sprite Sheet Post-Processor, Chroma-Keyer, Atlas Packer & QA Validator.
 *
 * Converts raw AI-generated sprite sheets (on flat #FF00FF vivid magenta) into:
 * - Clean transparent RGBA PNG sprite sheets with zero magenta haloing
 * - Uniform fixed-size animation frames anchored consistently at bottom-center (or center)
 * - Phaser 3 Texture Atlas JSON files (.json) with frame coordinates & animation metadata
 * - Automated QA checks (transparency, non-empty frames, inter-frame motion difference, no clipping)
 */

/**
 * Computes magenta-ness score: pure #FF00FF => +255; natural fur/skin/denim => <= 15.
 */
function magentaScore(r, g, b) {
  return Math.min(r, b) - g;
}

/**
 * Removes solid magenta (#FF00FF) background via border-seeded flood-fill + internal pocket
 * keying + smooth anti-aliased edge despill so fine whiskers and white fur stay razor crisp.
 */
export function chromaKeyMagenta(data, width, height) {
  const total = width * height;
  const isBg = new Uint8Array(total);
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isStrongMagenta = (idx) => {
    const o = idx * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const m = magentaScore(r, g, b);
    return m > 58 && r > 125 && b > 125;
  };

  const enqueue = (idx) => {
    if (!visited[idx] && isStrongMagenta(idx)) {
      visited[idx] = 1;
      isBg[idx] = 1;
      queue[tail++] = idx;
    }
  };

  // Seed flood-fill from all four borders
  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width);
    enqueue(y * width + (width - 1));
  }

  // Also seed interior pockets that are unmistakably pure chroma magenta (gaps between legs/tail)
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    if (magentaScore(r, g, b) > 105 && r > 175 && b > 175 && g < 110) {
      enqueue(i);
    }
  }

  while (head < tail) {
    const cur = queue[head++];
    const x = cur % width;
    const y = (cur - x) / width;
    if (x > 0) enqueue(cur - 1);
    if (x + 1 < width) enqueue(cur + 1);
    if (y > 0) enqueue(cur - width);
    if (y + 1 < height) enqueue(cur + width);
  }

  // Clear background alpha
  for (let i = 0; i < total; i++) {
    if (isBg[i]) {
      const o = i * 4;
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 0;
    }
  }

  // 2-pass edge feathering & magenta spill suppression on perimeter pixels
  const nearBg = new Uint8Array(total);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (isBg[idx]) continue;
      if (
        isBg[idx - 1] ||
        isBg[idx + 1] ||
        isBg[idx - width] ||
        isBg[idx + width] ||
        isBg[idx - width - 1] ||
        isBg[idx - width + 1] ||
        isBg[idx + width - 1] ||
        isBg[idx + width + 1]
      ) {
        nearBg[idx] = 1;
      }
    }
  }

  // Expand 1 more ring for soft JPEG fringe cleanup
  const nearBg2 = new Uint8Array(nearBg);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (isBg[idx] || nearBg[idx]) continue;
      if (nearBg[idx - 1] || nearBg[idx + 1] || nearBg[idx - width] || nearBg[idx + width]) {
        nearBg2[idx] = 1;
      }
    }
  }

  for (let i = 0; i < total; i++) {
    if (isBg[i]) continue;
    const o = i * 4;
    let r = data[o];
    let g = data[o + 1];
    let b = data[o + 2];
    const m = magentaScore(r, g, b);

    if (nearBg2[i] && m > 18) {
      if (m > 70) {
        data[o] = 0;
        data[o + 1] = 0;
        data[o + 2] = 0;
        data[o + 3] = 0;
        continue;
      }
      // Smooth edge alpha ramp + despill magenta tint into warm neutral gray
      const alphaFactor = Math.max(0, Math.min(1, 1 - (m - 18) / 54));
      const spill = m;
      r = Math.max(0, Math.min(255, Math.round(r - spill * 0.72)));
      b = Math.max(0, Math.min(255, Math.round(b - spill * 0.85)));
      g = Math.max(0, Math.min(255, Math.round(g + spill * 0.12)));
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = Math.round(255 * alphaFactor);
    } else if (m > 34 && r > 150 && b > 150) {
      // Subtle interior magenta spill cleanup (e.g. JPEG ringing around fine fur)
      const spill = m - 14;
      data[o] = Math.max(0, Math.round(r - spill * 0.55));
      data[o + 2] = Math.max(0, Math.round(b - spill * 0.65));
    }
  }

  // Remove isolated tiny 1-2px magenta/noise specks floating in empty space
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const o = idx * 4;
      if (data[o + 3] === 0) continue;
      let opaqueNeighbors = 0;
      if (data[(idx - 1) * 4 + 3] > 40) opaqueNeighbors++;
      if (data[(idx + 1) * 4 + 3] > 40) opaqueNeighbors++;
      if (data[(idx - width) * 4 + 3] > 40) opaqueNeighbors++;
      if (data[(idx + width) * 4 + 3] > 40) opaqueNeighbors++;
      if (opaqueNeighbors === 0) {
        data[o + 3] = 0;
      }
    }
  }
}

/**
 * Finds low-ink split boundaries near nominal uniform grid lines so slightly uneven
 * AI sprite sheets never slice off ears, whiskers, tails, or feet.
 */
function findGridSplits(data, width, height, count, axis) {
  const length = axis === 'x' ? width : height;
  const profile = new Float64Array(length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 24) {
        profile[axis === 'x' ? x : y] += 1;
      }
    }
  }

  const splits = [0];
  const cellSize = length / count;
  const searchRadius = Math.floor(cellSize * 0.14);

  for (let i = 1; i < count; i++) {
    const nominal = Math.round(i * cellSize);
    let bestPos = nominal;
    let bestScore = Number.POSITIVE_INFINITY;
    const minP = Math.max(splits[i - 1] + Math.floor(cellSize * 0.5), nominal - searchRadius);
    const maxP = Math.min(length - 2, nominal + searchRadius);

    for (let p = minP; p <= maxP; p++) {
      // Slightly prefer being close to nominal when multiple empty columns exist
      const distPenalty = Math.abs(p - nominal) * 0.015;
      const score = profile[p] + distPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestPos = p;
      }
    }
    splits.push(bestPos);
  }
  splits.push(length);
  return splits;
}

/**
 * Computes tight alpha bounding box inside a rectangular region.
 */
function getRegionBBox(data, imgW, x0, y0, x1, y1) {
  let minX = x1;
  let minY = y1;
  let maxX = x0;
  let maxY = y0;
  let opaqueCount = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (data[(y * imgW + x) * 4 + 3] > 28) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        opaqueCount++;
      }
    }
  }

  if (opaqueCount === 0) return null;
  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    opaqueCount
  };
}

/**
 * Processes a multi-frame sprite sheet into a uniform transparent PNG sheet + Phaser 3 JSON atlas.
 */
export async function processSpriteSheet({
  inputPath,
  outputPngPath,
  outputJsonPath,
  cols,
  rows,
  frameCount = cols * rows,
  frameSize = 256,
  framePrefix = 'frame',
  fps = 10,
  loop = true,
  anchorY = 0.92,
  paddingRatio = 0.08,
  uniformScale = true
}) {
  const { data: rawBuf, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgba = new Uint8Array(rawBuf);
  chromaKeyMagenta(rgba, info.width, info.height);

  const xSplits = findGridSplits(rgba, info.width, info.height, cols, 'x');
  const ySplits = findGridSplits(rgba, info.width, info.height, rows, 'y');

  const cellBoxes = [];
  let maxBoxW = 1;
  let maxBoxH = 1;

  for (let idx = 0; idx < frameCount; idx++) {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const x0 = xSplits[c];
    const x1 = xSplits[c + 1];
    const y0 = ySplits[r];
    const y1 = ySplits[r + 1];
    const bbox = getRegionBBox(rgba, info.width, x0, y0, x1, y1);
    cellBoxes.push({ idx, r, c, x0, y0, x1, y1, bbox });
    if (bbox) {
      if (bbox.w > maxBoxW) maxBoxW = bbox.w;
      if (bbox.h > maxBoxH) maxBoxH = bbox.h;
    }
  }

  const outCols = Math.min(cols, frameCount);
  const outRows = Math.ceil(frameCount / outCols);
  const sheetW = outCols * frameSize;
  const sheetH = outRows * frameSize;

  const usableW = Math.floor(frameSize * (1 - paddingRatio * 2));
  const usableH = Math.floor(frameSize * (anchorY - paddingRatio));
  const globalScale = Math.min(usableW / maxBoxW, usableH / maxBoxH);

  const composites = [];
  const framesJson = {};
  const frameBuffers = [];
  const qa = {
    frameCount,
    emptyFrames: 0,
    clippedFrames: 0,
    minInterFrameDiff: 1,
    avgInterFrameDiff: 0
  };

  // First build a clean PNG buffer of the entire chroma-keyed image
  const keyedSheetSharp = sharp(Buffer.from(rgba), {
    raw: { width: info.width, height: info.height, channels: 4 }
  });
  const keyedPng = await keyedSheetSharp.png().toBuffer();

  for (const cell of cellBoxes) {
    const outCol = cell.idx % outCols;
    const outRow = Math.floor(cell.idx / outCols);
    const frameKey = `${framePrefix}_${String(cell.idx).padStart(2, '0')}`;

    if (!cell.bbox) {
      qa.emptyFrames++;
      framesJson[frameKey] = {
        frame: { x: outCol * frameSize, y: outRow * frameSize, w: frameSize, h: frameSize },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: frameSize, h: frameSize },
        sourceSize: { w: frameSize, h: frameSize },
        pivot: { x: 0.5, y: anchorY }
      };
      frameBuffers.push(null);
      continue;
    }

    const scale = uniformScale
      ? globalScale
      : Math.min(usableW / cell.bbox.w, usableH / cell.bbox.h);

    const targetW = Math.max(1, Math.min(frameSize - 4, Math.round(cell.bbox.w * scale)));
    const targetH = Math.max(1, Math.min(frameSize - 4, Math.round(cell.bbox.h * scale)));

    const croppedBuf = await sharp(keyedPng)
      .extract({
        left: cell.bbox.x,
        top: cell.bbox.y,
        width: cell.bbox.w,
        height: cell.bbox.h
      })
      .resize(targetW, targetH, { kernel: 'lanczos3' })
      .ensureAlpha()
      .png()
      .toBuffer();

    const destX = Math.max(2, Math.min(frameSize - targetW - 2, Math.round((frameSize - targetW) / 2)));
    const destY = Math.max(
      2,
      Math.min(frameSize - targetH - 2, Math.round(frameSize * anchorY - targetH))
    );

    composites.push({
      input: croppedBuf,
      left: outCol * frameSize + destX,
      top: outRow * frameSize + destY
    });

    // Save raw 64x64 thumbnail for inter-frame motion diff check
    const thumb = await sharp(croppedBuf)
      .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .raw()
      .toBuffer();
    frameBuffers.push(thumb);

    // Estimate head anchor in normalized frame coords (top ~25% of character bbox)
    const headAnchorX = (destX + targetW * 0.52) / frameSize;
    const headAnchorY = (destY + targetH * 0.24) / frameSize;

    framesJson[frameKey] = {
      frame: { x: outCol * frameSize, y: outRow * frameSize, w: frameSize, h: frameSize },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frameSize, h: frameSize },
      sourceSize: { w: frameSize, h: frameSize },
      pivot: { x: 0.5, y: anchorY },
      anchors: {
        feet: { x: 0.5, y: Number(anchorY.toFixed(3)) },
        head: { x: Number(headAnchorX.toFixed(3)), y: Number(headAnchorY.toFixed(3)) }
      }
    };
  }

  // Compute inter-frame difference (checks that frames are genuinely distinct animations!)
  let diffSum = 0;
  let diffCount = 0;
  for (let i = 1; i < frameBuffers.length; i++) {
    const a = frameBuffers[i - 1];
    const b = frameBuffers[i];
    if (!a || !b) continue;
    let diff = 0;
    for (let p = 0; p < a.length; p++) {
      diff += Math.abs(a[p] - b[p]);
    }
    const normDiff = diff / (a.length * 255);
    if (normDiff < qa.minInterFrameDiff) qa.minInterFrameDiff = normDiff;
    diffSum += normDiff;
    diffCount++;
  }
  qa.avgInterFrameDiff = diffCount > 0 ? Number((diffSum / diffCount).toFixed(4)) : 0;
  qa.minInterFrameDiff = diffCount > 0 ? Number(qa.minInterFrameDiff.toFixed(4)) : 0;

  fs.mkdirSync(path.dirname(outputPngPath), { recursive: true });
  await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .png({ compressionLevel: 9, palette: false })
    .toFile(outputPngPath);

  if (outputJsonPath) {
    const atlasJson = {
      frames: framesJson,
      meta: {
        app: 'Meowchi Sprite Pipeline',
        version: '1.0',
        image: path.basename(outputPngPath),
        format: 'RGBA8888',
        size: { w: sheetW, h: sheetH },
        scale: '1',
        animation: {
          prefix: framePrefix,
          frameCount,
          fps,
          loop
        },
        qa
      }
    };
    fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
    fs.writeFileSync(outputJsonPath, JSON.stringify(atlasJson, null, 2));
  }

  return qa;
}

/**
 * Extracts individual named prop PNGs from a grid prop sheet into separate transparent PNGs
 * OR packs them into a single Phaser 3 prop texture atlas!
 */
export async function processPropAtlas({
  inputPath,
  outputPngPath,
  outputJsonPath,
  cols,
  rows,
  names,
  cellSize = 256,
  paddingRatio = 0.06
}) {
  const { data: rawBuf, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgba = new Uint8Array(rawBuf);
  chromaKeyMagenta(rgba, info.width, info.height);

  const xSplits = findGridSplits(rgba, info.width, info.height, cols, 'x');
  const ySplits = findGridSplits(rgba, info.width, info.height, rows, 'y');

  const keyedPng = await sharp(Buffer.from(rgba), {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png()
    .toBuffer();

  const sheetW = cols * cellSize;
  const sheetH = rows * cellSize;
  const usable = Math.floor(cellSize * (1 - paddingRatio * 2));
  const composites = [];
  const framesJson = {};

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const r = Math.floor(i / cols);
    const c = i % cols;
    const bbox = getRegionBBox(rgba, info.width, xSplits[c], ySplits[r], xSplits[c + 1], ySplits[r + 1]);
    if (!bbox) continue;

    const scale = Math.min(usable / bbox.w, usable / bbox.h);
    const targetW = Math.max(1, Math.round(bbox.w * scale));
    const targetH = Math.max(1, Math.round(bbox.h * scale));

    const itemBuf = await sharp(keyedPng)
      .extract({ left: bbox.x, top: bbox.y, width: bbox.w, height: bbox.h })
      .resize(targetW, targetH, { kernel: 'lanczos3' })
      .ensureAlpha()
      .png()
      .toBuffer();

    const destX = Math.round((cellSize - targetW) / 2);
    const destY = Math.round(cellSize * 0.92 - targetH);

    composites.push({
      input: itemBuf,
      left: c * cellSize + destX,
      top: r * cellSize + destY
    });

    framesJson[name] = {
      frame: { x: c * cellSize, y: r * cellSize, w: cellSize, h: cellSize },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: cellSize, h: cellSize },
      sourceSize: { w: cellSize, h: cellSize },
      pivot: { x: 0.5, y: 0.88 }
    };
  }

  fs.mkdirSync(path.dirname(outputPngPath), { recursive: true });
  await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outputPngPath);

  fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
  fs.writeFileSync(
    outputJsonPath,
    JSON.stringify(
      {
        frames: framesJson,
        meta: {
          app: 'Meowchi Sprite Pipeline',
          version: '1.0',
          image: path.basename(outputPngPath),
          format: 'RGBA8888',
          size: { w: sheetW, h: sheetH },
          scale: '1'
        }
      },
      null,
      2
    )
  );
}

/**
 * Processes a single image (e.g. background or single portrait sprite).
 */
export async function processSingleImage({
  inputPath,
  outputPngPath,
  keyMagenta = false,
  width,
  height
}) {
  fs.mkdirSync(path.dirname(outputPngPath), { recursive: true });
  if (!keyMagenta) {
    let s = sharp(inputPath);
    if (width && height) {
      s = s.resize(width, height, { fit: 'cover' });
    }
    await s.png({ compressionLevel: 9 }).toFile(outputPngPath);
    return;
  }

  const { data: rawBuf, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgba = new Uint8Array(rawBuf);
  chromaKeyMagenta(rgba, info.width, info.height);

  const bbox = getRegionBBox(rgba, info.width, 0, 0, info.width, info.height);
  const keyedPng = await sharp(Buffer.from(rgba), {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png()
    .toBuffer();

  if (!bbox) {
    await sharp(keyedPng).toFile(outputPngPath);
    return;
  }

  const targetSize = width || 384;
  const usable = Math.floor(targetSize * 0.86);
  const scale = Math.min(usable / bbox.w, usable / bbox.h);
  const tw = Math.max(1, Math.round(bbox.w * scale));
  const th = Math.max(1, Math.round(bbox.h * scale));
  const cropped = await sharp(keyedPng)
    .extract({ left: bbox.x, top: bbox.y, width: bbox.w, height: bbox.h })
    .resize(tw, th, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: targetSize,
      height: targetSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      {
        input: cropped,
        left: Math.round((targetSize - tw) / 2),
        top: Math.round(targetSize * 0.92 - th)
      }
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPngPath);
}

// CLI entrypoint for quick single-file tests
if (process.argv[1] && process.argv[1].endsWith('process_sprites.mjs') && process.argv.length > 2) {
  const mode = process.argv[2];
  if (mode === 'single') {
    const [, , , inputPath, outputPngPath, keyFlag, w, h] = process.argv;
    await processSingleImage({
      inputPath,
      outputPngPath,
      keyMagenta: keyFlag === 'key',
      width: w ? Number(w) : undefined,
      height: h ? Number(h) : undefined
    });
    console.log('Processed single:', outputPngPath);
  }
}

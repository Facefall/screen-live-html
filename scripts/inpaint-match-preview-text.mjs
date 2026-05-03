/**
 * 赛事预告侧栏底图：
 * - 默认：带字 PNG（517×760）抹姓名/时间 + 抠黑底 → match-preview.clean.alpha.png
 * - --no-inpaint：已是干净背景（默认优先 assets/match-preview-latest.png，其次 match-preview-bg.jpg/.png）→ 仅抠黑底
 *
 * 用法：
 *   npm run inpaint-match-preview
 *   npm run match-preview-bg
 *   node scripts/inpaint-match-preview-text.mjs --no-inpaint ./public/assets/foo.png ./out.alpha.png
 */
import fs from "fs";
import jpeg from "jpeg-js";
import path from "path";
import { PNG } from "pngjs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "public", "assets");

const DEFAULT_IN = path.join(ASSETS, "match-preview-with-name.png");
const DEFAULT_TEMPLATE_LATEST = path.join(ASSETS, "match-preview-latest.png");
const DEFAULT_TEMPLATE_JPEG = path.join(ASSETS, "match-preview-bg.jpg");
const DEFAULT_TEMPLATE_PNG_ALT = path.join(ASSETS, "match-preview-bg.png");
const DEFAULT_OUT = path.join(ASSETS, "match-preview.clean.alpha.png");

/** @param {PNG} png */
function lumAt(png, x, y) {
  const i = (png.width * y + x) << 2;
  const { data } = png;
  return Math.max(data[i], data[i + 1], data[i + 2]);
}

/**
 * @param {PNG} png
 * @param {number} x0 @param {number} x1 @param {number} y0 @param {number} y1
 * @param {number} thresh
 */
function brightBBox(png, x0, x1, y0, y1, thresh) {
  const { width: w, data } = png;
  let minX = Infinity,
    minY = Infinity,
    maxX = 0,
    maxY = 0,
    c = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (lumAt(png, x, y) > thresh) {
        c++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return c > 30 ? { minX, minY, maxX, maxY } : null;
}

/** @param {PNG} png */
function detectVsBoxes(png) {
  const h = png.height;
  /** 三张卡片大致纵向分区（相对 760 高稿），仅在区内找 VS 白块 */
  const zones = [
    [120, Math.min(275, h - 2)],
    [280, Math.min(448, h - 2)],
    [488, Math.min(598, h - 2)],
  ];
  const boxes = [];
  for (const [y0, y1] of zones) {
    const b = brightBBox(png, 175, 350, y0, y1, 175);
    if (b) boxes.push(b);
  }
  return boxes;
}

/**
 * 横向插值：适用于横向较长的条带（选手名区域）。
 * @param {PNG} png
 * @param {number} pad 采样端点相对抹去区向外偏移的像素数
 */
function inpaintHorizontal(png, x0, x1, y0, y1, pad = 3) {
  const { width, height, data } = png;
  const xa = Math.max(0, x0 - pad);
  const xb = Math.min(width - 1, x1 + pad);
  for (let y = y0; y <= y1; y++) {
    if (y < 0 || y >= height) continue;
    const ia = (width * y + xa) << 2;
    const ib = (width * y + xb) << 2;
    const denom = Math.max(1e-6, xb - xa);
    for (let x = x0; x <= x1; x++) {
      const t = (x - xa) / denom;
      const i = (width * y + x) << 2;
      for (let c = 0; c < 3; c++) {
        data[i + c] = Math.round(data[ia + c] * (1 - t) + data[ib + c] * t);
      }
      data[i + 3] = 255;
    }
  }
}

/**
 * 纵向插值：适用于矮而宽的条带（开始时间一行）。
 * @param {PNG} png
 */
function inpaintVertical(png, x0, x1, y0, y1, pad = 3) {
  const { width, height, data } = png;
  const ya = Math.max(0, y0 - pad);
  const yb = Math.min(height - 1, y1 + pad);
  const denom = Math.max(1e-6, yb - ya);
  for (let x = x0; x <= x1; x++) {
    if (x < 0 || x >= width) continue;
    const ia = (width * ya + x) << 2;
    const ib = (width * yb + x) << 2;
    for (let y = y0; y <= y1; y++) {
      const s = (y - ya) / denom;
      const i = (width * y + x) << 2;
      for (let c = 0; c < 3; c++) {
        data[i + c] = Math.round(data[ia + c] * (1 - s) + data[ib + c] * s);
      }
      data[i + 3] = 255;
    }
  }
}

/**
 * @param {PNG} png
 * @param {{ minX: number; minY: number; maxX: number; maxY: number }} vs
 */
function rectsForCard(png, vs) {
  const w = png.width;
  const h = png.height;
  const ny0 = vs.minY - 8;
  const ny1 = vs.maxY + 6;

  const leftName = brightBBox(png, 22, vs.minX - 12, ny0, ny1, 72);
  const rightName = brightBBox(png, vs.maxX + 12, w - 18, ny0, ny1, 72);

  /** 开始时间：VS 下方一行；限制高度避免带上页脚羽毛球等区域 */
  const sy0 = vs.maxY + 4;
  const sy1 = Math.min(vs.maxY + 34, h - 95);
  let status = brightBBox(png, 105, w - 105, sy0, sy1, 68);
  if (status && status.maxY - status.minY > 26) {
    status = { ...status, maxY: status.minY + 24 };
  }

  const pad = (box, px, py) =>
    box
      ? {
          x0: Math.max(0, box.minX - px),
          y0: Math.max(0, box.minY - py),
          x1: Math.min(w - 1, box.maxX + px),
          y1: Math.min(h - 1, box.maxY + py),
        }
      : null;

  /** 再外扩一圈，吃掉文字抗锯齿与外发光 */
  const widen = (box, wx, wy) =>
    box
      ? {
          x0: Math.max(0, box.x0 - wx),
          y0: Math.max(0, box.y0 - wy),
          x1: Math.min(w - 1, box.x1 + wx),
          y1: Math.min(h - 1, box.y1 + wy),
        }
      : null;

  const left = widen(pad(leftName, 4, 3), 8, 5);
  const right = widen(pad(rightName, 4, 3), 10, 5);
  const st = widen(pad(status, 6, 4), 6, 5);

  if (left && left.x1 > vs.minX - 4) left.x1 = vs.minX - 4;
  if (right && right.x0 < vs.maxX + 4) right.x0 = vs.maxX + 4;

  return { left, right, status: st };
}

/** @param {PNG} png */
function processPreview(png) {
  const vsList = detectVsBoxes(png);
  if (vsList.length !== 3) {
    console.warn(
      `[inpaint-match-preview] 期望检测到 3 个 VS 白块，实际 ${vsList.length}；仍将处理检测到的块`,
    );
  }

  for (const vs of vsList) {
    const { left, right, status } = rectsForCard(png, vs);
    if (left && left.x1 > left.x0 && left.y1 > left.y0) {
      inpaintHorizontal(png, left.x0, left.x1, left.y0, left.y1, 14);
    }
    if (right && right.x1 > right.x0 && right.y1 > right.y0) {
      inpaintHorizontal(png, right.x0, right.x1, right.y0, right.y1, 14);
    }
    if (status && status.x1 > status.x0 && status.y1 > status.y0) {
      inpaintVertical(png, status.x0, status.x1, status.y0, status.y1, 12);
      inpaintHorizontal(png, status.x0, status.x1, status.y0, status.y1, 14);
    }
  }
}

/** 与 scripts/knockout-hud-pngs.mjs 一致的近黑抠透明 */
function knockNearBlack(png, blackIn = 22, blackOut = 48) {
  const { width, height, data } = png;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      const lum = Math.max(data[i], data[i + 1], data[i + 2]);
      const aIn = data[i + 3];
      let aOut = aIn;
      if (lum <= blackIn) {
        aOut = 0;
      } else if (lum < blackOut) {
        const t = (lum - blackIn) / (blackOut - blackIn);
        aOut = Math.round(Math.min(aIn, Math.round(aIn * t)));
      }
      data[i + 3] = aOut;
    }
  }
}

/** @returns {{ flags: Set<string>; positional: string[] }} */
function parseCli(argv) {
  const flags = new Set();
  const positional = [];
  for (const a of argv) {
    if (a.startsWith("--")) flags.add(a.slice(2));
    else positional.push(a);
  }
  return { flags, positional };
}

function resolveTemplateBgPath() {
  if (fs.existsSync(DEFAULT_TEMPLATE_LATEST)) return DEFAULT_TEMPLATE_LATEST;
  if (fs.existsSync(DEFAULT_TEMPLATE_JPEG)) return DEFAULT_TEMPLATE_JPEG;
  if (fs.existsSync(DEFAULT_TEMPLATE_PNG_ALT)) return DEFAULT_TEMPLATE_PNG_ALT;
  return DEFAULT_TEMPLATE_LATEST;
}

/**
 * JPEG / PNG → pngjs PNG（RGBA）
 * @param {string} filePath
 */
function loadImage(filePath) {
  const raw = fs.readFileSync(filePath);
  const isJpeg =
    raw.length >= 3 && raw[0] === 0xff && raw[1] === 0xd8 && raw[2] === 0xff;

  if (isJpeg) {
    const decoded = jpeg.decode(raw, { useTArray: true });
    const { width, height, data } = decoded;
    const png = new PNG({ width, height });
    const n = width * height;
    const bpp = Math.round(data.length / n);
    if (bpp === 4) {
      png.data.set(data);
    } else if (bpp === 3) {
      for (let i = 0; i < n; i++) {
        png.data[i * 4] = data[i * 3];
        png.data[i * 4 + 1] = data[i * 3 + 1];
        png.data[i * 4 + 2] = data[i * 3 + 2];
        png.data[i * 4 + 3] = 255;
      }
    } else {
      throw new Error(`[inpaint-match-preview] 无法解析 JPEG 通道数 (bpp=${bpp})`);
    }
    return png;
  }

  return PNG.sync.read(raw);
}

const { flags, positional } = parseCli(process.argv.slice(2));
const noInpaint = flags.has("no-inpaint");

const inputPath = positional[0]
  ? path.resolve(process.cwd(), positional[0])
  : noInpaint
    ? resolveTemplateBgPath()
    : DEFAULT_IN;
const outputPath = positional[1]
  ? path.resolve(process.cwd(), positional[1])
  : DEFAULT_OUT;

if (!fs.existsSync(inputPath)) {
  console.error(`[inpaint-match-preview] 找不到输入: ${inputPath}`);
  process.exit(1);
}

const png = loadImage(inputPath);
if (!noInpaint && (png.width !== 517 || png.height !== 760)) {
  console.warn(
    `[inpaint-match-preview] 警告：抹字逻辑针对 517×760 调校；当前 ${png.width}×${png.height}，检测框可能偏差。`,
  );
}
if (noInpaint) {
  console.log(
    `[inpaint-match-preview] --no-inpaint：跳过抹字；尺寸 ${png.width}×${png.height}`,
  );
}

if (!noInpaint) {
  processPreview(png);
}
knockNearBlack(png, 22, 48);
fs.writeFileSync(outputPath, PNG.sync.write(png));
console.log(
  `[inpaint-match-preview] ${path.relative(ROOT, inputPath)} → ${path.relative(ROOT, outputPath)}`,
);

import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CONFIG_PATH = path.join(ROOT, 'config', 'display.json');
const CONFIG_V2_PATH = path.join(ROOT, 'config', 'display_v2.json');
const CONFIG_V3_PATH = path.join(ROOT, 'config', 'display_v3.json');
const COPY_LABELS_PATH = path.join(ROOT, 'config', 'display-copy-labels.json');
const COPY_LABELS_V2_PATH = path.join(ROOT, 'config', 'display-copy-labels-v2.json');
const COPY_LABELS_V3_PATH = path.join(ROOT, 'config', 'display-copy-labels-v3.json');
const PORT = Number(process.env.PORT) || 5173;

/** @type {Set<http.ServerResponse>} */
const sseClients = new Set();

/** @type {Set<http.ServerResponse>} */
const sseClientsV2 = new Set();

/** @type {Set<http.ServerResponse>} */
const sseClientsV3 = new Set();

/** @type {ReturnType<typeof setTimeout> | undefined} */
let broadcastDebounce;

/**
 * @param {http.ServerResponse} res
 * @param {string} event
 * @param {string | object} data
 */
function sseWrite(res, event, data) {
  const line =
    typeof data === 'string' ? data : JSON.stringify(data);
  const escaped = line.replace(/\n/g, '\ndata: ');
  res.write(`event: ${event}\ndata: ${escaped}\n\n`);
}

/**
 * @param {Set<http.ServerResponse>} clients
 * @param {string} event
 * @param {string | object} payload
 */
function broadcastTo(clients, event, payload) {
  for (const res of clients) {
    try {
      sseWrite(res, event, payload);
    } catch {
      clients.delete(res);
    }
  }
}

/**
 * Optional per-key hints for preview UI; keyed like `copy` in display.json.
 * @returns {Promise<Record<string, string>>}
 */
async function readCopyHintsParsed() {
  try {
    const raw = await fs.readFile(COPY_LABELS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, v]) => typeof v === 'string' && v.trim() !== '',
      ),
    );
  } catch {
    return {};
  }
}

/**
 * Optional per-key hints for preview_v2 UI; keyed like `copy` / `images` keys in display_v2.json.
 * @returns {Promise<Record<string, string>>}
 */
async function readCopyHintsV2Parsed() {
  try {
    const raw = await fs.readFile(COPY_LABELS_V2_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, v]) => typeof v === 'string' && v.trim() !== '',
      ),
    );
  } catch {
    return {};
  }
}

/**
 * Optional per-key hints for preview_v3 UI; keyed like `copy` / `images` keys in display_v3.json.
 * @returns {Promise<Record<string, string>>}
 */
async function readCopyHintsV3Parsed() {
  try {
    const raw = await fs.readFile(COPY_LABELS_V3_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, v]) => typeof v === 'string' && v.trim() !== '',
      ),
    );
  } catch {
    return {};
  }
}

async function readConfigParsed() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) {
    throw new Error('Config root must be a JSON object');
  }
  const copy = typeof data.copy === 'object' && data.copy !== null ? data.copy : {};
  const images =
    typeof data.images === 'object' && data.images !== null ? data.images : {};
  const safeCopy = Object.fromEntries(
    Object.entries(copy).filter(
      ([, v]) => typeof v === 'string' || typeof v === 'number',
    ),
  );
  const safeImages = Object.fromEntries(
    Object.entries(images).filter(([, v]) => typeof v === 'string'),
  );
  const copyHints = await readCopyHintsParsed();
  return { copy: safeCopy, images: safeImages, copyHints };
}

async function readConfigV2Parsed() {
  const raw = await fs.readFile(CONFIG_V2_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) {
    throw new Error('display_v2.json root must be a JSON object');
  }
  const copy = typeof data.copy === 'object' && data.copy !== null ? data.copy : {};
  const images =
    typeof data.images === 'object' && data.images !== null ? data.images : {};
  const safeCopy = Object.fromEntries(
    Object.entries(copy).filter(
      ([, v]) => typeof v === 'string' || typeof v === 'number',
    ),
  );
  const safeImages = Object.fromEntries(
    Object.entries(images).filter(([, v]) => typeof v === 'string'),
  );
  const copyHints = await readCopyHintsV2Parsed();
  return { copy: safeCopy, images: safeImages, copyHints };
}

async function readConfigV3Parsed() {
  const raw = await fs.readFile(CONFIG_V3_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) {
    throw new Error('display_v3.json root must be a JSON object');
  }
  const copy = typeof data.copy === 'object' && data.copy !== null ? data.copy : {};
  const images =
    typeof data.images === 'object' && data.images !== null ? data.images : {};
  const safeCopy = Object.fromEntries(
    Object.entries(copy).filter(
      ([, v]) => typeof v === 'string' || typeof v === 'number',
    ),
  );
  const safeImages = Object.fromEntries(
    Object.entries(images).filter(([, v]) => typeof v === 'string'),
  );
  const copyHints = await readCopyHintsV3Parsed();
  return { copy: safeCopy, images: safeImages, copyHints };
}

async function safeReadAndBroadcast(reason) {
  try {
    const value = await readConfigParsed();
    broadcastTo(sseClients, 'snapshot', value);
    if (reason) console.log(`[display] snapshot (${reason})`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    broadcastTo(sseClients, 'config-error', { message });
    console.error(`[display] config error: ${message}`);
  }

  try {
    const value = await readConfigV2Parsed();
    broadcastTo(sseClientsV2, 'snapshot', value);
    if (reason) console.log(`[display-v2] snapshot (${reason})`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    broadcastTo(sseClientsV2, 'config-error', { message });
    console.error(`[display-v2] config error: ${message}`);
  }

  try {
    const value = await readConfigV3Parsed();
    broadcastTo(sseClientsV3, 'snapshot', value);
    if (reason) console.log(`[display-v3] snapshot (${reason})`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    broadcastTo(sseClientsV3, 'config-error', { message });
    console.error(`[display-v3] config error: ${message}`);
  }
}

const MAX_PATCH_BODY_BYTES = 512 * 1024;

/**
 * @returns {Promise<Record<string, unknown>>}
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_PATCH_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw.trim()) resolve({});
        else resolve(JSON.parse(raw));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    req.on('error', (e) => reject(e));
  });
}

/**
 * @param {{ copy?: Record<string, unknown>; images?: Record<string, unknown> }} body
 * @param {string} configPath
 */
async function applyDisplayPatchTo(body, configPath) {
  const raw = await fs.readFile(configPath, 'utf8');
  const data = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) {
    throw new Error('Config root must be a JSON object');
  }
  if (typeof data.copy !== 'object' || data.copy === null) {
    throw new Error('Config.copy must be an object');
  }
  if (typeof data.images !== 'object' || data.images === null) {
    throw new Error('Config.images must be an object');
  }

  /** @type {string[]} */
  const errors = [];

  if ('copy' in body && body.copy !== undefined) {
    if (typeof body.copy !== 'object' || body.copy === null) {
      throw new Error('body.copy must be an object');
    }
    const cur = /** @type {Record<string, unknown>} */ (data.copy);
    for (const [k, v] of Object.entries(body.copy)) {
      if (!Object.prototype.hasOwnProperty.call(cur, k)) {
        errors.push(`unknown copy key: ${k}`);
        continue;
      }
      if (v === null || v === undefined) {
        errors.push(`copy.${k}: value required`);
        continue;
      }
      if (typeof v !== 'string' && typeof v !== 'number') {
        errors.push(`copy.${k}: must be string or number`);
        continue;
      }
      cur[k] = String(v);
    }
  }

  if ('images' in body && body.images !== undefined) {
    if (typeof body.images !== 'object' || body.images === null) {
      throw new Error('body.images must be an object');
    }
    const cur = /** @type {Record<string, unknown>} */ (data.images);
    for (const [k, v] of Object.entries(body.images)) {
      if (!Object.prototype.hasOwnProperty.call(cur, k)) {
        errors.push(`unknown images key: ${k}`);
        continue;
      }
      if (v === null || v === undefined) {
        errors.push(`images.${k}: value required`);
        continue;
      }
      if (typeof v !== 'string' && typeof v !== 'number') {
        errors.push(`images.${k}: must be string or number`);
        continue;
      }
      cur[k] = String(v);
    }
  }

  if (errors.length) {
    throw new Error(errors.join('; '));
  }

  const text = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(configPath, text, 'utf8');
}

/** @param {{ copy?: Record<string, unknown>; images?: Record<string, unknown> }} body */
async function applyDisplayPatch(body) {
  await applyDisplayPatchTo(body, CONFIG_PATH);
}

/** @param {{ copy?: Record<string, unknown>; images?: Record<string, unknown> }} body */
async function applyDisplayPatchV2(body) {
  await applyDisplayPatchTo(body, CONFIG_V2_PATH);
}

/** @param {{ copy?: Record<string, unknown>; images?: Record<string, unknown> }} body */
async function applyDisplayPatchV3(body) {
  await applyDisplayPatchTo(body, CONFIG_V3_PATH);
}

function scheduleBroadcast(reason) {
  clearTimeout(broadcastDebounce);
  broadcastDebounce = setTimeout(() => {
    broadcastDebounce = undefined;
    void safeReadAndBroadcast(reason);
  }, 80);
}

/**
 * @param {string} publicRoot
 * @param {string} pathname
 */
function resolvedPublicPath(publicRoot, pathname) {
  const trimmed = pathname.split('?')[0] ?? '/';
  const rel = trimmed === '/' ? '' : trimmed.replace(/^\/+/, '');
  let target = path.join(publicRoot, rel);
  target = path.resolve(target);
  const rootResolved = path.resolve(publicRoot);
  if (!target.startsWith(rootResolved + path.sep) && target !== rootResolved) {
    return null;
  }
  return target;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleSse(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  if (req.socket.setKeepAlive) req.socket.setKeepAlive(true);

  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
    try {
      res.end();
    } catch { }
  });

  try {
    const value = await readConfigParsed();
    sseWrite(res, 'snapshot', value);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    sseWrite(res, 'config-error', { message });
  }
}

/**
 * badminton_v2 专用：读取 config/display_v2.json 并向连接的客户端推送快照。
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleSseV2(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  if (req.socket.setKeepAlive) req.socket.setKeepAlive(true);

  sseClientsV2.add(res);
  req.on('close', () => {
    sseClientsV2.delete(res);
    try {
      res.end();
    } catch { }
  });

  try {
    const value = await readConfigV2Parsed();
    sseWrite(res, 'snapshot', value);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    sseWrite(res, 'config-error', { message });
  }
}

/**
 * badminton_v3 专用：读取 config/display_v3.json 并向连接的客户端推送快照。
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleSseV3(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  if (req.socket.setKeepAlive) req.socket.setKeepAlive(true);

  sseClientsV3.add(res);
  req.on('close', () => {
    sseClientsV3.delete(res);
    try {
      res.end();
    } catch { }
  });

  try {
    const value = await readConfigV3Parsed();
    sseWrite(res, 'snapshot', value);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    sseWrite(res, 'config-error', { message });
  }
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleStatic(req, res) {
  const urlObj = new URL(req.url ?? '/', `http://${req.headers.host}`);
  let pathname = urlObj.pathname;
  const filePath = resolvedPublicPath(PUBLIC_DIR, pathname);
  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let statPath = filePath;
  try {
    let st = await fs.stat(statPath);
    if (st.isDirectory()) {
      statPath = path.join(statPath, 'index.html');
      st = await fs.stat(statPath);
      if (!st.isFile()) {
        res.writeHead(403).end('Forbidden');
        return;
      }
    } else if (!st.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const buf = await fs.readFile(statPath);
    const ext = path.extname(statPath).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';
    if (req.method === 'HEAD') {
      res
        .writeHead(200, {
          'Content-Type': type,
          'Content-Length': Buffer.byteLength(buf),
        })
        .end();
      return;
    }
    res.writeHead(200, { 'Content-Type': type }).end(buf);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

/**
 * @param {string | undefined} url
 */
function requestPath(url) {
  const pathOnly = url?.split('?')[0] ?? '/';
  if (pathOnly.length <= 1) return pathOnly;
  return pathOnly.replace(/\/+$/, '') || '/';
}

const server = http.createServer(async (req, res) => {
  const pathname = requestPath(req.url);

  if (req.method === 'GET' && pathname === '/events') {
    await handleSse(req, res);
    return;
  }
  if (req.method === 'HEAD' && pathname === '/events') {
    res.writeHead(405, { Allow: 'GET' }).end();
    return;
  }

  if (req.method === 'GET' && pathname === '/events/v2') {
    await handleSseV2(req, res);
    return;
  }
  if (req.method === 'HEAD' && pathname === '/events/v2') {
    res.writeHead(405, { Allow: 'GET' }).end();
    return;
  }

  if (req.method === 'GET' && pathname === '/events/v3') {
    await handleSseV3(req, res);
    return;
  }
  if (req.method === 'HEAD' && pathname === '/events/v3') {
    res.writeHead(405, { Allow: 'GET' }).end();
    return;
  }

  if (req.method === 'GET' && pathname === '/api/display-v2') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const value = await readConfigV2Parsed();
      res.writeHead(200).end(JSON.stringify(value));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.writeHead(500).end(JSON.stringify({ error: message }));
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/api/display-v3') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const value = await readConfigV3Parsed();
      res.writeHead(200).end(JSON.stringify(value));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.writeHead(500).end(JSON.stringify({ error: message }));
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/display/patch') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const body = await readJsonBody(req);
      if (typeof body !== 'object' || body === null) {
        res.writeHead(400).end(JSON.stringify({ ok: false, error: 'Body must be a JSON object' }));
        return;
      }
      if (!('copy' in body) && !('images' in body)) {
        res
          .writeHead(400)
          .end(JSON.stringify({ ok: false, error: 'Provide copy and/or images' }));
        return;
      }
      await applyDisplayPatch(/** @type {{ copy?: Record<string, unknown>; images?: Record<string, unknown> }} */(body));
      scheduleBroadcast('api patch');
      res.writeHead(200).end(JSON.stringify({ ok: true }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[display] PATCH error: ${message}`);
      const clientError =
        e instanceof SyntaxError ||
        message === 'Request body too large' ||
        /^unknown (copy|images) key/.test(message) ||
        /must be string or number/.test(message) ||
        /: value required/.test(message) ||
        /^(body\.(copy|images)|Config\.)/.test(message) ||
        message === 'Body must be a JSON object' ||
        message === 'Provide copy and/or images';
      const status = message === 'Request body too large' ? 413 : clientError ? 400 : 500;
      res.writeHead(status).end(JSON.stringify({ ok: false, error: message }));
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/display-v2/patch') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const body = await readJsonBody(req);
      if (typeof body !== 'object' || body === null) {
        res.writeHead(400).end(JSON.stringify({ ok: false, error: 'Body must be a JSON object' }));
        return;
      }
      if (!('copy' in body) && !('images' in body)) {
        res
          .writeHead(400)
          .end(JSON.stringify({ ok: false, error: 'Provide copy and/or images' }));
        return;
      }
      await applyDisplayPatchV2(/** @type {{ copy?: Record<string, unknown>; images?: Record<string, unknown> }} */(body));
      scheduleBroadcast('api patch v2');
      res.writeHead(200).end(JSON.stringify({ ok: true }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[display-v2] PATCH error: ${message}`);
      const clientError =
        e instanceof SyntaxError ||
        message === 'Request body too large' ||
        /^unknown (copy|images) key/.test(message) ||
        /must be string or number/.test(message) ||
        /: value required/.test(message) ||
        /^(body\.(copy|images)|Config\.)/.test(message) ||
        message === 'Body must be a JSON object' ||
        message === 'Provide copy and/or images';
      const status = message === 'Request body too large' ? 413 : clientError ? 400 : 500;
      res.writeHead(status).end(JSON.stringify({ ok: false, error: message }));
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/display-v3/patch') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const body = await readJsonBody(req);
      if (typeof body !== 'object' || body === null) {
        res.writeHead(400).end(JSON.stringify({ ok: false, error: 'Body must be a JSON object' }));
        return;
      }
      if (!('copy' in body) && !('images' in body)) {
        res
          .writeHead(400)
          .end(JSON.stringify({ ok: false, error: 'Provide copy and/or images' }));
        return;
      }
      await applyDisplayPatchV3(/** @type {{ copy?: Record<string, unknown>; images?: Record<string, unknown> }} */(body));
      scheduleBroadcast('api patch v3');
      res.writeHead(200).end(JSON.stringify({ ok: true }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[display-v3] PATCH error: ${message}`);
      const clientError =
        e instanceof SyntaxError ||
        message === 'Request body too large' ||
        /^unknown (copy|images) key/.test(message) ||
        /must be string or number/.test(message) ||
        /: value required/.test(message) ||
        /^(body\.(copy|images)|Config\.)/.test(message) ||
        message === 'Body must be a JSON object' ||
        message === 'Provide copy and/or images';
      const status = message === 'Request body too large' ? 413 : clientError ? 400 : 500;
      res.writeHead(status).end(JSON.stringify({ ok: false, error: message }));
    }
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    await handleStatic(req, res);
    return;
  }
  res.writeHead(405, { Allow: 'GET, HEAD, POST' }).end();
});

chokidar
  .watch(
    [
      CONFIG_PATH,
      COPY_LABELS_PATH,
      CONFIG_V2_PATH,
      COPY_LABELS_V2_PATH,
      CONFIG_V3_PATH,
      COPY_LABELS_V3_PATH,
    ],
    { ignoreInitial: true },
  )
  .on('change', () => scheduleBroadcast('file change'));

server.listen(PORT, () => {
  console.log(
    `[screen-live] http://localhost:${PORT}/ — display ${path.relative(process.cwd(), CONFIG_PATH)}, display_v2 ${path.relative(process.cwd(), CONFIG_V2_PATH)}, display_v3 ${path.relative(process.cwd(), CONFIG_V3_PATH)}`,
  );
});

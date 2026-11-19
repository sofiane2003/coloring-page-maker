// Shared setup for the release checks: a local stand-in for the Workers AI
// binding that draws a simple outline picture, so suites never call Cloudflare.
import { deflateSync } from "node:zlib";
import { startRuntime } from "/home/user/oss-new/control/runtime/index.mjs";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** A grayscale PNG of a cottage, a sun, a tree and flowers in black outlines. */
export function drawOutlinePng(width, height) {
  const pixels = Buffer.alloc(width * height, 255);
  const stroke = Math.max(3, Math.round(width / 160));
  const dot = (x, y) => {
    for (let dy = -stroke; dy <= stroke; dy++)
      for (let dx = -stroke; dx <= stroke; dx++) {
        if (dx * dx + dy * dy > stroke * stroke) continue;
        const px = Math.round(x + dx), py = Math.round(y + dy);
        if (px >= 0 && py >= 0 && px < width && py < height) pixels[py * width + px] = 0;
      }
  };
  const line = (x1, y1, x2, y2) => {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (stroke / 2)) + 1;
    for (let i = 0; i <= steps; i++) dot(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
  };
  const circle = (cx, cy, r) => {
    const steps = Math.ceil((2 * Math.PI * r) / (stroke / 2)) + 1;
    for (let i = 0; i <= steps; i++) dot(cx + r * Math.cos((2 * Math.PI * i) / steps), cy + r * Math.sin((2 * Math.PI * i) / steps));
  };
  const rect = (x, y, w, h) => { line(x, y, x + w, y); line(x + w, y, x + w, y + h); line(x + w, y + h, x, y + h); line(x, y + h, x, y); };
  const W = width, H = height, u = Math.min(W, H) / 100;
  const ground = H * 0.8;
  line(0, ground, W, ground);
  // Sun with rays.
  const sx = W * 0.8, sy = H * 0.17, sr = 9 * u;
  circle(sx, sy, sr);
  for (let i = 0; i < 10; i++) {
    const a = (2 * Math.PI * i) / 10;
    line(sx + Math.cos(a) * (sr + 3 * u), sy + Math.sin(a) * (sr + 3 * u), sx + Math.cos(a) * (sr + 8 * u), sy + Math.sin(a) * (sr + 8 * u));
  }
  // Cottage.
  const hx = W * 0.2, hw = 34 * u, hh = 26 * u, hy = ground - hh;
  rect(hx, hy, hw, hh);
  line(hx - 4 * u, hy, hx + hw / 2, hy - 20 * u);
  line(hx + hw / 2, hy - 20 * u, hx + hw + 4 * u, hy);
  line(hx - 4 * u, hy, hx + hw + 4 * u, hy);
  rect(hx + hw * 0.4, ground - 15 * u, hw * 0.2, 15 * u);
  rect(hx + 4 * u, hy + 5 * u, 7 * u, 7 * u);
  rect(hx + hw - 11 * u, hy + 5 * u, 7 * u, 7 * u);
  // Tree.
  const tx = W * 0.75;
  rect(tx - 3 * u, ground - 22 * u, 6 * u, 22 * u);
  circle(tx, ground - 32 * u, 13 * u);
  // Flowers.
  for (const fx of [W * 0.08, W * 0.6, W * 0.92]) {
    line(fx, ground, fx, ground - 8 * u);
    circle(fx, ground - 11 * u, 2.5 * u);
    for (let i = 0; i < 5; i++) {
      const a = (2 * Math.PI * i) / 5;
      circle(fx + Math.cos(a) * 4.5 * u, ground - 11 * u + Math.sin(a) * 4.5 * u, 2 * u);
    }
  }
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) pixels.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // grayscale
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const SIZES = [[768, 1024], [1024, 1024], [1024, 768]];

/** The fake model: any prompt containing FAILME fails, as an unavailable model would. */
function fakeAiWorker() {
  const images = Object.fromEntries(SIZES.map(([w, h]) => [`${w}x${h}`, drawOutlinePng(w, h).toString("base64")]));
  const source = `
import { WorkerEntrypoint } from "cloudflare:workers";
const IMAGES = ${JSON.stringify(images)};
export default class extends WorkerEntrypoint {
  async run(model, inputs) {
    if (String(inputs?.prompt ?? "").includes("FAILME")) throw new Error("AI model unavailable");
    const key = (inputs?.width ?? 1024) + "x" + (inputs?.height ?? 1024);
    const b64 = IMAGES[key] ?? IMAGES["1024x1024"];
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
  }
  async fetch() { return new Response("not used", { status: 404 }); }
}`;
  return { config: { name: "fake-ai", compatibilityDate: "2026-06-01", manifest: { mainModule: "fake-ai.mjs", modules: { "fake-ai.mjs": { type: "esm", contents: Buffer.from(source) } } } } };
}

export function startApp({ bindings = {}, ...rest } = {}) {
  return startRuntime({
    bindings: { AI: { type: "worker", worker: "fake-ai" }, ...bindings },
    workers: [fakeAiWorker()],
    ...rest,
  });
}

/** Rows of a table, for direct assertions. */
export async function rows(runtime, sql, ...params) {
  const result = await (await runtime.database()).prepare(sql).bind(...params).all();
  return result.results;
}

export function isPng(bytes) {
  const b = new Uint8Array(bytes);
  return b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71;
}

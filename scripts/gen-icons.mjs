/**
 * Pure Node.js icon generator — no external dependencies.
 * Generates icon-192.png and icon-512.png: gold coin with bar chart.
 */
import { deflateSync } from "zlib";
import { writeFileSync } from "fs";

// ── CRC32 ─────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = (CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([lenBuf, t, data, crcBuf]);
}

function makePNG(w, h, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Build raw (filter=0 + row data)
  const rowBytes = w * 4;
  const raw = Buffer.allocUnsafe(h * (rowBytes + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (rowBytes + 1)] = 0;
    pixels.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── drawing ───────────────────────────────────────────────────────────────────

function drawIcon(SIZE) {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const S = SIZE / 512; // scale factor

  function setPixel(x, y, r, g, b, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    const i = (y * SIZE + x) * 4;
    const fa = a / 255;
    buf[i]   = Math.round(buf[i]   * (1 - fa) + r * fa);
    buf[i+1] = Math.round(buf[i+1] * (1 - fa) + g * fa);
    buf[i+2] = Math.round(buf[i+2] * (1 - fa) + b * fa);
    buf[i+3] = 255;
  }

  // Background: #0f172a
  buf.fill(0);
  for (let i = 0; i < SIZE * SIZE; i++) {
    buf[i * 4]     = 15;
    buf[i * 4 + 1] = 23;
    buf[i * 4 + 2] = 42;
    buf[i * 4 + 3] = 255;
  }

  const goldOuterR = 210 * S;
  const goldInnerR = 195 * S;
  const rimR       = 215 * S; // outer rim slightly darker

  // Draw gold coin with radial gradient
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Outer dark rim
      if (dist < rimR + 1) {
        const t = Math.min(1, dist / goldOuterR);
        // center: #fde68a (253,230,138) → edge outer: #b45309 (180,83,9)
        let r, g, b;
        if (dist <= goldInnerR) {
          // inner bright zone gradient: #fde68a → #f59e0b
          const ti = dist / goldInnerR;
          r = Math.round(253 + (245 - 253) * ti);
          g = Math.round(230 + (158 - 230) * ti);
          b = Math.round(138 + (11  - 138) * ti);
        } else {
          // rim gradient: #f59e0b → #92400e
          const ti = (dist - goldInnerR) / (rimR - goldInnerR);
          r = Math.round(245 + (146 - 245) * ti);
          g = Math.round(158 + (64  - 158) * ti);
          b = Math.round(11  + (14  - 11 ) * ti);
        }

        // Anti-alias at outer edge
        const aa = Math.max(0, Math.min(1, rimR - dist + 0.8));
        setPixel(x, y, r, g, b, Math.round(aa * 255));
      }
    }
  }

  // Add subtle shine highlight (top-left arc)
  const shineR = goldInnerR * 0.7;
  const shineCX = cx - goldInnerR * 0.25;
  const shineCY = cy - goldInnerR * 0.25;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dxc = x - cx; const dyc = y - cy;
      if (Math.sqrt(dxc*dxc + dyc*dyc) > goldInnerR * 0.98) continue;
      const dxs = x - shineCX; const dys = y - shineCY;
      const d = Math.sqrt(dxs*dxs + dys*dys);
      if (d < shineR) {
        const strength = Math.max(0, 1 - d / shineR) * 0.18;
        const i = (y * SIZE + x) * 4;
        buf[i]   = Math.min(255, Math.round(buf[i]   + 255 * strength));
        buf[i+1] = Math.min(255, Math.round(buf[i+1] + 255 * strength));
        buf[i+2] = Math.min(255, Math.round(buf[i+2] + 160 * strength));
      }
    }
  }

  // ── Draw 3 ascending bars ──────────────────────────────────────────────────
  const barW    = Math.round(52  * S);
  const barGap  = Math.round(20  * S);
  const barBotY = Math.round(330 * S);
  const startX  = Math.round(156 * S);
  const bHeights = [85, 140, 195].map((h) => Math.round(h * S));

  for (let bi = 0; bi < 3; bi++) {
    const bx  = startX + bi * (barW + barGap);
    const bh  = bHeights[bi];
    const bTopY = barBotY - bh;
    const bcx = bx + barW / 2;
    const brad = barW / 2;

    // Rectangle body
    for (let py = bTopY; py < barBotY; py++) {
      for (let px = bx; px < bx + barW; px++) {
        const ddx = px - cx; const ddy = py - cy;
        if (Math.sqrt(ddx*ddx + ddy*ddy) < goldInnerR * 0.97) {
          setPixel(px, py, 15, 23, 42);
        }
      }
    }

    // Rounded top cap
    for (let dy = -brad; dy <= 0; dy++) {
      for (let dx = -brad; dx <= brad; dx++) {
        if (dx * dx + dy * dy <= brad * brad) {
          const px = bcx + dx; const py = bTopY + dy;
          const ddx = px - cx; const ddy = py - cy;
          if (Math.sqrt(ddx*ddx + ddy*ddy) < goldInnerR * 0.97) {
            setPixel(px, py, 15, 23, 42);
          }
        }
      }
    }
  }

  return buf;
}

// ── generate ──────────────────────────────────────────────────────────────────

const outDir = new URL("../public/", import.meta.url).pathname;

for (const size of [192, 512]) {
  const pixels = drawIcon(size);
  const png = makePNG(size, size, pixels);
  writeFileSync(`${outDir}icon-${size}.png`, png);
  console.log(`✓ Generated icon-${size}.png`);
}

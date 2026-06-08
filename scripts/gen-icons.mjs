// Generates placeholder PWA icons with zero dependencies (Node's built-in zlib).
// Design: paper background with a centered orange "press" dot — the app's core
// strike colour. Real artwork is deferred to M7 polish. Re-run with:
//   npm run gen:icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PAPER = [0xf3, 0xec, 0xe0];
const ATTACK = [0xbb, 0x3e, 0x03];

function crc32(buf) {
  let c = ~0 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, draw) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  const rowBytes = size * 3;
  const raw = Buffer.alloc((rowBytes + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter byte 0 (none)
    for (let x = 0; x < size; x++) {
      const [r, g, b] = draw(x, y, size);
      const o = y * (rowBytes + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Centered dot at 0.26*size radius sits inside the maskable 80% safe zone.
function dot(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.26;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r ? ATTACK : PAPER;
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of targets) {
  writeFileSync(join(outDir, name), png(size, dot));
  console.log('wrote', name, `(${size}x${size})`);
}

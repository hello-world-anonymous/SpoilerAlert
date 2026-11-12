// Regenerates icons/*.png (a crossed-out eye on a purple tile). Dependency-free.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Supersampled shape function in unit coordinates (0..1).
function shade(u, v) {
  const r = 0.22; // tile corner radius
  const cx = Math.min(Math.max(u, r), 1 - r), cy = Math.min(Math.max(v, r), 1 - r);
  if ((u - cx) ** 2 + (v - cy) ** 2 > r * r) return null; // outside rounded tile
  const x = u - 0.5, y = v - 0.5;
  // eye: intersection of two circles (lens), outline only
  const lens = (d) => Math.hypot(x, y - d) < 0.42 && Math.hypot(x, y + d) < 0.42;
  const inEye = lens(0.22) && !(Math.hypot(x, y - 0.22) < 0.35 && Math.hypot(x, y + 0.22) < 0.35);
  const pupil = Math.hypot(x, y) < 0.09;
  const slash = Math.abs(x + y) < 0.055 && Math.abs(x - y) < 0.62;
  if (slash || inEye || pupil) return [255, 255, 255];
  return [122, 60, 255];
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const S = 4;
  const buf = png(size, (px, py) => {
    let r = 0, g = 0, b = 0, a = 0;
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
      const c = shade((px + (i + 0.5) / S) / size, (py + (j + 0.5) / S) / size);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
    }
    return a ? [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round((255 * a) / (S * S))] : [0, 0, 0, 0];
  });
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), buf);
}
console.log('icons written to', outDir);

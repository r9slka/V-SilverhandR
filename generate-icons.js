// Run once: node generate-icons.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c & 1) ? (c >>> 1) ^ 0xEDB88320 : c >>> 1;
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function createPNG(size) {
  const px = new Uint8Array(size * size * 4);
  // Dark background #0d0d0d
  for (let i = 0; i < size * size; i++) {
    px[i*4]=0x0d; px[i*4+1]=0x0d; px[i*4+2]=0x0d; px[i*4+3]=0xFF;
  }
  // Draw V shape (two diagonals meeting at bottom center)
  const m = size * 0.2;
  const thick = Math.max(3, size * 0.075);
  const tl = { x: m, y: m * 0.9 };
  const tr = { x: size - m, y: m * 0.9 };
  const bot = { x: size / 2, y: size - m };

  function line(x1, y1, x2, y2) {
    const steps = Math.ceil(Math.max(Math.abs(x2-x1), Math.abs(y2-y1)) * 4);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = x1 + (x2-x1)*t, cy = y1 + (y2-y1)*t;
      for (let dy = -thick; dy <= thick; dy++)
        for (let dx = -thick; dx <= thick; dx++)
          if (dx*dx+dy*dy <= thick*thick) {
            const px2 = Math.round(cx+dx), py2 = Math.round(cy+dy);
            if (px2>=0&&px2<size&&py2>=0&&py2<size) {
              const i = (py2*size+px2)*4;
              px[i]=0xFF; px[i+1]=0xFF; px[i+2]=0xFF; px[i+3]=0xFF;
            }
          }
    }
  }
  line(tl.x, tl.y, bot.x, bot.y);
  line(tr.x, tr.y, bot.x, bot.y);

  // Build raw PNG scanlines
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y*(1+size*4)] = 0;
    for (let x = 0; x < size; x++) {
      const si = (y*size+x)*4, di = y*(1+size*4)+1+x*4;
      raw[di]=px[si]; raw[di+1]=px[si+1]; raw[di+2]=px[si+2]; raw[di+3]=px[si+3];
    }
  }
  const comp = zlib.deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', comp),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

if (!fs.existsSync('icons')) fs.mkdirSync('icons');
fs.writeFileSync(path.join('icons','icon-192.png'), createPNG(192));
fs.writeFileSync(path.join('icons','icon-512.png'), createPNG(512));
console.log('Icons generated: icons/icon-192.png and icons/icon-512.png');

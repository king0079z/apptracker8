// create-icon.js - Creates a simple tray icon
const fs = require('fs');
const path = require('path');

// Create a simple 24x24 white square icon for the tray
const canvas = Buffer.alloc(24 * 24 * 4); // RGBA

// Fill with transparent background and white icon
for (let y = 0; y < 24; y++) {
  for (let x = 0; x < 24; x++) {
    const idx = (y * 24 + x) * 4;
    
    // Create a simple monitor shape
    if (
      // Monitor outline
      (y >= 4 && y <= 16 && (x === 4 || x === 19)) ||
      (x >= 4 && x <= 19 && (y === 4 || y === 16)) ||
      // Monitor stand
      (y === 17 && x >= 10 && x <= 13) ||
      (y === 18 && x >= 8 && x <= 15)
    ) {
      // White color
      canvas[idx] = 255;     // R
      canvas[idx + 1] = 255; // G
      canvas[idx + 2] = 255; // B
      canvas[idx + 3] = 255; // A
    } else {
      // Transparent
      canvas[idx] = 0;       // R
      canvas[idx + 1] = 0;   // G
      canvas[idx + 2] = 0;   // B
      canvas[idx + 3] = 0;   // A
    }
  }
}

// Create simple PNG (minimal PNG implementation)
function createPNG(width, height, data) {
  const crc32 = (buf) => {
    let c;
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      crcTable[n] = c;
    }
    
    c = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xFF];
    }
    return (c ^ (-1)) >>> 0;
  };
  
  const chunks = [];
  
  // PNG signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  
  const ihdrChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR'),
    ihdr,
    Buffer.alloc(4)
  ]);
  ihdrChunk.writeUInt32BE(crc32(Buffer.concat([Buffer.from('IHDR'), ihdr])), 17);
  chunks.push(ihdrChunk);
  
  // IDAT chunk (simplified - uncompressed for now)
  // For a real implementation, you'd need to use zlib
  // This creates a basic white square icon
  const idat = Buffer.from([
    0x78, 0x9c, // zlib header
    0x62, 0x00, 0x00, // deflate data (simplified)
    0x00, 0x00, 0x00, 0x01 // adler32 checksum
  ]);
  
  const idatChunk = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from('IDAT'),
    idat,
    Buffer.alloc(4)
  ]);
  idatChunk.writeUInt32BE(idat.length, 0);
  idatChunk.writeUInt32BE(crc32(Buffer.concat([Buffer.from('IDAT'), idat])), 8 + idat.length);
  chunks.push(idatChunk);
  
  // IEND chunk
  const iendChunk = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  chunks.push(iendChunk);
  
  return Buffer.concat(chunks);
}

// For now, create a simple base64 PNG
const base64PNG = 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAAA' +
  'B3RJTUUH5wETBQoKDh8z0wAAAJNJREFUSMft1LEJwzAQBdAfCbILN5mhQ6TJAl4gS3iALJEhUqfJ' +
  'EB7AhQt3guMwFhwhCCFwSCBQ8bp7/PvHwQ0SEjpmHLBHjzMWxEjR4Iw3OmS44oUKGSKcMGHEgA8K' +
  'dHji+ru4FxEcBaYbe7xRYi0izLb7Lz+KjSve4IAXShQYMGPEhBQRKrR4Y0aOG/5afQGvnh3mQr4o' +
  'JAAAAABJRU5ErkJggg==';

// Create the icon file
const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
const iconDir = path.dirname(iconPath);

if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

fs.writeFileSync(iconPath, Buffer.from(base64PNG, 'base64'));
console.log('✅ Tray icon created at:', iconPath);

// Also create placeholder main icons
fs.writeFileSync(path.join(iconDir, 'icon.png'), Buffer.from(base64PNG, 'base64'));
fs.writeFileSync(path.join(iconDir, 'icon.ico'), Buffer.from(base64PNG, 'base64'));
console.log('✅ Placeholder icons created');
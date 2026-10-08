// Generates brand PNG icons (green rounded square + sprout glyph) without native deps.
// Run: node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const BG = [0x17, 0x3f, 0x36];
const ACCENT = [0xd6, 0xe8, 0x5f];
const LEAF = [0xb7, 0xd4, 0xb5];

function inRoundedRect(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function inEllipse(x, y, cx, cy, rx, ry, angle) {
  const dx = x - cx;
  const dy = y - cy;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const ux = dx * c + dy * s;
  const uy = -dx * s + dy * c;
  return (ux / rx) ** 2 + (uy / ry) ** 2 <= 1;
}

function render(size, { rounded = true, padding = 0.18, transparent = false } = {}) {
  const png = new PNG({ width: size, height: size });
  const radius = rounded ? size * 0.22 : 0;
  const stemX = size / 2;
  const stemTop = size * (padding + 0.12);
  const stemBottom = size * (1 - padding);
  const stemW = size * 0.045;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      let rgb = null;
      let alpha = 255;
      const inside = rounded ? inRoundedRect(x, y, size, radius) : true;
      if (!inside) {
        alpha = 0;
      } else if (transparent) {
        alpha = 0;
      } else {
        rgb = BG;
      }
      // stem
      if (inside && Math.abs(x - stemX) < stemW && y > stemTop && y < stemBottom) {
        rgb = ACCENT;
        alpha = 255;
      }
      // leaves
      const ly = size * (padding + 0.36);
      if (inside && inEllipse(x, y, stemX - size * 0.17, ly, size * 0.19, size * 0.09, -0.6)) {
        rgb = LEAF;
        alpha = 255;
      }
      if (inside && inEllipse(x, y, stemX + size * 0.17, ly + size * 0.06, size * 0.19, size * 0.09, 0.6)) {
        rgb = LEAF;
        alpha = 255;
      }
      if (inside && inEllipse(x, y, stemX, stemTop + size * 0.02, size * 0.07, size * 0.12, 0)) {
        rgb = ACCENT;
        alpha = 255;
      }
      const [r, g, b] = rgb ?? [0, 0, 0];
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = alpha;
    }
  }
  return PNG.sync.write(png);
}

const out = path.join(__dirname, '..', 'assets');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon.png'), render(1024));
fs.writeFileSync(path.join(out, 'adaptive-icon.png'), render(1024, { rounded: false, padding: 0.3 }));
fs.writeFileSync(path.join(out, 'splash-icon.png'), render(512, { rounded: false, transparent: true, padding: 0.1 }));
fs.writeFileSync(path.join(out, 'favicon.png'), render(48));
console.log('icons written to', out);

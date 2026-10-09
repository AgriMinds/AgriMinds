// Generates brand PNG icons from the official AgriMinds logo.
// Run: node scripts/make-icons.js
// Requires: npm install sharp  (or: pip install pillow && python3 scripts/make-icons.py)
const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, '..', '..', 'docs', 'assets', 'AgriMinds_logo.jpg');
const out = path.join(__dirname, '..', 'assets');

const targets = [
  { file: 'icon.png',          size: 1024 },
  { file: 'adaptive-icon.png', size: 1024 },
  { file: 'splash-icon.png',   size: 512  },
  { file: 'favicon.png',       size: 48   },
];

(async () => {
  for (const { file, size } of targets) {
    await sharp(src).resize(size, size).png().toFile(path.join(out, file));
    console.log('wrote', file);
  }
})();

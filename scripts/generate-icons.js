/*
 * Generates all PWA / favicon PNG assets from public/favicon.svg.
 * Run with: node scripts/generate-icons.js
 *
 * Produces:
 *   - public/icons/favicon-32.png        (32x32)
 *   - public/icons/icon-192.png          (192x192)
 *   - public/icons/icon-512.png          (512x512)
 *   - public/icons/icon-512-maskable.png (512x512, purpose: maskable)
 *   - public/icons/apple-touch-icon.png  (180x180)
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const svgPath = path.join(root, 'public', 'favicon.svg');
const iconsDir = path.join(root, 'public', 'icons');

const targets = [
  { name: 'favicon-32.png', size: 32 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-512-maskable.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

async function main() {
  if (!fs.existsSync(svgPath)) {
    throw new Error('favicon.svg not found at ' + svgPath);
  }
  fs.mkdirSync(iconsDir, { recursive: true });

  const svg = fs.readFileSync(svgPath);

  for (const { name, size } of targets) {
    // density 72 keeps the 512x512 viewBox at native resolution, then resize
    // downscales cleanly so every gradient stop is preserved.
    const out = await sharp(svg, { density: 72 }).resize(size, size).png().toBuffer();
    fs.writeFileSync(path.join(iconsDir, name), out);
    console.log(`✓ generated ${name} (${size}x${size})`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

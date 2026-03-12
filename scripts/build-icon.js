/**
 * scripts/build-icon.js
 * Converts assets/icon.svg → assets/icon.png + assets/icon.ico
 * Run: node scripts/build-icon.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'assets', 'icon.svg');
const pngPath = path.join(root, 'assets', 'icon.png');
const icoPath = path.join(root, 'assets', 'icon.ico');

async function build() {
  const { default: pngToIco } = await import('png-to-ico');
  const svg = fs.readFileSync(svgPath);

  // Generate PNG at 256×256
  await sharp(svg).resize(256, 256).png().toFile(pngPath);
  console.log('✓ icon.png written');

  // Generate ICO containing 16, 32, 48, 256 px sizes
  const sizes = [16, 32, 48, 256];
  const pngBuffers = await Promise.all(
    sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer())
  );

  const icoBuffer = await pngToIco(pngBuffers);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('✓ icon.ico written (16/32/48/256 px)');
}

build().catch((err) => { console.error(err); process.exit(1); });

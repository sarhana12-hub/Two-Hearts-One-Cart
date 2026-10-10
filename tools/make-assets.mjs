// Regenerates icons/ and icons/launch/ from the vector mark below.
//   npm i -D playwright   (or set PLAYWRIGHT_MODULE to an installed copy)
//   node tools/make-assets.mjs
// Produces full-bleed square icons (iOS masks the corners itself; baked-in
// transparent corners render black on the Home Screen), maskable PWA icons
// with extra padding, favicons, and portrait launch images for every iPhone
// size in both themes.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'icons');
fs.mkdirSync(path.join(OUT, 'launch'), { recursive: true });

// The mark: cart outline with a heart riding the rim. `bg` is the color the
// heart's halo uses to cut a gap through the rim, so pass the real background.
export function markSvg({ fg, bg, size }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
  <g fill="none" stroke="${fg}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13 24h12l7 14"/>
    <path d="M32 38h56l-7.5 30H39.5z"/>
  </g>
  <circle cx="46" cy="83" r="6" fill="${fg}"/><circle cx="74" cy="83" r="6" fill="${fg}"/>
  <path d="M60 58.5C52.5 52.5 44.5 48 44.5 41a7.75 7.75 0 0 1 15.5-1.2A7.75 7.75 0 0 1 75.5 41c0 7-8 11.5-15.5 17.5z" fill="${fg}" stroke="${bg}" stroke-width="5" stroke-linejoin="round"/>
</svg>`;
}

const CORAL = '#FF5D7A', CORAL_DEEP = '#E94B6E', CREAM = '#FFF7F0';
const LIGHT_BG = '#FBF8F2', DARK_BG = '#1A1614';

function iconHtml(size, pad) {
  // pad = fraction of the canvas left around the mark (maskable needs ~0.1 more)
  const inner = Math.round(size * (1 - 2 * pad));
  return `<html><body style="margin:0;width:${size}px;height:${size}px;background:linear-gradient(180deg,#FF8196 0%,${CORAL} 55%,${CORAL_DEEP} 100%);display:flex;align-items:center;justify-content:center;">
    ${markSvg({ fg: CREAM, bg: CORAL, size: inner })}
  </body></html>`;
}
function launchHtml(w, h, dark) {
  const bg = dark ? DARK_BG : LIGHT_BG;
  const mark = Math.round(Math.min(w, h) * 0.3);
  return `<html><body style="margin:0;width:${w}px;height:${h}px;background:${bg};display:flex;align-items:center;justify-content:center;">
    ${markSvg({ fg: CORAL, bg, size: mark })}
  </body></html>`;
}

// Portrait logical sizes (pt) and scale for every iPhone that runs iOS 15+.
export const IPHONES = [
  [440, 956, 3], [430, 932, 3], [428, 926, 3], [420, 912, 3], [414, 896, 3], [414, 896, 2],
  [414, 736, 3], [402, 874, 3], [393, 852, 3], [390, 844, 3], [375, 812, 3], [375, 667, 2], [320, 568, 2],
];

const browser = await chromium.launch();
async function shoot(html, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.screenshot({ path: file, omitBackground: false });
  await page.close();
}

for (const [name, size, pad] of [
  ['icon-512.png', 512, 0.12], ['icon-192.png', 192, 0.12], ['apple-touch-icon.png', 180, 0.12],
  ['icon-512-maskable.png', 512, 0.2], ['icon-192-maskable.png', 192, 0.2],
  ['favicon-32.png', 32, 0.12], ['favicon-16.png', 16, 0.1],
]) {
  await shoot(iconHtml(size, pad), size, size, path.join(OUT, name));
}
for (const [w, h, s] of IPHONES) {
  for (const dark of [false, true]) {
    await shoot(launchHtml(w * s, h * s, dark), w * s, h * s, path.join(OUT, 'launch', `${w}x${h}@${s}x${dark ? '-dark' : ''}.png`));
  }
}
await browser.close();

// favicon.ico from the 32px PNG, if Pillow is around; otherwise keep the old one.
try {
  const { execSync } = await import('child_process');
  execSync(`python3 -c "from PIL import Image; Image.open('${path.join(OUT, 'favicon-32.png')}').save('${path.join(OUT, 'favicon.ico')}', sizes=[(32,32),(16,16)])"`, { stdio: 'ignore' });
} catch (e) { /* optional */ }

// <link> tags for index.html <head>
const links = [];
for (const [w, h, s] of IPHONES) {
  for (const dark of [false, true]) {
    const media = `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${s}) and (orientation: portrait)${dark ? ' and (prefers-color-scheme: dark)' : ''}`;
    links.push(`<link rel="apple-touch-startup-image" media="${media}" href="./icons/launch/${w}x${h}@${s}x${dark ? '-dark' : ''}.png">`);
  }
}
fs.writeFileSync(path.join(OUT, 'launch', 'links.html'), links.join('\n') + '\n');
console.log('wrote icons and', IPHONES.length * 2, 'launch images; head links in icons/launch/links.html');

// build-holo.mjs — the WooCommerce theme's "no photo yet" images.
// Turns the site's hologram schematics (assets/js/icons.js) into standalone
// square SVGs with the colours baked in, so WordPress can serve them as plain
// <img> placeholders: woocommerce/theme/agarthan-armory/assets/holo/<type>.svg
// Run: node woocommerce/tools/build-holo.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'woocommerce/theme/agarthan-armory/assets/holo');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/js/icons.js'), 'utf8'), ctx);
const icons = ctx.window.AA_ICONS;

const CYAN = '#5de4ff';
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [type, svg] of Object.entries(icons)) {
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="600" height="600">
<defs>
<pattern id="g" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="${CYAN}" stroke-opacity=".07" stroke-width=".5"/></pattern>
<radialGradient id="r" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#0d2440"/><stop offset="1" stop-color="#050d1b"/></radialGradient>
<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<style>.i *{fill:none;stroke:${CYAN};stroke-width:1.3;stroke-linejoin:round;stroke-linecap:round}.i .hf *{fill:${CYAN};fill-opacity:.1}.i .hl *{stroke-opacity:.7}</style>
</defs>
<rect width="240" height="240" fill="url(#r)"/><rect width="240" height="240" fill="url(#g)"/>
<g class="i" filter="url(#glow)" transform="translate(12 66) scale(.9)">${inner}</g>
<text x="120" y="214" text-anchor="middle" font-family="monospace" font-size="7.5" letter-spacing="2.5" fill="${CYAN}" fill-opacity=".55">IMAGE · BEYOND THE WALL</text>
</svg>
`;
  fs.writeFileSync(path.join(OUT, `${type}.svg`), out);
  n++;
}
console.log(`${n} hologram placeholders → ${path.relative(ROOT, OUT)}`);

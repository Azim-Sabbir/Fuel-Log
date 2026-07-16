// Generates the PWA icons from an inline SVG. Run: npm run icons
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// Synthwave gas-pump: a sunset gradient behind a clean white pump + a road.
function svg({ bleed }) {
  // `bleed` true = fill the whole square (regular icon). false = keep the mark
  // inside the maskable safe zone (~80%).
  const pad = bleed ? 0 : 52;
  const s = 512 - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#15102e"/>
      <stop offset="0.5" stop-color="#5b21b6"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fde68a"/>
      <stop offset="1" stop-color="#fb7185"/>
    </linearGradient>
  </defs>
  <g transform="translate(${pad},${pad}) scale(${s / 512})">
    <rect width="512" height="512" rx="${bleed ? 0 : 96}" fill="url(#sky)"/>
    <circle cx="256" cy="322" r="150" fill="url(#sun)"/>
    <g fill="#15102e" opacity="0.55">
      <rect x="60" y="330" width="392" height="8"/>
      <rect x="60" y="356" width="392" height="10"/>
      <rect x="60" y="388" width="392" height="12"/>
      <rect x="60" y="426" width="392" height="16"/>
    </g>
    <path d="M214 470 L246 300 h20 L298 470 Z" fill="#15102e" opacity="0.6"/>
    <!-- pump -->
    <g>
      <rect x="150" y="120" width="150" height="248" rx="20" fill="#ffffff"/>
      <rect x="130" y="360" width="190" height="26" rx="10" fill="#ffffff"/>
      <rect x="174" y="150" width="102" height="66" rx="10" fill="#15102e"/>
      <rect x="190" y="170" width="58" height="9" rx="4.5" fill="#f59e0b"/>
      <rect x="190" y="190" width="38" height="9" rx="4.5" fill="#34d399"/>
      <rect x="186" y="248" width="78" height="70" rx="10" fill="#c7d2fe"/>
      <!-- nozzle arm -->
      <path d="M300 176 h34 a22 22 0 0 1 22 22 v104 a30 30 0 0 1 -60 0 v-26"
            fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
</svg>`;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const targets = [
    { name: "icon-192.png", size: 192, bleed: true },
    { name: "icon-512.png", size: 512, bleed: true },
    { name: "icon-512-maskable.png", size: 512, bleed: false },
    { name: "icon-180.png", size: 180, bleed: true },
  ];
  for (const t of targets) {
    await sharp(Buffer.from(svg({ bleed: t.bleed })))
      .resize(t.size, t.size)
      .png()
      .toFile(join(outDir, t.name));
    console.log("wrote", t.name);
  }
}

main();

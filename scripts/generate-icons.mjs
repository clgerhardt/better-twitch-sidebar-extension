// Renders assets/icon.svg to the PNG files the manifests use:
//   public/icon-<size>.png      the icons of the real extension
//   public/dev-icon-<size>.png  the same with a red DEV ribbon, used by `yarn dev` builds (manifest.dev.json)
// Run with: node scripts/generate-icons.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const SIZES = [16, 32, 48, 128];
const DEV_SIZES = [32, 128];
const svg = fs.readFileSync(new URL("../assets/icon.svg", import.meta.url), "utf8");

const DEV_RIBBON = `
  <clipPath id="round"><rect width="128" height="128" rx="28"/></clipPath>
  <g clip-path="url(#round)">
    <rect y="82" width="128" height="46" fill="#dc2626"/>
    <text x="64" y="115" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="34" fill="#fff">DEV</text>
  </g>
</svg>`;
const devSvg = svg.replace("</svg>", DEV_RIBBON);

const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (source, size, file) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:transparent">${source.replace("<svg", `<svg width="${size}" height="${size}"`)}</body>`
  );
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: true });
};
for (const size of SIZES) await render(svg, size, `icon-${size}.png`);
for (const size of DEV_SIZES) await render(devSvg, size, `dev-icon-${size}.png`);
await browser.close();

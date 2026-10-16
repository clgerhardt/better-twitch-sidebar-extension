// Renders assets/icon.svg to the PNG sizes the manifest uses (public/icon-<size>.png).
// Run with: node scripts/generate-icons.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const SIZES = [16, 32, 48, 128];
const svg = fs.readFileSync(new URL("../assets/icon.svg", import.meta.url), "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:transparent">${svg.replace("<svg", `<svg width="${size}" height="${size}"`)}</body>`
  );
  await page.screenshot({
    path: new URL(`../public/icon-${size}.png`, import.meta.url).pathname,
    omitBackground: true,
  });
}
await browser.close();

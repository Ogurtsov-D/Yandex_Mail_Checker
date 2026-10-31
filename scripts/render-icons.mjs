// Отрисовка PNG-иконок из icons/icon.svg.
// Playwright в зависимости проекта не входит, поэтому ставится глобально:
//   npm install -g playwright && npx playwright install chromium
//   NODE_PATH="$(npm root -g)" node scripts/render-icons.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');

// SVG встраивается в страницу: страница из setContent не может загружать file://
const svg = readFileSync(new URL('../icons/icon.svg', import.meta.url), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
    await page.setContent(`<html><body style="margin:0;background:transparent">${sized}</body></html>`);
    const path = fileURLToPath(new URL(`../icons/icon${size}.png`, import.meta.url));
    await page.locator('svg').screenshot({ path, omitBackground: true });
    console.log(`icons/icon${size}.png`);
}
await browser.close();

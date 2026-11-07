// Иконки расширения рисуются этим скриптом из простых геометрических фигур: прямоугольник
// со скруглёнными углами (конверт) и треугольник (клапан). Сторонних изображений в расширении нет —
// все PNG в icons/ получаются отсюда, и их можно пересоздать и сравнить.
//
// Что получается:
//   icons/<вид>/icon.svg, icon16.png, icon32.png, icon128.png — значок на панели и в уведомлениях
//     для каждого вида из ICON_STYLES (вид выбирается на странице настроек);
//   icons/icon.svg, icon48.png, icon128.png — иконка расширения на странице расширений и в магазинах:
//     филин-почтальон на конверте со счётчиком (scripts/owl-icon.mjs). В icon128 рисунок 96×96
//     с прозрачными полями по 16 px — так требует Chrome Web Store.
//
// Растеризация — через Chromium из Playwright (в зависимости проекта не входит):
//   NODE_PATH="$(npm root -g)" node scripts/render-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ICON_STYLES } from '../src/config.js';
import { owlIconSvg } from './owl-icon.mjs';

// Поле 32×32, конверт 32×24 по центру — те же пропорции, что у иконки первой версии
const BODY = '<rect x="0" y="4" width="32" height="24" rx="3" fill="{body}"/>';
// Клапан: от верхнего края до середины конверта, кончик скруглён
const FLAP =
    '<path d="M3 4 H29 A3 3 0 0 1 32 7 V7.5 L17.2 20.6 Q16 21.6 14.8 20.6 L0 7.5 V7 A3 3 0 0 1 3 4 Z" fill="{flap}"/>';
// Клапан линией — минималистичный вид
const FLAP_LINE =
    '<path d="M2.5 7 L16 18 L29.5 7" fill="none" stroke="{flap}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>';

export const PALETTES = {
    classic: { body: '#FFC550', flap: '#FF5B10' },
    minimal: { body: '#FFCC00', flap: '#FC3F1D', line: true },
    blue: { body: '#9CC8FF', flap: '#1F6FE5' },
    green: { body: '#A6E3A1', flap: '#1E9E4A' },
    purple: { body: '#CDB6FF', flap: '#7B3FE4' }
};

const fill = (template, palette) => template.replace('{body}', palette.body).replace('{flap}', palette.flap);

export function envelope(style) {
    const palette = PALETTES[style];
    return fill(BODY, palette) + fill(palette.line ? FLAP_LINE : FLAP, palette);
}

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${inner}</svg>\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { chromium } = createRequire(import.meta.url)('playwright');
    const root = new URL('../icons/', import.meta.url);
    const jobs = ICON_STYLES.map((style) => ({ dir: `${style}/`, inner: envelope(style), sizes: [16, 32, 128] }));

    const browser = await chromium.launch();
    const page = await browser.newPage();
    const shot = async (markup, size, file) => {
        await page.setViewportSize({ width: size, height: size });
        await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
        await page.screenshot({ path: fileURLToPath(new URL(file, root)), omitBackground: true });
        console.log(`icons/${file}`);
    };
    for (const { dir, inner, sizes } of jobs) {
        mkdirSync(new URL(dir, root), { recursive: true });
        writeFileSync(new URL(`${dir}icon.svg`, root), svg(inner));
        for (const size of sizes) {
            await shot(svg(inner).replace('<svg ', `<svg width="${size}" height="${size}" `), size, `${dir}icon${size}.png`);
        }
    }

    // Иконка расширения: [размер, размер рисунка внутри]
    const owl = owlIconSvg();
    writeFileSync(new URL('icon.svg', root), owl);
    for (const [size, art] of [
        [48, 48],
        [128, 96]
    ]) {
        const pad = (size - art) / 2;
        const sized = owl.replace('<svg ', `<svg width="${art}" height="${art}" style="position:absolute;left:${pad}px;top:${pad}px" `);
        await shot(sized, size, `icon${size}.png`);
    }
    await browser.close();
}

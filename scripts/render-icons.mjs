// Иконки расширения рисуются этим скриптом из простых геометрических фигур: прямоугольник
// со скруглёнными углами (конверт) и треугольник (клапан). Сторонних изображений в расширении нет —
// все PNG в icons/ получаются отсюда, и их можно пересоздать и сравнить.
//
// Что получается:
//   icons/<вид>/icon.svg, icon16.png, icon32.png, icon128.png — значок на панели и в уведомлениях
//     для каждого вида из ICON_STYLES (вид выбирается на странице настроек);
//   icons/icon.svg, icon48.png, icon128.png — иконка расширения на странице расширений и в магазинах:
//     вид по умолчанию с кружком-счётчиком (на панели число рисует сам браузер, здесь — для узнаваемости).
//
// Растеризация — через Chromium из Playwright (в зависимости проекта не входит):
//   NODE_PATH="$(npm root -g)" node scripts/render-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ICON_STYLE, ICON_STYLES } from '../src/config.js';

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

// Кружок-счётчик с цифрой 3: цифра — линия, а не текст, чтобы не зависеть от шрифтов
const COUNTER =
    '<circle cx="24.6" cy="23.6" r="7" fill="#D14836" stroke="#FFFFFF" stroke-width="1.5"/>' +
    '<path d="M22.4 20.4 H26.5 L24.3 23 A2.35 2.35 0 1 1 22.2 26.7" fill="none" stroke="#FFFFFF" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>';

export function storeIcon() {
    // Конверт чуть меньше, чтобы кружок поместился в поле
    return `<g transform="translate(0 1.5) scale(0.82)">${envelope(DEFAULT_ICON_STYLE)}</g>${COUNTER}`;
}

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${inner}</svg>\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { chromium } = createRequire(import.meta.url)('playwright');
    const root = new URL('../icons/', import.meta.url);
    const jobs = [
        ...ICON_STYLES.map((style) => ({ dir: `${style}/`, inner: envelope(style), sizes: [16, 32, 128] })),
        { dir: '', inner: storeIcon(), sizes: [48, 128] }
    ];

    const browser = await chromium.launch();
    const page = await browser.newPage();
    for (const { dir, inner, sizes } of jobs) {
        mkdirSync(new URL(dir, root), { recursive: true });
        writeFileSync(new URL(`${dir}icon.svg`, root), svg(inner));
        for (const size of sizes) {
            await page.setViewportSize({ width: size, height: size });
            const sized = svg(inner).replace('<svg ', `<svg width="${size}" height="${size}" `);
            await page.setContent(`<html><body style="margin:0;background:transparent">${sized}</body></html>`);
            await page
                .locator('svg')
                .screenshot({ path: fileURLToPath(new URL(`${dir}icon${size}.png`, root)), omitBackground: true });
            console.log(`icons/${dir}icon${size}.png`);
        }
    }
    await browser.close();
}

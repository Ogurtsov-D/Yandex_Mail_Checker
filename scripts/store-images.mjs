// Картинки для магазинов расширений (Chrome Web Store, Microsoft Edge Add-ons, каталог Firefox):
//   docs/store/<язык>/screenshot-1…4.png — снимки 1280×800;
//   docs/store/<язык>/promo-440x280.png — маленькая промо-картинка Chrome Web Store;
//   docs/store/logo-300x300.png — логотип для Microsoft Edge Add-ons (иконка расширения крупнее).
// Снимки собираются из макетов docs/mockup*.html и настоящей страницы настроек из dist/chrome.
//
// Запуск (нужен Playwright, в проект он не входит):
//   npm run build && NODE_PATH="$(npm root -g)" node scripts/store-images.mjs
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../', import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));

const TEXT = {
    ru: {
        mockup: 'docs/mockup.html',
        name: 'Счётчик писем для Яндекс Почты',
        slogan: 'Непрочитанные письма — на панели браузера',
        slides: [
            ['Непрочитанные письма — на панели браузера', 'Во всех папках, кроме «Спама», — как в самой Яндекс Почте'],
            ['Всё под рукой — по правому клику', 'Проверить сейчас, интервал, что показывать на значке, уведомления'],
            ['Уведомления о новых письмах', 'Клик по уведомлению открывает почту'],
            ['Тихие часы, адрес почты, вид значка', 'Яндекс 360 и другие домены, несколько аккаунтов, 19 языков']
        ]
    },
    en: {
        mockup: 'docs/mockup-en.html',
        name: 'Checker for Yandex Mail',
        slogan: 'Unread Yandex Mail on your toolbar',
        slides: [
            ['Unread mail count on your toolbar', 'All folders except Spam — the same as Yandex Mail itself'],
            ['Everything a right-click away', 'Check now, check interval, what the badge shows, notifications'],
            ['New mail notifications', 'Click a notification to open your mailbox'],
            ['Quiet hours, mail address, icon style', 'Yandex 360 and other domains, several accounts, 19 languages']
        ]
    }
};

const dataUrl = (buffer) => `data:image/png;base64,${buffer.toString('base64')}`;
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const PAGE_STYLE = `
  body { margin: 0; font-family: Inter, 'Segoe UI', Arial, sans-serif; color: #1f1f1f; }
  .bg { position: absolute; inset: 0; background: linear-gradient(135deg, #fff6df 0%, #ffe9d9 100%); }
`;

function slide(image, title, subtitle) {
    return `<html><head><style>${PAGE_STYLE}
      .page { position: absolute; inset: 0; display: flex; flex-direction: column; padding: 56px 72px 40px; box-sizing: border-box; }
      .title { font-size: 44px; font-weight: 700; line-height: 1.15; }
      .sub { margin-top: 12px; font-size: 24px; color: #5f6368; }
      .shot { flex: 1; min-height: 0; margin-top: 32px; display: flex; align-items: center; justify-content: center; }
      .shot img { height: 100%; max-width: 100%; object-fit: contain; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.14); background: #fff; }
    </style></head><body><div class="bg"></div><div class="page">
      <div class="title">${escape(title)}</div><div class="sub">${escape(subtitle)}</div>
      <div class="shot"><img src="${image}"></div></div></body></html>`;
}

function promo(icon, name, slogan) {
    return `<html><head><style>${PAGE_STYLE}
      .icon { position: absolute; left: 28px; top: 76px; width: 128px; height: 128px; }
      .name { position: absolute; left: 176px; right: 20px; top: 84px; font-size: 26px; font-weight: 700; line-height: 1.15; }
      .slogan { position: absolute; left: 176px; right: 20px; top: 158px; font-size: 16px; color: #5f6368; line-height: 1.3; }
    </style></head><body><div class="bg"></div><img class="icon" src="${icon}">
      <div class="name">${escape(name)}</div><div class="slogan">${escape(slogan)}</div></body></html>`;
}

const browser = await chromium.launch();
const render = async (html, width, height, file) => {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(html);
    await page.screenshot({ path: file });
    await page.close();
};
const icon = dataUrl(readFileSync(path('icons/icon128.png')));

// Логотип для Edge: та же иконка расширения из icons/icon.svg, нарисованная в 300×300
{
    const svg = readFileSync(path('icons/icon.svg'), 'utf8').replace('<svg ', '<svg width="300" height="300" ');
    const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.locator('svg').screenshot({ path: path('docs/store/logo-300x300.png'), omitBackground: true });
    await page.close();
}

for (const [lang, text] of Object.entries(TEXT)) {
    const out = path(`docs/store/${lang}/`);
    mkdirSync(out, { recursive: true });

    // Три колонки макета: счётчик и подсказка, меню, уведомления (без подписей над ними)
    const mock = await browser.newPage({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: 2 });
    await mock.goto(`file://${path(text.mockup)}`);
    await mock.addStyleTag({ content: '.cap { display: none !important; }' });
    const columns = await mock.locator('.col').all();
    const shots = [];
    for (const column of columns.slice(0, 3)) shots.push(dataUrl(await column.screenshot()));
    await mock.close();

    // Настоящая страница настроек из собранного расширения
    const profile = mkdtempSync(join(tmpdir(), 'ymc-store-'));
    const context = await chromium.launchPersistentContext(profile, {
        headless: true,
        channel: 'chromium',
        locale: lang,
        deviceScaleFactor: 2,
        // Формат времени в полях ввода Chromium берёт из языка системы
        env: {
            ...process.env,
            LANG: lang === 'ru' ? 'ru_RU.UTF-8' : 'en_US.UTF-8',
            LC_ALL: lang === 'ru' ? 'ru_RU.UTF-8' : 'en_US.UTF-8'
        },
        args: [
            `--disable-extensions-except=${path('dist/chrome')}`,
            `--load-extension=${path('dist/chrome')}`,
            `--lang=${lang}`
        ]
    });
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    await worker.evaluate(() => chrome.storage.local.set({ quietHoursEnabled: true }));
    const options = await context.newPage();
    await options.setViewportSize({ width: 520, height: 560 });
    await options.goto(`chrome-extension://${new URL(worker.url()).host}/src/options.html`);
    await options.waitForTimeout(500);
    shots.push(dataUrl(await options.screenshot({ fullPage: true })));
    await context.close();
    rmSync(profile, { recursive: true, force: true });

    for (const [i, [title, subtitle]] of text.slides.entries()) {
        await render(slide(shots[i], title, subtitle), 1280, 800, `${out}screenshot-${i + 1}.png`);
    }
    await render(promo(icon, text.name, text.slogan), 440, 280, `${out}promo-440x280.png`);
    console.log(`docs/store/${lang}/`);
}
await browser.close();

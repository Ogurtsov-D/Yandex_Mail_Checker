// Картинки для магазинов расширений (Chrome Web Store, Microsoft Edge Add-ons, каталог Firefox):
//   docs/store/<язык>/screenshot-1…4.png — снимки 1280×800;
//   docs/store/<язык>/promo-440x280.png — маленькая промо-картинка Chrome Web Store и Edge;
//   docs/store/<язык>/promo-1400x560.png — большая промо-картинка (Chrome Web Store: Marquee, Edge: Large promotional tile);
//   docs/store/<язык>/promo-300x188.png — промо-картинка каталога Opera;
//   docs/store/logo-300x300.png — логотип для Microsoft Edge Add-ons (иконка расширения крупнее);
//   docs/store/opera-64.png — иконка для каталога Opera.
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
        name: 'Филин',
        slogan: 'Информер Яндекс Почты: непрочитанные письма на панели браузера',
        tagline: 'Информер Яндекс Почты',
        points: [
            'Непрочитанные письма — на панели браузера',
            'Уведомления о новых письмах',
            'Несколько аккаунтов и Яндекс 360',
            'Бесплатно, без рекламы и серверов'
        ],
        slides: [
            ['Непрочитанные письма — на панели браузера', 'Во всех папках, кроме «Спама», — как в самой Яндекс Почте'],
            ['Всё под рукой — по правому клику', 'Проверить сейчас, интервал, что показывать на значке, уведомления'],
            ['Уведомления о новых письмах', 'Клик по уведомлению открывает почту'],
            ['Настройки под себя', 'Яндекс 360 и несколько аккаунтов, вкладка или окно, вид и цвет значка']
        ]
    },
    en: {
        mockup: 'docs/mockup-en.html',
        name: 'Owl',
        slogan: 'Notifier for Yandex Mail: unread mail on your toolbar',
        tagline: 'Notifier for Yandex Mail',
        points: [
            'Unread mail on your toolbar',
            'New mail notifications',
            'Several accounts and Yandex 360',
            'Free, no ads, no servers'
        ],
        slides: [
            ['Unread mail count on your toolbar', 'All folders except Spam — the same as Yandex Mail itself'],
            ['Everything a right-click away', 'Check now, check interval, what the badge shows, notifications'],
            ['New mail notifications', 'Click a notification to open your mailbox'],
            ['Make it yours', 'Yandex 360 and several accounts, tab or window, icon style and color']
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
      .name { position: absolute; left: 176px; right: 20px; top: 80px; font-size: 40px; font-weight: 700; line-height: 1.15; }
      .slogan { position: absolute; left: 176px; right: 20px; top: 136px; font-size: 16px; color: #5f6368; line-height: 1.3; }
    </style></head><body><div class="bg"></div><img class="icon" src="${icon}">
      <div class="name">${escape(name)}</div><div class="slogan">${escape(slogan)}</div></body></html>`;
}

// Большая промо-картинка: иконка, название, пояснение и главное, справа — значок с подсказкой из макета
function promoLarge(icon, text, shot) {
    return `<html><head><style>${PAGE_STYLE}
      .left { position: absolute; left: 80px; top: 0; bottom: 0; width: 720px; display: flex; flex-direction: column; justify-content: center; }
      .head { display: flex; align-items: center; gap: 28px; }
      .head img { width: 168px; height: 168px; flex: none; }
      .name { font-size: 72px; font-weight: 700; line-height: 1; }
      .tagline { margin-top: 10px; font-size: 28px; color: #5f6368; }
      ul { margin: 34px 0 0; padding: 0; list-style: none; font-size: 26px; color: #3c4043; }
      li { margin-top: 12px; } li::before { content: '✓'; color: #ff5b10; font-weight: 700; margin-right: 16px; }
      .shot { position: absolute; right: 80px; top: 50%; transform: translateY(-50%); width: 480px; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.14); background: #fff; }
    </style></head><body><div class="bg"></div><div class="left">
      <div class="head"><img src="${icon}"><div><div class="name">${escape(text.name)}</div><div class="tagline">${escape(text.tagline)}</div></div></div>
      <ul>${text.points.map((p) => `<li>${escape(p)}</li>`).join('')}</ul></div>
      <img class="shot" src="${shot}"></body></html>`;
}

// Промо-картинка Opera 300×188: иконка, название и пояснение
function promoSmall(icon, text) {
    return `<html><head><style>${PAGE_STYLE}
      .wrap { position: absolute; inset: 0; display: flex; align-items: center; gap: 14px; padding: 0 18px; }
      .wrap img { width: 100px; height: 100px; flex: none; }
      .name { font-size: 30px; font-weight: 700; line-height: 1.05; }
      .tagline { margin-top: 6px; font-size: 14px; color: #5f6368; line-height: 1.3; }
    </style></head><body><div class="bg"></div><div class="wrap"><img src="${icon}">
      <div><div class="name">${escape(text.name)}</div><div class="tagline">${escape(text.tagline)}</div></div></div></body></html>`;
}

const browser = await chromium.launch();
const render = async (html, width, height, file) => {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(html);
    await page.screenshot({ path: file });
    await page.close();
};
// Иконка расширения целиком, без полей, которые нужны только в icon128.png для Chrome Web Store
const icon = `data:image/svg+xml;base64,${readFileSync(path('icons/icon.svg')).toString('base64')}`;

// Логотип для Edge (300×300) и иконка для Opera (64×64): иконка расширения из icons/icon.svg
for (const [size, file] of [
    [300, 'docs/store/logo-300x300.png'],
    [64, 'docs/store/opera-64.png']
]) {
    const svg = readFileSync(path('icons/icon.svg'), 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `);
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.screenshot({ path: path(file), omitBackground: true });
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
    await options.setViewportSize({ width: 680, height: 1600 });
    await options.goto(`chrome-extension://${new URL(worker.url()).host}/src/options.html`);
    await options.waitForTimeout(500);
    // Разделы «Открытие почты» и «Значок и счётчик» — главное, что настраивается на странице
    const sections = options.locator('section');
    const first = await sections.nth(2).boundingBox();
    const last = await sections.nth(3).boundingBox();
    const clip = {
        x: first.x - 8,
        y: first.y - 8,
        width: first.width + 16,
        height: last.y + last.height - first.y + 16
    };
    shots.push(dataUrl(await options.screenshot({ clip })));
    await context.close();
    rmSync(profile, { recursive: true, force: true });

    for (const [i, [title, subtitle]] of text.slides.entries()) {
        await render(slide(shots[i], title, subtitle), 1280, 800, `${out}screenshot-${i + 1}.png`);
    }
    await render(promo(icon, text.name, text.slogan), 440, 280, `${out}promo-440x280.png`);
    await render(promoLarge(icon, text, shots[0]), 1400, 560, `${out}promo-1400x560.png`);
    await render(promoSmall(icon, text), 300, 188, `${out}promo-300x188.png`);
    console.log(`docs/store/${lang}/`);
}
await browser.close();

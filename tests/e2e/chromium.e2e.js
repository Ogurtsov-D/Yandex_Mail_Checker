// Сквозная проверка в настоящем Chromium: расширение из dist/chrome, ответы mail.yandex.ru
// подменяются образцами страниц. Запуск: npm run e2e (подробности — CONTRIBUTING.md).
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inboxPage } from '../helpers/pages.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const DIST = fileURLToPath(new URL('../../dist/chrome', import.meta.url));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Копия сборки с тестовой страницей e2e.html: она импортирует src/tabs.js, чтобы вызвать
// openMail() с настоящими вкладками (клик по иконке и уведомлению автоматизировать нельзя)
function prepareExtension() {
    const dir = mkdtempSync(join(tmpdir(), 'ymc-e2e-'));
    cpSync(DIST, dir, { recursive: true });
    writeFileSync(join(dir, 'e2e.html'), '<!doctype html><script type="module" src="e2e.js"></script>');
    writeFileSync(join(dir, 'e2e.js'), "import { openMail } from './src/tabs.js'; globalThis.openMail = openMail;");
    return dir;
}

// Поддельный mail.yandex.ru: API счётчиков и /lite/inbox отдают текущее состояние, остальные
// адреса — пустую страницу почты. counters: { unread, fresh } или null (API нет — 404).
// status и redirect действуют на оба адреса
function createServer() {
    const server = {
        counters: { unread: 0, fresh: 0 },
        inbox: inboxPage({ count: 0 }),
        status: 200,
        redirect: null,
        requests: 0
    };
    server.handle = async (route) => {
        const url = new URL(route.request().url());
        const isCounters = url.pathname === '/api/v2/bar/counters';
        if (!isCounters && !url.pathname.startsWith('/lite/inbox')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Почта</title>' });
        }
        server.requests++;
        if (server.redirect) {
            return route.fulfill({ status: 302, headers: { location: server.redirect } });
        }
        if (isCounters) {
            if (server.status === 200 && !server.counters) return route.fulfill({ status: 404, body: 'Not Found' });
            return route.fulfill({
                status: server.status,
                contentType: 'application/json',
                body: JSON.stringify({ counters: server.counters })
            });
        }
        return route.fulfill({ status: server.status, contentType: 'text/html; charset=utf-8', body: server.inbox });
    };
    return server;
}

async function launch(lang, server) {
    const extDir = prepareExtension();
    const profile = mkdtempSync(join(tmpdir(), 'ymc-profile-'));
    const context = await chromium.launchPersistentContext(profile, {
        headless: true,
        channel: 'chromium',
        args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, `--lang=${lang}`]
    });
    await context.route('https://mail.yandex.ru/**', server.handle);
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;

    // Записываем создаваемые уведомления (и вызываем настоящий create).
    // У chrome и browser в Chrome общий объект notifications — перехватываем его один раз.
    await worker.evaluate(() => {
        globalThis.__notifications = [];
        const namespaces = new Set([globalThis.chrome?.notifications, globalThis.browser?.notifications]);
        for (const ns of [...namespaces].filter(Boolean)) {
            const original = ns.create.bind(ns);
            ns.create = (id, options) => {
                globalThis.__notifications.push(options);
                return original(id, options);
            };
        }
    });

    const cleanup = async () => {
        await context.close();
        rmSync(extDir, { recursive: true, force: true });
        rmSync(profile, { recursive: true, force: true });
    };
    return { context, worker, extensionId, cleanup };
}

const status = (worker) =>
    worker.evaluate(async () => ({
        badge: await chrome.action.getBadgeText({}),
        title: await chrome.action.getTitle({}),
        notifications: globalThis.__notifications,
        target: (await chrome.storage.session.get('notificationTarget')).notificationTarget,
        retry: Boolean(await chrome.alarms.get('retryCheck'))
    }));

// Запустить проверку немедленно — через будильник повтора, как это делает само расширение
const checkNow = (worker) => worker.evaluate(() => chrome.alarms.create('retryCheck', { when: Date.now() }));

async function waitFor(worker, predicate, timeout = 25000) {
    const deadline = Date.now() + timeout;
    let last;
    while (Date.now() < deadline) {
        last = await status(worker);
        if (predicate(last)) return last;
        await sleep(250);
    }
    assert.fail(`Не дождались нужного состояния, последнее: ${JSON.stringify(last)}`);
}

async function extensionErrors(context) {
    const page = await context.newPage();
    await page.goto('chrome://extensions/');
    const info = await page.evaluate(
        () => new Promise((resolve) => chrome.developerPrivate.getExtensionsInfo((list) => resolve(list)))
    );
    await page.close();
    return info.map((e) => ({
        name: e.name,
        manifestErrors: e.manifestErrors.map((x) => x.message),
        runtimeErrors: e.runtimeErrors.map((x) => x.message)
    }));
}

describe('Chromium, русский интерфейс', () => {
    const server = createServer();
    const anna = { id: '111', from: 'Анна Петрова', subject: 'Встреча в четверг' };
    const ivan = { id: '222', from: '&quot;Иван&quot; &amp; Ко', subject: 'Отчёт' };
    let browser;

    before(async () => {
        server.counters = { unread: 1, fresh: 0 };
        server.inbox = inboxPage({ count: 1, messages: [anna] });
        browser = await launch('ru', server);
    });
    after(() => browser?.cleanup());

    test('первая проверка: счётчик и подсказка, без уведомлений о старых письмах', async () => {
        const s = await waitFor(browser.worker, (x) => x.badge === '1');
        assert.match(s.title, /^Яндекс Почта: 1 непрочитанное письмо\nПроверено в \d\d:\d\d$/);
        assert.equal(s.notifications.length, 0);
        assert.ok(server.requests >= 1, 'запрос к «Яндексу» не дошёл до подменённого сервера');
    });

    test('новое письмо: перепроверка после действия во вкладке почты и уведомление', async () => {
        server.counters = { unread: 2, fresh: 1 };
        server.inbox = inboxPage({ count: 2, messages: [ivan, anna] });
        const tab = await browser.context.newPage();
        await tab.goto('https://mail.yandex.ru/?uid=1#inbox'); // tabs.onUpdated → перепроверка
        const s = await waitFor(browser.worker, (x) => x.badge === '2');
        assert.equal(s.notifications.length, 1);
        assert.equal(s.notifications[0].title, '"Иван" & Ко');
        assert.equal(s.notifications[0].message, 'Отчёт');
        assert.equal(s.target, '#/message/222');
        assert.match(s.title, /^Яндекс Почта: 2 непрочитанных письма, из них 1 новое\n/);
        await tab.close();
    });

    test('ошибка сервера: «!», текст ошибки, последний результат и повтор', async () => {
        Object.assign(server, { status: 503, redirect: null });
        await checkNow(browser.worker);
        const s = await waitFor(browser.worker, (x) => x.badge === '!');
        assert.match(
            s.title,
            /^Яндекс Почта: Ошибка сервера Яндекса \(503\)\nПоследняя успешная проверка в \d\d:\d\d: 2 непрочитанных письма$/
        );
        assert.equal(s.retry, true);
    });

    test('редирект на страницу входа: «?»', async () => {
        Object.assign(server, { status: 200, redirect: 'https://passport.yandex.ru/auth' });
        await checkNow(browser.worker);
        const s = await waitFor(browser.worker, (x) => x.badge === '?');
        // При любой ошибке подсказка показывает и последний успешный результат
        assert.match(
            s.title,
            /^Яндекс Почта: Требуется вход в почту\nПоследняя успешная проверка в \d\d:\d\d: 2 непрочитанных письма$/
        );
        assert.equal(s.retry, false, 'при необходимости входа быстрый повтор не нужен');
    });

    test('API счётчиков недоступно, в lite-версии капча: «!» и «Не удалось прочитать страницу почты»', async () => {
        Object.assign(server, {
            status: 200,
            redirect: null,
            counters: null,
            inbox: '<title>Ой!</title><div>captcha</div>'
        });
        await checkNow(browser.worker);
        const s = await waitFor(browser.worker, (x) => x.title.includes('Не удалось прочитать'));
        assert.equal(s.badge, '!');
    });

    test('открытие почты и письма в настоящих вкладках', async () => {
        const { context, extensionId } = browser;
        const helper = await context.newPage();
        await helper.goto(`chrome-extension://${extensionId}/e2e.html`);
        await helper.waitForFunction(() => typeof globalThis.openMail === 'function');
        // Вкладки — глазами расширения (chrome.tabs): Playwright видит вкладки, открытые расширением, не сразу
        const mailTabs = () =>
            helper.evaluate(async () =>
                (await chrome.tabs.query({ url: 'https://mail.yandex.ru/*' })).map((t) => ({
                    id: t.id,
                    url: t.pendingUrl || t.url,
                    active: t.active
                }))
            );

        // Вкладки почты нет — открывается новая
        await helper.evaluate(() => globalThis.openMail());
        await sleep(1000);
        let tabs = await mailTabs();
        assert.deepEqual(
            tabs.map((t) => t.url),
            ['https://mail.yandex.ru/']
        );
        await helper.evaluate((id) => chrome.tabs.remove(id), tabs[0].id);

        // Письмо открывается в уже открытой вкладке: меняется только hash, ?uid= сохраняется
        const mail = await context.newPage();
        await mail.goto('https://mail.yandex.ru/?uid=7#inbox');
        await helper.evaluate(() => globalThis.openMail('#/message/222'));
        await sleep(1000);
        tabs = await mailTabs();
        assert.equal(tabs.length, 1);
        assert.equal(tabs[0].url, 'https://mail.yandex.ru/?uid=7#/message/222');
        assert.equal(tabs[0].active, true);

        // Вкладку с черновиком не трогаем — письмо открывается в новой вкладке
        await mail.goto('https://mail.yandex.ru/?uid=7#compose');
        await helper.evaluate(() => globalThis.openMail('#/message/333'));
        await sleep(1000);
        tabs = await mailTabs();
        assert.deepEqual(tabs.map((t) => t.url).sort(), [
            'https://mail.yandex.ru/#/message/333',
            'https://mail.yandex.ru/?uid=7#compose'
        ]);
        await helper.close();
        await mail.close();
    });

    test('нет ошибок манифеста и выполнения, название на русском', async () => {
        const [info] = await extensionErrors(browser.context);
        assert.deepEqual(info, { name: 'Счётчик писем для Яндекс Почты', manifestErrors: [], runtimeErrors: [] });
    });
});

describe('Chromium, английский интерфейс', () => {
    const server = createServer();
    let browser;

    before(async () => {
        server.counters = { unread: 0, fresh: 0 };
        server.inbox = inboxPage({ count: 0 });
        browser = await launch('en-US', server);
    });
    after(() => browser?.cleanup());

    test('подсказка, уведомление-список и название на английском', async () => {
        await waitFor(browser.worker, (x) => x.title.startsWith('Yandex Mail: no new messages'));
        server.counters = { unread: 2, fresh: 2 };
        server.inbox = inboxPage({
            count: 2,
            messages: [
                { id: '1', from: 'Anna', subject: 'Hi' },
                { id: '2', from: '', subject: '' }
            ]
        });
        await checkNow(browser.worker);
        const s = await waitFor(browser.worker, (x) => x.badge === '2');
        assert.match(s.title, /^Yandex Mail: 2 unread messages, 2 new\nChecked at \d\d:\d\d [AP]M$/);
        assert.equal(s.notifications[0].type, 'list');
        assert.equal(s.notifications[0].title, '2 new messages');
        assert.deepEqual(s.notifications[0].items[1], { title: 'Sender', message: '(no subject)' });

        const [info] = await extensionErrors(browser.context);
        assert.deepEqual(info, { name: 'Checker for Yandex Mail', manifestErrors: [], runtimeErrors: [] });
    });
});

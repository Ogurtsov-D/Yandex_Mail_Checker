// Сквозная проверка в настоящем Firefox. Подробности и запуск — CONTRIBUTING.md (npm run e2e:firefox).
//
// Firefox не даёт автоматизации открывать страницы расширения, поэтому тестовая копия сборки
// получает хук в фоновом скрипте: он отчитывается о состоянии (бейдж, подсказка, уведомления,
// вкладки) локальному серверу и выполняет его команды. Тот же сервер изображает mail.yandex.ru:
// в копии адрес почты заменён на http://127.0.0.1:<порт>/. Остальной код расширения не меняется.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inboxPage } from '../helpers/pages.js';

const puppeteer = createRequire(import.meta.url)('puppeteer-core');
const FIREFOX = process.env.FIREFOX_BIN;
const DIST = fileURLToPath(new URL('../../dist/firefox', import.meta.url));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!FIREFOX) throw new Error('Укажите путь к Firefox в переменной FIREFOX_BIN (см. CONTRIBUTING.md)');

const HOOK = `
globalThis.__notifications = [];
const ns = browser.notifications;
const create = ns.create.bind(ns);
ns.create = (id, options) => { globalThis.__notifications.push(options); return create(id, options); };

async function report() {
    const state = {
        badge: await browser.action.getBadgeText({}),
        title: await browser.action.getTitle({}),
        notifications: globalThis.__notifications,
        target: (await browser.storage.session.get('notificationTarget')).notificationTarget ?? null,
        retry: Boolean(await browser.alarms.get('retryCheck')),
        tabs: (await browser.tabs.query({ url: 'http://127.0.0.1/*' })).map((t) => ({ id: t.id, url: t.url, active: t.active })),
        name: browser.i18n.getMessage('extName')
    };
    await fetch(__BASE__ + '__state', { method: 'POST', body: JSON.stringify(state) });
}

async function poll() {
    try {
        const command = await (await fetch(__BASE__ + '__command')).json();
        if (command?.type === 'check') await browser.alarms.create('retryCheck', { when: Date.now() });
        if (command?.type === 'openMail') await openMail(command.hash ?? null);
        if (command?.type === 'closeTab') await browser.tabs.remove(command.id);
        await report();
    } catch (error) {
        console.error('e2e hook', error);
    }
}
setInterval(poll, 300);
`;

function createServer() {
    const server = {
        inbox: inboxPage({ count: 0 }),
        status: 200,
        redirect: null,
        requests: 0,
        state: null,
        commands: []
    };
    server.http = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname === '/__state') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
                server.state = JSON.parse(body);
                res.end('ok');
            });
            return;
        }
        if (url.pathname === '/__command') {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify(server.commands.shift() ?? null));
        }
        if (url.pathname.startsWith('/lite/inbox')) {
            server.requests++;
            if (server.redirect) {
                res.writeHead(302, { location: server.redirect });
                return res.end();
            }
            res.writeHead(server.status, { 'content-type': 'text/html; charset=utf-8' });
            return res.end(server.inbox);
        }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<title>Почта</title>');
    });
    return server;
}

// Тестовая копия dist/firefox: адрес почты → локальный сервер, хук в фоновом скрипте
function prepareExtension(base) {
    const dir = mkdtempSync(join(tmpdir(), 'ymc-ff-'));
    cpSync(DIST, dir, { recursive: true });
    const configPath = join(dir, 'src/config.js');
    writeFileSync(
        configPath,
        readFileSync(configPath, 'utf8')
            .replace("'https://mail.yandex.ru/'", `'${base}'`)
            .replace("'https://mail.yandex.ru/*'", "'http://127.0.0.1/*'")
            .replace("'https://mail.yandex.ru/lite/inbox'", `'${base}lite/inbox'`)
    );
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    manifest.host_permissions.push('http://127.0.0.1/*');
    delete manifest.browser_specific_settings.gecko.update_url;
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    writeFileSync(
        join(dir, 'src/e2e-hook.js'),
        "import { openMail } from './tabs.js';\n" + HOOK.replaceAll('__BASE__', JSON.stringify(base))
    );
    const backgroundPath = join(dir, 'src/background.js');
    writeFileSync(backgroundPath, "import './e2e-hook.js';\n" + readFileSync(backgroundPath, 'utf8'));
    return dir;
}

async function launch(locale) {
    const server = createServer();
    await new Promise((resolve) => server.http.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.http.address().port}/`;
    const extDir = prepareExtension(base);
    const browser = await puppeteer.launch({
        browser: 'firefox',
        executablePath: FIREFOX,
        headless: true,
        extraPrefsFirefox: {
            'intl.locale.requested': locale,
            // Фоновый скрипт не выгружается при простое, пока идёт проверка
            'extensions.background.idle.enabled': false
        }
    });
    await browser.installExtension(extDir);

    const waitFor = async (predicate, timeout = 25000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            if (server.state && predicate(server.state)) return server.state;
            await sleep(250);
        }
        assert.fail(`Не дождались нужного состояния, последнее: ${JSON.stringify(server.state)}`);
    };
    const command = async (cmd) => {
        server.commands.push(cmd);
        while (server.commands.length) await sleep(100);
        await sleep(600); // дать команде выполниться и отчёту прийти
    };
    const cleanup = async () => {
        await browser.close();
        server.http.close();
        rmSync(extDir, { recursive: true, force: true });
    };
    return { browser, server, base, waitFor, command, cleanup };
}

describe('Firefox, русский интерфейс', () => {
    let ff;
    const anna = { id: '111', from: 'Анна Петрова', subject: 'Встреча в четверг' };
    const ivan = { id: '222', from: '&quot;Иван&quot; &amp; Ко', subject: 'Отчёт' };

    before(async () => {
        ff = await launch('ru');
        ff.server.inbox = inboxPage({ count: 1, messages: [anna] });
        await ff.command({ type: 'check' });
    });
    after(() => ff?.cleanup());

    test('первая проверка: счётчик, подсказка, название; без уведомлений о старых письмах', async () => {
        const s = await ff.waitFor((x) => x.badge === '1');
        assert.match(s.title, /^Яндекс Почта: 1 непрочитанное письмо\nПроверено в \d\d:\d\d$/);
        assert.equal(s.notifications.length, 0);
        assert.equal(s.name, 'Счётчик писем для Яндекс Почты');
    });

    test('новое письмо после действия во вкладке почты: basic-уведомление без priority', async () => {
        ff.server.inbox = inboxPage({ count: 2, messages: [ivan, anna] });
        const page = await ff.browser.newPage();
        await page.goto(`${ff.base}?uid=1#inbox`); // tabs.onUpdated → перепроверка
        const s = await ff.waitFor((x) => x.badge === '2');
        assert.equal(s.notifications.length, 1);
        const [n] = s.notifications;
        assert.deepEqual(
            { type: n.type, title: n.title, message: n.message, priority: 'priority' in n },
            { type: 'basic', title: '"Иван" & Ко', message: 'Отчёт', priority: false }
        );
        assert.equal(s.target, '#message/222');
        await page.close();
    });

    test('несколько новых писем: список превращается в basic-уведомление построчно', async () => {
        ff.server.inbox = inboxPage({
            count: 4,
            messages: [{ id: '333', from: 'Служба доставки', subject: 'Заказ' }, { id: '444' }, ivan, anna]
        });
        await ff.command({ type: 'check' });
        const s = await ff.waitFor((x) => x.badge === '4');
        const n = s.notifications.at(-1);
        assert.equal(n.type, 'basic');
        assert.equal(n.title, '2 новых письма');
        assert.equal(n.message, 'Служба доставки: Заказ\nОтправитель: Тема');
    });

    test('ошибка сервера: «!», текст ошибки, последний результат и повтор', async () => {
        Object.assign(ff.server, { status: 503, redirect: null });
        await ff.command({ type: 'check' });
        const s = await ff.waitFor((x) => x.badge === '!');
        assert.match(s.title, /^Яндекс Почта: Ошибка сервера Яндекса \(503\)\nПоследняя успешная проверка/);
        assert.equal(s.retry, true);
    });

    test('редирект на страницу входа: «?»', async () => {
        Object.assign(ff.server, { status: 200, redirect: 'https://passport.yandex.ru/auth' });
        await ff.command({ type: 'check' });
        const s = await ff.waitFor((x) => x.badge === '?');
        assert.match(s.title, /^Яндекс Почта: Требуется вход в почту/);
    });

    test('открытие почты и письма в настоящих вкладках', async () => {
        Object.assign(ff.server, { redirect: null });
        const urls = () => ff.server.state.tabs.map((t) => t.url).sort();

        // Вкладки почты нет — открывается новая
        for (const t of ff.server.state.tabs) await ff.command({ type: 'closeTab', id: t.id });
        await ff.command({ type: 'openMail' });
        await ff.waitFor((x) => x.tabs.length === 1);
        assert.deepEqual(urls(), [ff.base]);

        // Письмо — в той же вкладке, меняется только hash
        const page = await ff.browser.newPage();
        await page.goto(`${ff.base}?uid=7#inbox`);
        await ff.command({ type: 'closeTab', id: ff.server.state.tabs.find((t) => t.url === ff.base).id });
        await ff.command({ type: 'openMail', hash: '#message/222' });
        await ff.waitFor((x) => x.tabs.some((t) => t.url.endsWith('#message/222')));
        assert.deepEqual(urls(), [`${ff.base}?uid=7#message/222`]);

        // Вкладку с черновиком не трогаем
        await page.goto(`${ff.base}?uid=7#compose`);
        await ff.command({ type: 'openMail', hash: '#message/333' });
        await ff.waitFor((x) => x.tabs.length === 2);
        assert.deepEqual(urls(), [`${ff.base}#message/333`, `${ff.base}?uid=7#compose`]);
    });
});

describe('Firefox, английский интерфейс', () => {
    let ff;
    before(async () => {
        ff = await launch('en-US');
        ff.server.inbox = inboxPage({ count: 1, messages: [{ id: '1', from: 'Anna', subject: 'Hi' }] });
        await ff.command({ type: 'check' });
    });
    after(() => ff?.cleanup());

    test('название и подсказка на английском', async () => {
        const s = await ff.waitFor((x) => x.badge === '1');
        assert.match(s.title, /^Yandex Mail: 1 unread message\nChecked at \d\d:\d\d [AP]M$/);
        assert.equal(s.name, 'Checker for Yandex Mail');
    });
});

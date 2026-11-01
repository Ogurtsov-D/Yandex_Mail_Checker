// Домены почты: mail.yandex.com, .by, .kz, .com.tr, Яндекс 360
import assert from 'node:assert/strict';
import { beforeEach, mock as nodeMock, test } from 'node:test';
import { flush, installBrowserMock } from './helpers/browser-mock.js';
import { inboxPage } from './helpers/pages.js';

const mock = installBrowserMock();
nodeMock.method(console, 'warn', () => {});
await import('../src/background.js');
const on = mock.listeners;
const { checkMail } = await import('../src/checker.js');
const { urlsFor } = await import('../src/hosts.js');
const { MAIL_HOSTS } = await import('../src/config.js');

beforeEach(async () => {
    await flush();
    mock.reset();
    mock.respond(inboxPage({ count: 0 }));
});

test('адреса почты на домене', () => {
    assert.deepEqual(urlsFor('mail.360.yandex.ru'), {
        host: 'mail.360.yandex.ru',
        base: 'https://mail.360.yandex.ru/',
        tabPattern: 'https://mail.360.yandex.ru/*',
        counters: 'https://mail.360.yandex.ru/api/v2/bar/counters?silent&multi',
        accounts: 'https://mail.360.yandex.ru/api/v2/bar/accounts?silent',
        inbox: 'https://mail.360.yandex.ru/lite/inbox'
    });
});

test('домены из настроек совпадают с разрешениями в манифесте', async () => {
    const { readFileSync } = await import('node:fs');
    const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
    const origins = [...manifest.host_permissions, ...manifest.optional_host_permissions];
    assert.deepEqual(
        origins,
        MAIL_HOSTS.map((host) => `https://${host}/*`)
    );
});

test('выбран mail.yandex.com: запросы, вкладки и письма — на нём', async () => {
    mock.store.local.mailHost = 'mail.yandex.com';
    mock.grantedOrigins = ['https://mail.yandex.com/*'];
    mock.counters({ unread: 3, fresh: 0 });
    await checkMail();
    assert.equal(mock.calls.badge.text, '3');
    assert.ok(
        mock.requests.every((url) => url.startsWith('https://mail.yandex.com/')),
        mock.requests.join()
    );

    mock.setTabs([{ id: 1, windowId: 10, url: 'https://mail.yandex.ru/#inbox', lastAccessed: 9 }]);
    on.actionClicked();
    await flush();
    assert.deepEqual(mock.calls.createdTabs, ['https://mail.yandex.com/'], 'вкладка другого домена не подходит');

    mock.setTabs([{ id: 2, windowId: 20, url: 'https://mail.yandex.com/?uid=5#inbox', lastAccessed: 1 }]);
    mock.store.session.notificationTargets = { 'new-mail': { hash: '#/message/9', uid: null } };
    await on.notificationClicked('new-mail');
    assert.deepEqual(mock.calls.updatedTabs.at(-1), {
        id: 2,
        active: true,
        url: 'https://mail.yandex.com/?uid=5#/message/9'
    });
});

test('доступ к выбранному домену отозван — «!» и подсказка, без запросов и повторов', async () => {
    mock.store.local.mailHost = 'mail.yandex.kz';
    await checkMail();
    assert.equal(mock.fetchCount, 0);
    assert.equal(mock.calls.badge.text, '!');
    assert.equal(
        mock.calls.badge.title,
        'Яндекс Почта: Нет доступа к mail.yandex.kz: выберите адрес почты в настройках расширения'
    );
    assert.equal(mock.alarms.retryCheck, undefined);
});

test('сменили домен в настройках — сразу проверка на новом', async () => {
    mock.store.local.mailHost = 'mail.yandex.by';
    mock.grantedOrigins = ['https://mail.yandex.by/*'];
    mock.counters({ unread: 1, fresh: 0 });
    await on.storageChanged({ mailHost: { newValue: 'mail.yandex.by' } }, 'local');
    assert.equal(mock.requests[0], 'https://mail.yandex.by/api/v2/bar/counters?silent&multi');
    assert.equal(mock.calls.badge.text, '1');
});

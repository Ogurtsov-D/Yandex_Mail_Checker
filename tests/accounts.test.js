// Несколько аккаунтов: счётчик, подсказка, уведомления, меню, переход к письму
import assert from 'node:assert/strict';
import { beforeEach, mock as nodeMock, test } from 'node:test';
import { flush, installBrowserMock } from './helpers/browser-mock.js';
import { inboxPage } from './helpers/pages.js';

const mock = installBrowserMock();
nodeMock.method(console, 'warn', () => {});
await import('../src/background.js');
const on = mock.listeners;
const { checkMail } = await import('../src/checker.js');
const { parseAccountLogin } = await import('../src/parser.js');

// Шапка lite-версии с логином: первая буква выделена отдельным тегом
const head = (login) =>
    `<span class="b-head-user"><a class="b-user b-user__link" href="/lite/settings">` +
    `<b class="b-user__first-letter">${login[0]}</b>${login.slice(1)}</a></span>`;
// lite-версия своя у каждого аккаунта: /lite/inbox?uid=…
const pages = {};
function inbox(uid, login, options) {
    pages[uid] = inboxPage(options).replace('<body>', `<body>${head(login)}`);
}

beforeEach(async () => {
    await flush();
    mock.reset();
    for (const key of Object.keys(pages)) delete pages[key];
    mock.respond((url) => {
        const uid = new URL(url).searchParams.get('uid');
        return { type: 'basic', status: 200, ok: true, text: async () => pages[uid] ?? inboxPage() };
    });
});

const ivan = { id: '111', from: 'Анна', subject: 'Встреча' };
const work = { id: '222', from: 'Бухгалтерия', subject: 'Отчёт' };

async function twoAccounts() {
    inbox('11', 'ivan', { count: 1, messages: [ivan] });
    inbox('22', 'work', { count: 0 });
    mock.counters([
        { uid: '11', unread: 75, fresh: 0 },
        { uid: '22', unread: 5, fresh: 0 }
    ]);
    await checkMail();
}

test('логин из шапки lite-версии; нет шапки или странный текст — null', () => {
    assert.equal(parseAccountLogin(head('ivan.petrov')), 'ivan.petrov');
    assert.equal(parseAccountLogin(inboxPage()), null);
    assert.equal(parseAccountLogin('<div class="b-head-user"><span class="b-user">два слова</span></div>'), null);
});

test('два аккаунта: на значке сумма, в подсказке строка на каждый с логином', async () => {
    await twoAccounts();
    assert.equal(mock.calls.badge.text, '80');
    assert.match(
        mock.calls.badge.title,
        /^Яндекс Почта: 80 непрочитанных писем\nivan: 75 непрочитанных писем\nwork: 5 непрочитанных писем\nПроверено в \d\d:\d\d$/
    );
    // lite-версия каждого аккаунта запрошена один раз — чтобы запомнить письма и логин
    assert.deepEqual(mock.requests.filter((u) => u.includes('/lite/')).sort(), [
        'https://mail.yandex.ru/lite/inbox?uid=11',
        'https://mail.yandex.ru/lite/inbox?uid=22'
    ]);
    assert.equal(mock.calls.notifications.length, 0);
});

test('меню «Аккаунты» появляется только при нескольких аккаунтах', async () => {
    await twoAccounts();
    await on.storageChanged({ accountList: {} }, 'local');
    const items = mock.calls.menus.filter((m) => m.parentId === 'accounts');
    assert.deepEqual(
        items.map((m) => [m.title, m.checked]),
        [
            ['ivan', true],
            ['work', true]
        ]
    );
    assert.ok(mock.calls.menus.filter((m) => !m.parentId).length <= 6);

    mock.reset();
    mock.counters({ unread: 3, fresh: 0 });
    await checkMail();
    await on.storageChanged({ accountList: {} }, 'local');
    assert.ok(!mock.calls.menus.some((m) => m.id === 'accounts'));
});

test('выключенный аккаунт не учитывается в счётчике, подсказке и уведомлениях', async () => {
    await twoAccounts();
    await on.menuClicked({ menuItemId: 'account:22', checked: false });
    assert.deepEqual(mock.store.local.disabledAccounts, ['22']);
    assert.equal(mock.calls.badge.text, '75');
    assert.match(mock.calls.badge.title, /^Яндекс Почта: 75 непрочитанных писем\nПроверено/);

    inbox('22', 'work', { count: 1, messages: [work] });
    mock.counters([
        { uid: '11', unread: 75, fresh: 0 },
        { uid: '22', unread: 6, fresh: 1 }
    ]);
    await checkMail();
    assert.equal(mock.calls.notifications.length, 0);

    await on.menuClicked({ menuItemId: 'account:22', checked: true });
    assert.deepEqual(mock.store.local.disabledAccounts, []);
    assert.equal(mock.calls.badge.text, '81');
});

test('новое письмо во втором аккаунте: своё уведомление с подписью, клик — письмо в этом аккаунте', async () => {
    await twoAccounts();
    inbox('22', 'work', { count: 1, messages: [work] });
    mock.counters([
        { uid: '11', unread: 75, fresh: 0 },
        { uid: '22', unread: 6, fresh: 1 }
    ]);
    await checkMail();

    const [n] = mock.calls.notifications;
    assert.deepEqual([n.id, n.title, n.message, n.contextMessage], ['new-mail:22', 'Бухгалтерия', 'Отчёт', 'work']);
    assert.match(mock.calls.badge.title, /\nwork: 6 непрочитанных писем, из них 1 новое\n/);

    // Открыта почта первого аккаунта — письмо второго открывается в новой вкладке своего аккаунта
    mock.setTabs([{ id: 1, windowId: 10, url: 'https://mail.yandex.ru/?uid=11#inbox', lastAccessed: 5 }]);
    await on.notificationClicked('new-mail:22');
    assert.deepEqual(mock.calls.createdTabs, ['https://mail.yandex.ru/?uid=22#/message/222']);
    assert.deepEqual(mock.calls.clearedNotifications, ['new-mail:22']);

    // Вкладка второго аккаунта есть — письмо открывается в ней
    mock.setTabs([
        { id: 1, windowId: 10, url: 'https://mail.yandex.ru/?uid=11#inbox', lastAccessed: 9 },
        { id: 2, windowId: 20, url: 'https://mail.yandex.ru/?uid=22#inbox', lastAccessed: 1 }
    ]);
    await on.notificationClicked('new-mail:22');
    assert.deepEqual(mock.calls.updatedTabs.at(-1), {
        id: 2,
        active: true,
        url: 'https://mail.yandex.ru/?uid=22#/message/222'
    });

    // Зашли в почту второго аккаунта — убирается только его уведомление
    mock.counters([
        { uid: '11', unread: 75, fresh: 0 },
        { uid: '22', unread: 6, fresh: 0 }
    ]);
    await checkMail();
    assert.deepEqual(mock.calls.clearedNotifications, ['new-mail:22', 'new-mail:22', 'new-mail:22']);
});

test('клик по иконке не выбирает аккаунт: последняя вкладка почты или почта по умолчанию', async () => {
    await twoAccounts();
    on.actionClicked();
    await flush();
    assert.deepEqual(mock.calls.createdTabs, ['https://mail.yandex.ru/']);
});

test('логин не найден — аккаунт подписан номером', async () => {
    mock.respond(inboxPage({ count: 0 }));
    mock.counters([
        { uid: '11', unread: 1, fresh: 0 },
        { uid: '22', unread: 2, fresh: 0 }
    ]);
    await checkMail();
    assert.match(mock.calls.badge.title, /\nАккаунт 1: 1 непрочитанное письмо\nАккаунт 2: 2 непрочитанных письма\n/);
});

test('ответ API: аккаунты без чисел пропускаются, без единого аккаунта — запасной путь через lite', async () => {
    mock.counters(
        JSON.stringify([
            { uid: '11', data: { counters: { unread: 4, fresh: 0 } } },
            { uid: '22', data: { error: 'auth' } }
        ])
    );
    await checkMail();
    assert.equal(mock.calls.badge.text, '4');
    assert.equal(mock.store.local.accountSummary, null, 'остался один аккаунт — подсказка без строк по аккаунтам');

    mock.reset();
    mock.counters('[]');
    mock.respond(inboxPage({ count: 9 }));
    await checkMail();
    assert.equal(mock.calls.badge.text, '9');
});

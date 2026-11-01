// Несколько аккаунтов: счётчик, подсказка, уведомления, меню, переход в аккаунт
import assert from 'node:assert/strict';
import { beforeEach, mock as nodeMock, test } from 'node:test';
import { flush, installBrowserMock } from './helpers/browser-mock.js';
import { inboxPage } from './helpers/pages.js';

const mock = installBrowserMock();
nodeMock.method(console, 'warn', () => {});
await import('../src/background.js');
const on = mock.listeners;
const { checkMail } = await import('../src/checker.js');

beforeEach(async () => {
    await flush();
    mock.reset();
    // lite-версия всегда показывает аккаунт по умолчанию — при нескольких аккаунтах она не нужна
    mock.respond(inboxPage({ count: 1, messages: [{ id: '111', from: 'Анна', subject: 'Встреча' }] }));
});

const counters = (first, second) => [
    { uid: '11', ...first },
    { uid: '22', ...second }
];

async function twoAccounts() {
    mock.counters(counters({ unread: 75, fresh: 0 }, { unread: 5, fresh: 0 }));
    await checkMail();
}

test('два аккаунта: на значке сумма, в подсказке строка на каждый; lite-версия не запрашивается', async () => {
    await twoAccounts();
    assert.equal(mock.calls.badge.text, '80');
    assert.match(
        mock.calls.badge.title,
        /^Яндекс Почта: 80 непрочитанных писем\nАккаунт 1: 75 непрочитанных писем\nАккаунт 2: 5 непрочитанных писем\nПроверено в \d\d:\d\d$/
    );
    assert.ok(!mock.requests.some((u) => u.includes('/lite/')), mock.requests.join());
    assert.equal(mock.calls.notifications.length, 0);
});

test('имена аккаунтов из настроек — в подсказке, меню и уведомлениях', async () => {
    mock.store.local.accountNames = { 11: 'Личная', 22: 'Работа' };
    await twoAccounts();
    assert.match(mock.calls.badge.title, /\nЛичная: 75 непрочитанных писем\nРабота: 5 непрочитанных писем\n/);

    mock.counters(counters({ unread: 75, fresh: 0 }, { unread: 6, fresh: 1 }));
    await checkMail();
    const [n] = mock.calls.notifications;
    assert.deepEqual(
        [n.id, n.title, n.message, n.contextMessage],
        ['new-mail:22', '1 новое письмо', 'Откройте почту для просмотра', 'Работа']
    );
});

test('меню: сверху аккаунты с числом писем, остальное — в «Настройки»; клик открывает аккаунт', async () => {
    await twoAccounts();
    await on.storageChanged({ accountList: {} }, 'local');
    const top = mock.calls.menus.filter((m) => !m.parentId);
    assert.deepEqual(
        top.map((m) => m.title),
        ['Аккаунт 1 — 75', 'Аккаунт 2 — 5', 'Проверить сейчас', 'Настройки']
    );
    assert.ok(mock.calls.menus.some((m) => m.parentId === 'settings' && m.id === 'interval'));

    // В режиме «Только новые» — число новых
    mock.store.local.badgeMode = 'fresh';
    await on.storageChanged({ badgeMode: {} }, 'local');
    assert.equal(mock.calls.menus.find((m) => m.id === 'account:11').title, 'Аккаунт 1 — 0');

    // Открывается полная версия почты нужного аккаунта (lite-версия ?uid= не учитывает)
    mock.setTabs([{ id: 1, windowId: 10, url: 'https://mail.yandex.ru/?uid=11#inbox', lastAccessed: 9 }]);
    await on.menuClicked({ menuItemId: 'account:22' });
    assert.deepEqual(mock.calls.createdTabs, ['https://mail.yandex.ru/?uid=22']);
    await on.menuClicked({ menuItemId: 'account:11' });
    assert.deepEqual(mock.calls.updatedTabs, [{ id: 1, active: true }]);
});

test('аккаунтов больше, чем помещается, — подменю «Открыть аккаунт»; один аккаунт — прежнее меню', async () => {
    mock.counters(['1', '2', '3', '4', '5'].map((uid) => ({ uid, unread: 1, fresh: 0 })));
    await checkMail();
    await on.storageChanged({ accountList: {} }, 'local');
    assert.deepEqual(
        mock.calls.menus.filter((m) => !m.parentId).map((m) => m.id),
        ['accounts', 'check-now', 'settings']
    );
    assert.equal(mock.calls.menus.filter((m) => m.parentId === 'accounts').length, 5);

    mock.reset();
    mock.counters({ unread: 3, fresh: 0 });
    await checkMail();
    await on.storageChanged({ accountList: {} }, 'local');
    assert.deepEqual(
        mock.calls.menus.filter((m) => !m.parentId).map((m) => m.id),
        ['check-now', 'separator-1', 'interval', 'badge', 'notifications-menu']
    );
});

test('аккаунт, который не учитывается, не попадает на значок, в подсказку и уведомления', async () => {
    mock.store.local.disabledAccounts = ['22'];
    await twoAccounts();
    assert.equal(mock.calls.badge.text, '75');
    assert.match(mock.calls.badge.title, /^Яндекс Почта: 75 непрочитанных писем\nПроверено/);

    mock.counters(counters({ unread: 75, fresh: 0 }, { unread: 6, fresh: 1 }));
    await checkMail();
    assert.equal(mock.calls.notifications.length, 0);

    // Сняли запрет на странице настроек — сразу пересчёт
    mock.store.local.disabledAccounts = [];
    await on.storageChanged({ disabledAccounts: {} }, 'local');
    assert.equal(mock.calls.badge.text, '81');
});

test('новое письмо во втором аккаунте: уведомление с подписью, клик открывает этот аккаунт', async () => {
    await twoAccounts();
    mock.counters(counters({ unread: 75, fresh: 0 }, { unread: 6, fresh: 1 }));
    await checkMail();
    assert.match(mock.calls.badge.title, /\nАккаунт 2: 6 непрочитанных писем, из них 1 новое\n/);

    mock.setTabs([{ id: 1, windowId: 10, url: 'https://mail.yandex.ru/?uid=11#inbox', lastAccessed: 5 }]);
    await on.notificationClicked('new-mail:22');
    assert.deepEqual(mock.calls.createdTabs, ['https://mail.yandex.ru/?uid=22']);
    assert.deepEqual(mock.calls.clearedNotifications, ['new-mail:22']);

    // Зашли в почту второго аккаунта — убирается только его уведомление
    mock.counters(counters({ unread: 75, fresh: 0 }, { unread: 6, fresh: 0 }));
    await checkMail();
    assert.deepEqual(mock.calls.clearedNotifications, ['new-mail:22', 'new-mail:22']);
});

test('клик по иконке не выбирает аккаунт: последняя вкладка почты или почта по умолчанию', async () => {
    await twoAccounts();
    on.actionClicked();
    await flush();
    assert.deepEqual(mock.calls.createdTabs, ['https://mail.yandex.ru/']);
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

test('аккаунт временно пропал из ответа — его состояние сохраняется, письма за перерыв не теряются', async () => {
    await twoAccounts();
    mock.counters(
        JSON.stringify([
            { uid: '11', data: { counters: { unread: 75, fresh: 0 } } },
            { uid: '22', data: {} }
        ])
    );
    await checkMail();
    assert.equal(mock.store.local.accounts['22'].lastFresh, 0);

    mock.counters(counters({ unread: 75, fresh: 0 }, { unread: 6, fresh: 1 }));
    await checkMail();
    assert.deepEqual(
        mock.calls.notifications.map((n) => n.id),
        ['new-mail:22']
    );
});

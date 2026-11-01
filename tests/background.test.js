// Обработчики событий: установка, меню, клики, вкладки
import assert from 'node:assert/strict';
import { beforeEach, mock as nodeMock, test } from 'node:test';
import { flush, installBrowserMock } from './helpers/browser-mock.js';
import { inboxPage } from './helpers/pages.js';

const mock = installBrowserMock();
nodeMock.method(console, 'warn', () => {});
await import('../src/background.js');
const on = mock.listeners;

beforeEach(async () => {
    await flush();
    mock.reset();
    mock.respond(inboxPage({ count: 0 }));
    // Обычная проверка — один запрос к API счётчиков (lite-версия нужна только для новых писем)
    mock.counters({ unread: 0, fresh: 0 });
    mock.store.local.knownMessageIds = [];
});

const mailTab = (id, url, lastAccessed = 1) => ({ id, windowId: id * 10, url, lastAccessed });

// Будильник плановой проверки: период — интервал, первое срабатывание — с разбросом ±12,5%
function assertCheckAlarm(minutes) {
    const alarm = mock.alarms.checkMail;
    assert.equal(alarm.periodInMinutes, minutes);
    assert.ok(Math.abs(alarm.delayInMinutes - minutes) <= minutes * 0.125, `delay ${alarm.delayInMinutes}`);
}

test('установка: будильник по умолчанию 5 минут, меню, первая проверка', async () => {
    await on.installed({ reason: 'install' });
    assertCheckAlarm(5);
    assert.equal(mock.fetchCount, 1);

    const titles = mock.calls.menus.map((m) => m.title).filter(Boolean);
    assert.deepEqual(titles, [
        'Проверить сейчас',
        'Интервал проверки',
        '1 минута',
        '5 минут',
        '15 минут',
        '30 минут',
        'На значке',
        'Все непрочитанные',
        'Только новые',
        'Уведомления',
        'Показывать уведомления о новых письмах',
        'Звук',
        'Тихие часы: 23:00–08:00'
    ]);
    const checked = mock.calls.menus.filter((m) => m.checked).map((m) => m.id);
    assert.deepEqual(checked, ['interval-5', 'badge-unread', 'notifications', 'sound']);
    assert.ok(mock.calls.menus.every((m) => m.contexts.includes('action')));
    // Не больше 6 пунктов верхнего уровня: остальные браузер не покажет
    assert.ok(mock.calls.menus.filter((m) => !m.parentId).length <= 6);
});

test('меню: смена интервала пересоздаёт будильник', async () => {
    await on.menuClicked({ menuItemId: 'interval-15', checked: true });
    assert.equal(mock.store.local.checkInterval, 15);
    assertCheckAlarm(15);
});

test('меню: уведомления, звук, тихие часы, режим значка', async () => {
    await on.menuClicked({ menuItemId: 'notifications', checked: false });
    assert.equal(mock.store.local.notificationsEnabled, false);
    await on.menuClicked({ menuItemId: 'notifications', checked: true });
    assert.equal(mock.store.local.notificationsEnabled, true);
    await on.menuClicked({ menuItemId: 'sound', checked: false });
    assert.equal(mock.store.local.soundEnabled, false);
    await on.menuClicked({ menuItemId: 'quiet-hours', checked: true });
    assert.equal(mock.store.local.quietHoursEnabled, true);
    await on.menuClicked({ menuItemId: 'badge-fresh', checked: true });
    assert.equal(mock.store.local.badgeMode, 'fresh');
});

test('изменились настройки — меню и иконка обновляются; прочие изменения хранилища не трогают меню', async () => {
    mock.store.local = { ...mock.store.local, notificationsEnabled: false, quietFrom: '22:30', classicIcon: true };
    await on.storageChanged({ notificationsEnabled: { newValue: false } }, 'local');
    const quiet = mock.calls.menus.find((m) => m.id === 'quiet-hours');
    assert.equal(quiet.title, 'Тихие часы: 22:30–08:00');
    assert.equal(quiet.enabled, false, 'без уведомлений тихие часы и звук неактивны');
    assert.deepEqual(mock.calls.icons.at(-1), { 16: '/icons/classic/icon16.png', 32: '/icons/classic/icon32.png' });

    mock.calls.menus.length = 0;
    await on.storageChanged({ unreadCount: { newValue: 3 } }, 'local');
    await on.storageChanged({ retryCount: { newValue: 1 } }, 'session');
    assert.equal(mock.calls.menus.length, 0);
});

test('режим «Только новые»: на значке fresh', async () => {
    mock.store.local.badgeMode = 'fresh';
    mock.counters({ unread: 7, fresh: 2 });
    await on.menuClicked({ menuItemId: 'check-now' });
    assert.equal(mock.calls.badge.text, '2');
    assert.match(mock.calls.badge.title, /^Яндекс Почта: 7 непрочитанных писем, из них 2 новых/);
});

test('не за компьютером: плановая проверка пропускается, при возвращении — сразу проверка', async () => {
    mock.idleState = 'locked';
    await on.alarm({ name: 'checkMail' });
    assert.equal(mock.fetchCount, 0);
    assertCheckAlarm(5);

    await on.idleStateChanged('idle');
    assert.equal(mock.fetchCount, 0);
    mock.idleState = 'active';
    await on.idleStateChanged('active');
    assert.equal(mock.fetchCount, 1);
    // Повторное возвращение без пропущенных проверок — без лишнего запроса
    await on.idleStateChanged('active');
    assert.equal(mock.fetchCount, 1);
});

test('пауза выключена в настройках — проверяем и в простое', async () => {
    mock.store.local.pauseWhenIdle = false;
    mock.idleState = 'idle';
    await on.alarm({ name: 'checkMail' });
    assert.equal(mock.fetchCount, 1);
});

test('меню: «Проверить сейчас»', async () => {
    await on.menuClicked({ menuItemId: 'check-now' });
    assert.equal(mock.fetchCount, 1);
});

test('будильники запускают проверку, плановый — пересоздаётся с новым разбросом', async () => {
    on.alarm({ name: 'checkMail' });
    await flush();
    on.alarm({ name: 'retryCheck' });
    await flush();
    assert.equal(mock.fetchCount, 2);
    assertCheckAlarm(5);
});

test('клик по иконке без открытой почты — новая вкладка', async () => {
    on.actionClicked();
    await flush();
    assert.deepEqual(mock.calls.createdTabs, ['https://mail.yandex.ru/']);
});

test('клик по иконке — переключение на самую недавнюю вкладку почты без перезагрузки', async () => {
    mock.setTabs([
        mailTab(1, 'https://mail.yandex.ru/?uid=1#inbox', 100),
        mailTab(2, 'https://mail.yandex.ru/lite/inbox', 500),
        mailTab(3, 'https://ya.ru/', 900)
    ]);
    on.actionClicked();
    await flush();
    assert.deepEqual(mock.calls.createdTabs, []);
    assert.deepEqual(mock.calls.updatedTabs, [{ id: 2, active: true }]);
    assert.deepEqual(mock.calls.focusedWindows, [20]);
});

test('клик по уведомлению об одном письме — письмо в открытой вкладке, ?uid= сохраняется', async () => {
    mock.store.session.notificationTarget = '#/message/222';
    mock.setTabs([mailTab(5, 'https://mail.yandex.ru/?uid=42#inbox')]);
    await on.notificationClicked('new-mail');
    assert.deepEqual(mock.calls.updatedTabs, [
        { id: 5, active: true, url: 'https://mail.yandex.ru/?uid=42#/message/222' }
    ]);
    assert.deepEqual(mock.calls.clearedNotifications, ['new-mail']);
});

test('клик по уведомлению: вкладку с черновиком и lite-версию не трогаем — новая вкладка', async () => {
    mock.store.session.notificationTarget = '#/message/222';
    mock.setTabs([
        mailTab(6, 'https://mail.yandex.ru/?uid=42#compose', 9),
        mailTab(7, 'https://mail.yandex.ru/lite/inbox', 8)
    ]);
    await on.notificationClicked('new-mail');
    assert.deepEqual(mock.calls.updatedTabs, []);
    assert.deepEqual(mock.calls.createdTabs, ['https://mail.yandex.ru/#/message/222']);
});

test('клик по уведомлению о нескольких письмах — просто почта', async () => {
    mock.store.session.notificationTarget = null;
    await on.notificationClicked('new-mail');
    assert.deepEqual(mock.calls.createdTabs, ['https://mail.yandex.ru/']);
});

test('после действий во вкладке почты — одна проверка, не чаще раза в 15 секунд', async (t) => {
    // Часы на час вперёд: предыдущие тесты уже проверяли почту «только что»
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() + 3600000 });

    await on.tabUpdated(
        1,
        { url: 'https://mail.yandex.ru/#/message/1' },
        { url: 'https://mail.yandex.ru/#/message/1' }
    );
    t.mock.timers.tick(3000);
    await flush();
    assert.equal(mock.fetchCount, 1, 'проверка через 3 секунды');

    // Сразу после проверки: открыл ещё письмо, затем 30 секунд мигает заголовок
    await on.tabUpdated(1, { url: 'https://mail.yandex.ru/#inbox' }, { url: 'https://mail.yandex.ru/#inbox' });
    for (let second = 1; second <= 30; second++) {
        await on.tabUpdated(1, { title: `Входящие (${second % 2})` }, { url: 'https://mail.yandex.ru/#inbox' });
        t.mock.timers.tick(1000);
        await flush();
        if (second === 10) assert.equal(mock.fetchCount, 1, 'не раньше 15 секунд после прошлой проверки');
    }
    // За 30 секунд событий: проверки идут (события их не откладывают), но не чаще раза в 15 секунд
    assert.equal(mock.fetchCount, 3);
});

test('события чужих вкладок игнорируются', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    await on.tabUpdated(9, { title: 'Новости' }, { url: 'https://news.example/' });
    await on.tabUpdated(9, { url: 'https://news.example/2' }, { url: 'https://news.example/2' });
    await on.tabRemoved(9);
    t.mock.timers.tick(60000);
    await flush();
    assert.equal(mock.fetchCount, 0);
});

test('закрыли вкладку почты или ушли с почты — проверка', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() + 2 * 3600000 });

    await on.tabUpdated(4, { url: 'https://mail.yandex.ru/#inbox' }, { url: 'https://mail.yandex.ru/#inbox' });
    t.mock.timers.tick(60000);
    await flush();
    await on.tabRemoved(4);
    t.mock.timers.tick(60000);
    await flush();
    assert.equal(mock.fetchCount, 2);

    await on.tabUpdated(8, { url: 'https://mail.yandex.ru/#inbox' }, { url: 'https://mail.yandex.ru/#inbox' });
    t.mock.timers.tick(60000);
    await flush();
    await on.tabUpdated(8, { url: 'https://ya.ru/' }, { url: 'https://ya.ru/' });
    t.mock.timers.tick(60000);
    await flush();
    assert.equal(mock.fetchCount, 4);
});

test('запуск браузера: меню пересоздаётся, почта проверяется', async () => {
    await on.startup();
    assert.ok(mock.calls.menus.length > 0);
    assert.equal(mock.fetchCount, 1);
});

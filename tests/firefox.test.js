// Отличия Firefox: объект browser.*, уведомления только type: 'basic'
import assert from 'node:assert/strict';
import { beforeEach, mock as nodeMock, test } from 'node:test';
import { installBrowserMock } from './helpers/browser-mock.js';
import { fixture, inboxPage } from './helpers/pages.js';

const mock = installBrowserMock({ firefox: true });
nodeMock.method(console, 'warn', () => {});
const { IS_FIREFOX, ext } = await import('../src/api.js');
const { checkMail } = await import('../src/checker.js');

beforeEach(() => mock.reset());

test('используется browser.*', () => {
    assert.equal(IS_FIREFOX, true);
    assert.equal(ext, globalThis.browser);
    assert.equal(globalThis.chrome, undefined);
});

test('несколько писем — basic-уведомление со списком строк, без priority', async () => {
    mock.respond(inboxPage({ count: 0 }));
    await checkMail();
    mock.respond(fixture('inbox-unread.html'));
    await checkMail();

    const [n] = mock.calls.notifications;
    assert.equal(n.type, 'basic');
    assert.equal(n.title, '3 новых письма');
    assert.equal(
        n.message,
        '"Рога & Копыта": Заказ №1234 передан курьеру — сегодня\nИван Смирнов: Отчёт за октябрь\nАнна Петрова: Встреча в четверг'
    );
    assert.ok(!('priority' in n) && !('items' in n));
});

test('одно письмо — basic-уведомление без priority', async () => {
    mock.respond(inboxPage({ count: 0 }));
    await checkMail();
    mock.respond(inboxPage({ count: 1, messages: [{ id: '1', from: 'Анна', subject: 'Привет' }] }));
    await checkMail();

    const [n] = mock.calls.notifications;
    assert.deepEqual(
        { type: n.type, title: n.title, message: n.message, hasPriority: 'priority' in n },
        { type: 'basic', title: 'Анна', message: 'Привет', hasPriority: false }
    );
});

test('звук в Firefox не настраивается: без silent и без пункта «Звук»; есть пункт «Настройки…»', async () => {
    const { createContextMenu, handleMenuClick } = await import('../src/menu.js');
    mock.store.local.soundEnabled = false;
    mock.respond(inboxPage({ count: 0 }));
    await checkMail();
    mock.respond(inboxPage({ count: 1, messages: [{ id: '1', from: 'Анна', subject: 'Привет' }] }));
    await checkMail();
    assert.ok(!('silent' in mock.calls.notifications[0]));

    await createContextMenu();
    const ids = mock.calls.menus.map((m) => m.id);
    assert.ok(!ids.includes('sound'));
    assert.ok(ids.includes('options'));
    assert.ok(mock.calls.menus.filter((m) => !m.parentId).length <= 6);
    await handleMenuClick({ menuItemId: 'options' });
    assert.equal(mock.calls.openedOptions, 1);
});

test('несколько аккаунтов: подпись аккаунта — последней строкой текста (contextMessage Firefox не знает)', async () => {
    mock.respond(inboxPage({ count: 1, messages: [{ id: '1', from: 'Анна', subject: 'Привет' }] }));
    mock.counters([
        { uid: '11', unread: 0, fresh: 0 },
        { uid: '22', unread: 0, fresh: 0 }
    ]);
    await checkMail();
    mock.respond(
        inboxPage({
            count: 2,
            messages: [
                { id: '2', from: 'Иван', subject: 'Отчёт' },
                { id: '1', from: 'Анна', subject: 'Привет' }
            ]
        })
    );
    mock.counters([
        { uid: '11', unread: 0, fresh: 0 },
        { uid: '22', unread: 1, fresh: 1 }
    ]);
    await checkMail();
    const [n] = mock.calls.notifications;
    assert.equal(n.message, 'Отчёт\nАккаунт 2');
    assert.ok(!('contextMessage' in n));
});

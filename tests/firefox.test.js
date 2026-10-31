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

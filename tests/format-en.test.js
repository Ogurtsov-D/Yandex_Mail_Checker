// Английский интерфейс: тексты, склонение, формат времени, меню и уведомления
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installBrowserMock } from './helpers/browser-mock.js';
import { inboxPage } from './helpers/pages.js';

const mock = installBrowserMock({ locale: 'en' });
const { formatCheckTime, tooltipText, unreadText } = await import('../src/format.js');
const { plural } = await import('../src/i18n.js');
const { checkMail } = await import('../src/checker.js');
const { createContextMenu } = await import('../src/menu.js');

test('English plural forms', () => {
    assert.deepEqual(
        [1, 5, 15].map((n) => plural('minutes', n)),
        ['1 minute', '5 minutes', '15 minutes']
    );
    assert.equal(unreadText(1), '1 unread message');
    assert.equal(unreadText(21), '21 unread messages');
    assert.equal(unreadText(0), 'no unread messages');
});

test('check time in English', () => {
    const now = new Date(2026, 9, 31, 15, 0).getTime();
    assert.equal(formatCheckTime(new Date(2026, 9, 31, 14, 32).getTime(), now), 'at 02:32 PM');
    assert.equal(formatCheckTime(new Date(2026, 9, 30, 9, 5).getTime(), now), 'yesterday at 09:05 AM');
    assert.equal(formatCheckTime(new Date(2026, 9, 28, 14, 32).getTime(), now), 'Oct 28 at 02:32 PM');
});

test('tooltip in English', () => {
    const now = new Date(2026, 9, 31, 15, 0).getTime();
    const at = new Date(2026, 9, 31, 14, 32).getTime();
    assert.equal(
        tooltipText({ unreadCount: 3, lastSuccess: at }, now),
        'Yandex Mail: 3 unread messages\nChecked at 02:32 PM'
    );
    assert.equal(
        tooltipText({ unreadCount: 3, freshCount: 1, lastSuccess: at }, now),
        'Yandex Mail: 3 unread messages, 1 new\nChecked at 02:32 PM'
    );
    assert.equal(
        tooltipText({ errorType: 'server', errorStatus: 502, lastSuccess: at, unreadCount: 1 }, now),
        'Yandex Mail: Yandex server error (502)\nLast successful check at 02:32 PM: 1 unread message'
    );
});

test('menu and notifications in English', async () => {
    await createContextMenu();
    assert.deepEqual(mock.calls.menus.map((m) => m.title).filter(Boolean), [
        'Check now',
        'Check interval',
        '1 minute',
        '5 minutes',
        '15 minutes',
        '30 minutes',
        'Badge shows',
        'All unread messages',
        'New messages only',
        'Notifications',
        'Show new mail notifications',
        'Sound',
        'Quiet hours: 23:00–08:00'
    ]);

    mock.respond(inboxPage({ count: 0 }));
    await checkMail();
    mock.respond(
        inboxPage({
            count: 2,
            messages: [
                { id: '1', from: '', subject: '' },
                { id: '2', from: 'Anna', subject: 'Hi' }
            ]
        })
    );
    await checkMail();
    const [n] = mock.calls.notifications;
    assert.equal(n.title, '2 new messages');
    assert.deepEqual(n.items, [
        { title: 'Sender', message: '(no subject)' },
        { title: 'Anna', message: 'Hi' }
    ]);
});

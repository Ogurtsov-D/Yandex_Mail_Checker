// Проверка почты: состояние, уведомления, ошибки, повторы
import assert from 'node:assert/strict';
import { beforeEach, describe, mock as nodeMock, test } from 'node:test';
import { flush, installBrowserMock } from './helpers/browser-mock.js';
import { fixture, inboxPage } from './helpers/pages.js';

const mock = installBrowserMock();
nodeMock.method(console, 'warn', () => {}); // ошибки проверки ожидаемы, не засоряем вывод
const { checkMail } = await import('../src/checker.js');

const anna = { id: '111', from: 'Анна Петрова', subject: 'Встреча' };
const ivan = { id: '222', from: 'Иван', subject: 'Отчёт' };

beforeEach(() => mock.reset());

const COUNTERS = 'https://mail.yandex.ru/api/v2/bar/counters?silent';
const INBOX = 'https://mail.yandex.ru/lite/inbox';
const vera = { id: '333', from: 'Вера', subject: 'Билеты' };

describe('счётчики Яндекса (основной способ)', () => {
    test('первая проверка: на бейдже unread из API, известные письма запоминаются без уведомлений', async () => {
        mock.counters({ unread: 4, fresh: 0 });
        mock.respond(inboxPage({ count: 2, messages: [anna, ivan] }));
        await checkMail();
        assert.equal(mock.calls.badge.text, '4');
        assert.match(mock.calls.badge.title, /^Яндекс Почта: 4 непрочитанных письма\nПроверено в \d\d:\d\d$/);
        assert.deepEqual(mock.requests, [COUNTERS, INBOX]);
        assert.deepEqual(mock.store.local.knownMessageIds, ['111', '222']);
        assert.equal(mock.calls.notifications.length, 0);
    });

    test('ничего нового — один запрос к API, без уведомлений', async () => {
        mock.counters({ unread: 4, fresh: 0 });
        mock.respond(inboxPage({ count: 2, messages: [anna, ivan] }));
        await checkMail();
        mock.requests.length = 0;
        mock.counters({ unread: 3, fresh: 0 });
        await checkMail();
        assert.deepEqual(mock.requests, [COUNTERS]);
        assert.equal(mock.calls.badge.text, '3');
        assert.equal(mock.calls.notifications.length, 0);
    });

    test('fresh вырос: уведомление о новом письме из lite-версии, подсказка «из них 1 новое»', async () => {
        mock.counters({ unread: 2, fresh: 0 });
        mock.respond(inboxPage({ count: 2, messages: [anna, ivan] }));
        await checkMail();

        // Прочитал одно, пришло одно: unread тот же, fresh вырос
        mock.counters({ unread: 2, fresh: 1 });
        mock.respond(inboxPage({ count: 2, messages: [vera, anna] }));
        await checkMail();

        assert.equal(mock.calls.notifications.length, 1);
        const [n] = mock.calls.notifications;
        assert.deepEqual([n.type, n.title, n.message], ['basic', 'Вера', 'Билеты']);
        assert.equal(mock.store.session.notificationTarget, '#/message/333');
        assert.match(mock.calls.badge.title, /^Яндекс Почта: 2 непрочитанных письма, из них 1 новое\n/);

        // Следующая проверка с тем же fresh — повторного уведомления нет
        await checkMail();
        assert.equal(mock.calls.notifications.length, 1);
    });

    test('новые письма сверху: старые непрочитанные, которых не было в списке, не попадают в уведомление', async () => {
        mock.counters({ unread: 1, fresh: 0 });
        mock.respond(inboxPage({ count: 1, messages: [anna] }));
        await checkMail();

        // fresh +1, на странице сверху новое письмо, ниже — непрочитанное, о котором расширение не знало
        mock.counters({ unread: 3, fresh: 1 });
        mock.respond(inboxPage({ count: 3, messages: [vera, ivan, anna] }));
        await checkMail();
        assert.deepEqual(
            mock.calls.notifications.map((n) => n.title),
            ['Вера']
        );
    });

    test('пришло больше писем, чем нашлось во «Входящих»: в заголовке — общее число', async () => {
        mock.counters({ unread: 1, fresh: 0 });
        mock.respond(inboxPage({ count: 1, messages: [anna] }));
        await checkMail();

        // Два письма, одно из них попало в другую папку
        mock.counters({ unread: 3, fresh: 2 });
        mock.respond(inboxPage({ count: 2, messages: [vera, anna] }));
        await checkMail();
        const [n] = mock.calls.notifications;
        assert.equal(n.type, 'list');
        assert.equal(n.title, '2 новых письма');
        assert.deepEqual(
            n.items.map((i) => i.title),
            ['Вера']
        );
        assert.equal(mock.store.session.notificationTarget, null);
    });

    test('lite-версия недоступна: уведомление без подробностей, счётчик из API без ошибки', async () => {
        mock.counters({ unread: 1, fresh: 0 });
        mock.respond(inboxPage({ count: 1, messages: [anna] }));
        await checkMail();

        mock.counters({ unread: 3, fresh: 2 });
        mock.respond(fixture('captcha.html'));
        await checkMail();
        const [n] = mock.calls.notifications;
        assert.deepEqual([n.type, n.title, n.message], ['basic', '2 новых письма', 'Откройте почту для просмотра']);
        assert.equal(mock.calls.badge.text, '3');

        mock.counters({ unread: 4, fresh: 3 });
        mock.respond(() => ({ type: 'basic', status: 503, ok: false }));
        await checkMail();
        assert.equal(mock.calls.notifications.at(-1).title, '1 новое письмо');
        assert.equal(mock.calls.badge.text, '4');
        assert.equal(mock.store.local.errorType, null);
    });

    test('зашли в почту (fresh обнулился) — уведомление о новых письмах убирается', async () => {
        mock.counters({ unread: 1, fresh: 0 });
        mock.respond(inboxPage({ count: 1, messages: [anna] }));
        await checkMail();
        await checkMail();
        assert.deepEqual(mock.calls.clearedNotifications, [], 'fresh и так был 0');

        mock.counters({ unread: 2, fresh: 1 });
        mock.respond(inboxPage({ count: 2, messages: [vera, anna] }));
        await checkMail();
        mock.counters({ unread: 2, fresh: 0 });
        await checkMail();
        assert.deepEqual(mock.calls.clearedNotifications, ['new-mail']);
        assert.equal(mock.calls.notifications.length, 1);
    });

    test('fresh обнулился и снова вырос между проверками — уведомление о письме после обнуления', async () => {
        mock.counters({ unread: 3, fresh: 0 });
        mock.respond(inboxPage({ count: 3, messages: [anna, ivan] }));
        await checkMail();
        mock.counters({ unread: 3, fresh: 2 });
        mock.respond(inboxPage({ count: 3, messages: [ivan, anna] }));
        await checkMail();
        const before = mock.calls.notifications.length;

        // Зашли в почту (fresh → 0), пришло письмо (fresh → 1) — проверка видит только 2 → 1
        mock.counters({ unread: 4, fresh: 1 });
        mock.respond(inboxPage({ count: 4, messages: [vera, ivan, anna] }));
        await checkMail();
        assert.equal(mock.calls.notifications.length, before + 1);
        assert.equal(mock.calls.notifications.at(-1).title, 'Вера');
        assert.equal(mock.store.local.lastFresh, 1);
    });

    test('fresh уменьшился без новых писем (письмо прочитано) — без уведомления', async () => {
        mock.counters({ unread: 2, fresh: 0 });
        mock.respond(inboxPage({ count: 2, messages: [anna] }));
        await checkMail();
        mock.counters({ unread: 3, fresh: 2 });
        mock.respond(inboxPage({ count: 3, messages: [vera, ivan, anna] }));
        await checkMail();
        const before = mock.calls.notifications.length;

        mock.counters({ unread: 2, fresh: 1 });
        mock.respond(inboxPage({ count: 2, messages: [vera, anna] }));
        await checkMail();
        assert.equal(mock.calls.notifications.length, before);
    });

    test('401 от API — не выполнен вход: «?», без повтора', async () => {
        mock.counters(() => ({ type: 'basic', status: 401, ok: false }));
        await checkMail();
        assert.equal(mock.calls.badge.text, '?');
        assert.equal(mock.alarms.retryCheck, undefined);
        assert.deepEqual(mock.requests, [COUNTERS]);
    });

    test('ошибка сервера API: «!» и повтор, без обращения к lite-версии', async () => {
        mock.counters(() => ({ type: 'basic', status: 502, ok: false }));
        mock.respond(inboxPage({ count: 1 }));
        await checkMail();
        assert.equal(mock.calls.badge.text, '!');
        assert.ok(mock.alarms.retryCheck);
        assert.deepEqual(mock.requests, [COUNTERS]);
    });

    test('API недоступно (404) или ответ другого формата — счётчик из lite-версии', async () => {
        for (const counters of [null, JSON.stringify({ counters: { unread: '4' } }), '{"error":"x"}', '<html>']) {
            mock.reset();
            mock.counters(counters);
            mock.respond(inboxPage({ count: 7 }));
            await checkMail();
            assert.equal(mock.calls.badge.text, '7', JSON.stringify(counters));
            assert.deepEqual(mock.requests, [COUNTERS, INBOX]);
        }
    });

    test('API снова доступно после работы через lite-версию — без ложного уведомления', async () => {
        mock.counters({ unread: 1, fresh: 3 });
        mock.respond(inboxPage({ count: 1, messages: [anna] }));
        await checkMail();
        mock.counters(null);
        await checkMail();
        mock.counters({ unread: 1, fresh: 5 });
        await checkMail();
        assert.equal(mock.calls.notifications.length, 0);
        assert.equal(mock.store.local.lastFresh, 5);
    });
});

describe('API счётчиков недоступно: всё из lite-версии', () => {
    beforeEach(() => mock.counters(null));

    test('первый запуск: счётчик обновлён, уведомлений о старых письмах нет', async () => {
        mock.respond(inboxPage({ count: 2, messages: [anna, ivan] }));
        await checkMail();
        assert.equal(mock.calls.badge.text, '2');
        assert.match(mock.calls.badge.title, /^Яндекс Почта: 2 непрочитанных письма\nПроверено в \d\d:\d\d$/);
        assert.equal(mock.calls.notifications.length, 0);
    });

    test('та же страница повторно — без уведомлений', async () => {
        mock.respond(inboxPage({ count: 1, messages: [anna] }));
        await checkMail();
        await checkMail();
        assert.equal(mock.calls.notifications.length, 0);
    });

    test('прочитал одно, пришло одно: счётчик тот же, но уведомление есть и ведёт к письму', async () => {
        mock.respond(inboxPage({ count: 1, messages: [anna] }));
        await checkMail();
        mock.respond(inboxPage({ count: 1, messages: [ivan] }));
        await checkMail();

        assert.equal(mock.calls.notifications.length, 1);
        const [n] = mock.calls.notifications;
        assert.equal(n.type, 'basic');
        assert.equal(n.title, 'Иван');
        assert.equal(n.message, 'Отчёт');
        assert.equal(n.iconUrl, 'extension://test/icons/icon128.png');
        assert.equal(mock.store.session.notificationTarget, '#/message/222');
    });

    test('несколько новых писем — уведомление-список, клик ведёт в почту', async () => {
        mock.respond(inboxPage({ count: 0, messages: [] }));
        await checkMail();
        mock.respond(fixture('inbox-unread.html'));
        await checkMail();

        const [n] = mock.calls.notifications;
        assert.equal(n.type, 'list');
        assert.equal(n.title, '3 новых письма');
        assert.deepEqual(
            n.items.map((i) => i.title),
            ['"Рога & Копыта"', 'Иван Смирнов', 'Анна Петрова']
        );
        assert.equal(mock.store.session.notificationTarget, null);
    });

    test('новое письмо в треде ведёт в почту: проверенного адреса треда нет', async () => {
        mock.respond(inboxPage({ count: 0 }));
        await checkMail();
        mock.respond(inboxPage({ count: 1, messages: [{ id: '333', thread: true }] }));
        await checkMail();
        assert.equal(mock.store.session.notificationTarget, null);
    });

    test('уведомления выключены — проверка работает, уведомлений нет', async () => {
        mock.store.local.notificationsEnabled = false;
        mock.respond(inboxPage({ count: 0 }));
        await checkMail();
        mock.respond(inboxPage({ count: 1, messages: [anna] }));
        await checkMail();
        assert.equal(mock.calls.badge.text, '1');
        assert.equal(mock.calls.notifications.length, 0);
    });

    test('капча: «!», понятная подсказка, без быстрого повтора', async () => {
        mock.respond(fixture('captcha.html'));
        await checkMail();
        assert.equal(mock.calls.badge.text, '!');
        assert.equal(mock.calls.badge.title, 'Яндекс Почта: Не удалось прочитать страницу почты');
        assert.equal(mock.alarms.retryCheck, undefined);
    });

    test('не выполнен вход (редирект или страница входа): «?», без повтора', async () => {
        mock.respond(() => ({ type: 'opaqueredirect', status: 0, ok: false }));
        await checkMail();
        assert.equal(mock.calls.badge.text, '?');
        assert.equal(mock.alarms.retryCheck, undefined);

        mock.respond(fixture('login.html'));
        await checkMail();
        assert.equal(mock.calls.badge.text, '?');
    });
});

// Ответы ниже приходят на любой запрос — и к API счётчиков, и к lite-версии
test('ошибка сервера: «!» и повтор', async () => {
    mock.respond(() => ({ type: 'basic', status: 503, ok: false }));
    await checkMail();
    assert.equal(mock.calls.badge.text, '!');
    assert.match(mock.calls.badge.title, /Ошибка сервера Яндекса \(503\)/);
    assert.ok(mock.alarms.retryCheck);
});

test('нет сети: ровно 2 быстрых повтора, затем ждём плановую проверку', async () => {
    mock.respond(new TypeError('Failed to fetch'));
    let retries = 0;
    for (let i = 0; i < 5; i++) {
        delete mock.alarms.retryCheck;
        await checkMail();
        if (mock.alarms.retryCheck) retries++;
    }
    assert.equal(retries, 2);
    assert.equal(mock.calls.badge.title, 'Яндекс Почта: Нет подключения');

    // Успешная проверка сбрасывает счётчик повторов
    mock.respond(inboxPage({ count: 0 }));
    await checkMail();
    assert.equal(mock.store.session.retryCount, 0);
});

test('при ошибке в подсказке остаётся последний успешный результат', async () => {
    mock.respond(inboxPage({ count: 4, messages: [] }));
    await checkMail();
    mock.respond(new TypeError('Failed to fetch'));
    await checkMail();
    assert.match(
        mock.calls.badge.title,
        /^Яндекс Почта: Нет подключения\nПоследняя успешная проверка в \d\d:\d\d: 4 непрочитанных письма$/
    );
});

test('зависший запрос прерывается по таймауту, следующая проверка не блокируется', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    mock.respond(
        (url, { signal }) =>
            new Promise((resolve, reject) => {
                signal.addEventListener('abort', () =>
                    reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
                );
            })
    );
    const pending = checkMail();
    await flush();
    t.mock.timers.tick(20000);
    await pending;
    assert.equal(mock.calls.badge.title, 'Яндекс Почта: Яндекс не ответил вовремя');
    t.mock.timers.reset();

    mock.respond(inboxPage({ count: 5 }));
    await checkMail();
    assert.equal(mock.calls.badge.text, '5');
});

test('ручная проверка показывает «↻»', async () => {
    const badges = [];
    const original = mock.api.action.setBadgeText;
    mock.api.action.setBadgeText = async ({ text }) => badges.push(text);
    mock.respond(inboxPage({ count: 2 }));
    await checkMail({ manual: true });
    mock.api.action.setBadgeText = original;
    assert.deepEqual(badges, ['↻', '2']);
});

test('ошибка в коде расширения не выдаётся за «нет сети»', async () => {
    const errors = nodeMock.method(console, 'error', () => {});
    const original = mock.api.storage.local.get;
    let thrown = false;
    mock.api.storage.local.get = async (keys) => {
        if (thrown) return original(keys);
        thrown = true;
        throw new Error('boom');
    };
    mock.respond(inboxPage({ count: 1 }));
    await checkMail();
    mock.api.storage.local.get = original;
    errors.mock.restore();
    assert.equal(mock.calls.badge.title.split('\n')[0], 'Яндекс Почта: Внутренняя ошибка расширения');
    assert.equal(errors.mock.callCount(), 1);
});

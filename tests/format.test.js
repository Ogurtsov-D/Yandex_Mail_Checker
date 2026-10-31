// Тексты бейджа и подсказки на русском
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installBrowserMock } from './helpers/browser-mock.js';

installBrowserMock({ locale: 'ru' });
const { badgeText, errorText, formatCheckTime, newMailTitle, tooltipText, unreadText } =
    await import('../src/format.js');
const { plural } = await import('../src/i18n.js');

test('склонение по правилам русского языка', () => {
    assert.deepEqual(
        [1, 2, 5, 11, 12, 21, 22, 25, 101, 111].map((n) => plural('minutes', n)),
        [
            '1 минута',
            '2 минуты',
            '5 минут',
            '11 минут',
            '12 минут',
            '21 минута',
            '22 минуты',
            '25 минут',
            '101 минута',
            '111 минут'
        ]
    );
    assert.equal(newMailTitle(3), '3 новых письма');
    assert.equal(newMailTitle(5), '5 новых писем');
    assert.equal(unreadText(1), '1 непрочитанное письмо');
    assert.equal(unreadText(0), 'новых писем нет');
});

test('время проверки: сегодня, вчера, раньше', () => {
    const now = new Date(2026, 9, 31, 15, 0).getTime();
    assert.equal(formatCheckTime(new Date(2026, 9, 31, 9, 5).getTime(), now), 'в 09:05');
    assert.equal(formatCheckTime(new Date(2026, 9, 30, 23, 59).getTime(), now), 'вчера в 23:59');
    assert.equal(formatCheckTime(new Date(2026, 9, 28, 14, 32).getTime(), now), '28.10 в 14:32');
});

test('бейдж', () => {
    assert.equal(badgeText({ unreadCount: 0 }), '');
    assert.equal(badgeText({ unreadCount: 7 }), '7');
    assert.equal(badgeText({ unreadCount: 150 }), '99+');
    assert.equal(badgeText({ unreadCount: 7, errorType: 'auth' }), '?');
    assert.equal(badgeText({ unreadCount: 7, errorType: 'network' }), '!');
    assert.equal(badgeText({}), '');
});

test('тексты ошибок по типу и HTTP-коду', () => {
    assert.equal(errorText({ errorType: 'server', errorStatus: 503 }), 'Ошибка сервера Яндекса (503)');
    assert.equal(errorText({ errorType: 'parse' }), 'Не удалось прочитать страницу почты');
    assert.equal(errorText({ errorType: 'client', errorStatus: 404 }), 'Ошибка запроса (404)');
    assert.equal(errorText({ errorType: 'unknown' }), 'Внутренняя ошибка расширения');
});

test('подсказка: успех, ошибка с последним результатом, ничего не известно', () => {
    const now = new Date(2026, 9, 31, 15, 0).getTime();
    const at = new Date(2026, 9, 31, 14, 32).getTime();

    assert.equal(
        tooltipText({ unreadCount: 3, lastSuccess: at }, now),
        'Яндекс Почта: 3 непрочитанных письма\nПроверено в 14:32'
    );
    assert.equal(
        tooltipText({ errorType: 'network', lastSuccess: at, unreadCount: 3 }, now),
        'Яндекс Почта: Нет подключения\nПоследняя успешная проверка в 14:32: 3 непрочитанных письма'
    );
    assert.equal(tooltipText({ errorType: 'auth' }, now), 'Яндекс Почта: Требуется вход в почту');
    assert.equal(tooltipText({}, now), 'Яндекс Почта');
});

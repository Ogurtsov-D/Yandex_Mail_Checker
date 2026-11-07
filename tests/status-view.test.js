// Строка состояния на страницах настроек и приветствия
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installBrowserMock } from './helpers/browser-mock.js';

installBrowserMock();
const { describeStatus } = await import('../src/status-view.js');

test('состояние: успех, ошибка входа, другая ошибка, ещё не проверялась', () => {
    const now = new Date(2026, 9, 31, 15, 0).getTime();
    assert.deepEqual(describeStatus({ unreadCount: 3, lastSuccess: now - 5 * 60_000 }, now), {
        kind: 'ok',
        text: '3 непрочитанных письма · Проверено 5 минут назад'
    });
    assert.deepEqual(describeStatus({ errorType: 'auth' }, now), {
        kind: 'error',
        auth: true,
        text: 'Требуется вход в почту'
    });
    assert.equal(describeStatus({ errorType: 'network', lastSuccess: now }, now).auth, false);
    assert.deepEqual(describeStatus({}, now), { kind: 'none', text: 'Почта ещё не проверялась' });
});

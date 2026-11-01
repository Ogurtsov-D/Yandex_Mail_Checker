// Настройки: значения по умолчанию, тихие часы, разброс времени проверок
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { installBrowserMock } from './helpers/browser-mock.js';

const mock = installBrowserMock();
const { getSettings, isQuietTime, jitteredDelay } = await import('../src/settings.js');

beforeEach(() => mock.reset());

test('настройки по умолчанию и защита от испорченных значений', async () => {
    assert.deepEqual(await getSettings(), {
        interval: 5,
        notificationsEnabled: true,
        soundEnabled: true,
        quietHoursEnabled: false,
        quietFrom: '23:00',
        quietTo: '08:00',
        badgeMode: 'unread',
        pauseWhenIdle: true,
        classicIcon: false,
        disabledAccounts: []
    });
    Object.assign(mock.store.local, { checkInterval: 7, quietFrom: '25:00', quietTo: 'утро', badgeMode: 'all' });
    const s = await getSettings();
    assert.deepEqual([s.interval, s.quietFrom, s.quietTo, s.badgeMode], [5, '23:00', '08:00', 'unread']);
});

test('тихие часы: через полночь, в пределах дня, выключены', () => {
    const at = (time) => new Date(`2026-11-01T${time}:00`);
    const night = { quietHoursEnabled: true, quietFrom: '23:00', quietTo: '08:00' };
    assert.deepEqual(
        ['22:59', '23:00', '03:00', '07:59', '08:00', '12:00'].map((time) => isQuietTime(night, at(time))),
        [false, true, true, true, false, false]
    );
    const lunch = { quietHoursEnabled: true, quietFrom: '13:00', quietTo: '14:00' };
    assert.deepEqual(
        ['12:59', '13:00', '13:59', '14:00'].map((time) => isQuietTime(lunch, at(time))),
        [false, true, true, false]
    );
    assert.equal(isQuietTime({ ...night, quietHoursEnabled: false }, at('03:00')), false);
    assert.equal(isQuietTime({ quietHoursEnabled: true, quietFrom: '10:00', quietTo: '10:00' }, at('10:00')), false);
});

test('разброс времени проверки — в пределах ±12,5% интервала, но не чаще раза в минуту', () => {
    assert.deepEqual(
        [0, 0.5, 1].map((r) => jitteredDelay(8, () => r)),
        [7, 8, 9]
    );
    assert.equal(
        jitteredDelay(1, () => 0),
        1
    );
    for (let i = 0; i < 100; i++) {
        const delay = jitteredDelay(1);
        assert.ok(delay >= 1 && delay <= 1.125);
    }
});

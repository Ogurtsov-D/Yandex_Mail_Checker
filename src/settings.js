// Пользовательские настройки (chrome.storage.local) и расписание автопроверки
import { ext } from './api.js';
import { CHECK_JITTER, DEFAULT_INTERVAL, INTERVALS } from './config.js';

export const CHECK_ALARM = 'checkMail';
export const RETRY_ALARM = 'retryCheck';

// Ключи настроек в storage.local
export const SETTING_KEYS = [
    'checkInterval',
    'notificationsEnabled',
    'soundEnabled',
    'quietHoursEnabled',
    'quietFrom',
    'quietTo',
    'badgeMode',
    'pauseWhenIdle',
    'classicIcon'
];

const DEFAULT_QUIET_FROM = '23:00';
const DEFAULT_QUIET_TO = '08:00';

const isTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export async function getSettings() {
    const s = await ext.storage.local.get(SETTING_KEYS);
    return {
        interval: INTERVALS.includes(s.checkInterval) ? s.checkInterval : DEFAULT_INTERVAL,
        notificationsEnabled: s.notificationsEnabled !== false,
        soundEnabled: s.soundEnabled !== false,
        quietHoursEnabled: s.quietHoursEnabled === true,
        quietFrom: isTime(s.quietFrom) ? s.quietFrom : DEFAULT_QUIET_FROM,
        quietTo: isTime(s.quietTo) ? s.quietTo : DEFAULT_QUIET_TO,
        // unread — все непрочитанные, fresh — только пришедшие после последнего захода в почту
        badgeMode: s.badgeMode === 'fresh' ? 'fresh' : 'unread',
        pauseWhenIdle: s.pauseWhenIdle !== false,
        classicIcon: s.classicIcon === true
    };
}

export async function saveSettings(values) {
    await ext.storage.local.set(values);
}

// Тихие часы: from–to по местному времени, интервал может переходить через полночь (23:00–08:00)
export function isQuietTime({ quietHoursEnabled, quietFrom, quietTo }, date = new Date()) {
    if (!quietHoursEnabled) return false;
    const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const now = date.getHours() * 60 + date.getMinutes();
    const from = minutes(quietFrom);
    const to = minutes(quietTo);
    if (from === to) return false;
    return from < to ? now >= from && now < to : now >= from || now < to;
}

// Интервал до следующей проверки со случайным разбросом ±CHECK_JITTER,
// но не меньше минуты: чаще раза в минуту расширение почту не проверяет (обещано в README)
export function jitteredDelay(interval, random = Math.random) {
    return Math.max(1, interval * (1 + (random() * 2 - 1) * CHECK_JITTER));
}

// Создать будильник автопроверки. reset: true — пересоздать, даже если он уже есть
// (по умолчанию существующий не трогаем, чтобы не сбрасывать отсчёт при перезапуске service worker).
// Первое срабатывание — со случайным разбросом; после каждой плановой проверки будильник
// пересоздаётся с новым разбросом. periodInMinutes — страховка, если пересоздать не удалось
export async function scheduleCheckAlarm({ reset = false } = {}) {
    if (!reset && (await ext.alarms.get(CHECK_ALARM))) return;
    const { interval } = await getSettings();
    await ext.alarms.create(CHECK_ALARM, { delayInMinutes: jitteredDelay(interval), periodInMinutes: interval });
}

export async function setCheckInterval(minutes) {
    await saveSettings({ checkInterval: minutes });
    await scheduleCheckAlarm({ reset: true });
}

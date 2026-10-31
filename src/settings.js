// Пользовательские настройки (chrome.storage.local) и расписание автопроверки
import { ext } from './api.js';
import { DEFAULT_INTERVAL, INTERVALS } from './config.js';

export const CHECK_ALARM = 'checkMail';
export const RETRY_ALARM = 'retryCheck';

export async function getSettings() {
    const { checkInterval, notificationsEnabled } = await ext.storage.local.get([
        'checkInterval',
        'notificationsEnabled'
    ]);
    return {
        interval: INTERVALS.includes(checkInterval) ? checkInterval : DEFAULT_INTERVAL,
        notificationsEnabled: notificationsEnabled !== false
    };
}

// Создать будильник автопроверки. reset: true — пересоздать, даже если он уже есть
// (по умолчанию существующий не трогаем, чтобы не сбрасывать отсчёт при перезапуске service worker)
export async function scheduleCheckAlarm({ reset = false } = {}) {
    if (!reset && (await ext.alarms.get(CHECK_ALARM))) return;
    const { interval } = await getSettings();
    await ext.alarms.create(CHECK_ALARM, { delayInMinutes: interval, periodInMinutes: interval });
}

export async function setCheckInterval(minutes) {
    await ext.storage.local.set({ checkInterval: minutes });
    await scheduleCheckAlarm({ reset: true });
}

export async function setNotificationsEnabled(enabled) {
    await ext.storage.local.set({ notificationsEnabled: enabled });
}

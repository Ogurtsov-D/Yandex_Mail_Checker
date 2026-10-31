// Точка входа service worker (в Firefox — фонового скрипта).
// Все обработчики событий регистрируются синхронно на верхнем уровне: так браузер
// разбудит расширение и доставит событие, даже если service worker был выгружен.
import { ext } from './api.js';
import { checkMail, setLastCheckTime } from './checker.js';
import { createContextMenu, handleMenuClick } from './menu.js';
import { NOTIFICATION_ID, takeNotificationTarget } from './notifications.js';
import { CHECK_ALARM, RETRY_ALARM, scheduleCheckAlarm } from './settings.js';
import { loadState, renderStatus } from './status.js';
import { handleTabRemoved, handleTabUpdated, openMail } from './tabs.js';

// Восстановить бейдж и подсказку после перезапуска service worker
async function restore() {
    await scheduleCheckAlarm();
    const state = await loadState();
    setLastCheckTime(state.lastCheck);
    if (state.lastCheck) await renderStatus(state);
}

// Установка или обновление расширения
ext.runtime.onInstalled.addListener(async () => {
    await ext.alarms.clearAll(); // убирает и будильники старых версий
    await scheduleCheckAlarm({ reset: true });
    await createContextMenu();
    await checkMail();
});

// Запуск браузера
ext.runtime.onStartup.addListener(async () => {
    // Firefox не всегда сохраняет пункты меню между запусками — пересоздаём
    await createContextMenu();
    await checkMail();
});

ext.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CHECK_ALARM || alarm.name === RETRY_ALARM) checkMail();
});

ext.contextMenus.onClicked.addListener(handleMenuClick);

// Левый клик по иконке — открыть почту или переключиться на открытую вкладку
ext.action.onClicked.addListener(() => openMail());

// Клик по уведомлению — открыть письмо (или почту, если писем несколько)
ext.notifications.onClicked.addListener(async (notificationId) => {
    if (notificationId !== NOTIFICATION_ID) return;
    const target = await takeNotificationTarget();
    await ext.notifications.clear(NOTIFICATION_ID);
    await openMail(target);
});

ext.tabs.onUpdated.addListener(handleTabUpdated);
ext.tabs.onRemoved.addListener(handleTabRemoved);

restore();

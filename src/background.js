// Точка входа service worker (в Firefox — фонового скрипта).
// Все обработчики событий регистрируются синхронно на верхнем уровне: так браузер
// разбудит расширение и доставит событие, даже если service worker был выгружен.
import { ext } from './api.js';
import { checkMail, isCheckInProgress, setLastCheckTime } from './checker.js';
import { IDLE_THRESHOLD_SEC } from './config.js';
import { handleIdleStateChanged, isAway, markMissedCheck } from './idle.js';
import { createContextMenu, handleMenuClick } from './menu.js';
import { getNotificationTarget, isMailNotification } from './notifications.js';
import {
    CHECK_ALARM,
    RETRY_ALARM,
    scheduleCheckAlarm,
    scheduleTooltipAlarm,
    SETTING_KEYS,
    TOOLTIP_ALARM
} from './settings.js';
import { loadState, renderStatus } from './status.js';
import { handleTabRemoved, handleTabUpdated, openMail } from './tabs.js';

// Восстановить бейдж и подсказку после перезапуска service worker
async function restore() {
    await scheduleCheckAlarm();
    await scheduleTooltipAlarm();
    const state = await loadState();
    setLastCheckTime(state.lastCheck);
    await renderStatus(state);
}

// Установка или обновление расширения. При первой установке — страница приветствия
// (при обновлениях не показываем ничего)
ext.runtime.onInstalled.addListener(async (details) => {
    if (details?.reason === 'install') await ext.tabs.create({ url: ext.runtime.getURL('src/welcome.html') });
    await ext.alarms.clearAll(); // расписание с нуля: в новой версии оно могло измениться
    await scheduleCheckAlarm({ reset: true });
    await scheduleTooltipAlarm();
    await createContextMenu();
    await checkMail();
});

// Запуск браузера
ext.runtime.onStartup.addListener(async () => {
    // Firefox не всегда сохраняет пункты меню между запусками — пересоздаём
    await createContextMenu();
    await checkMail();
});

ext.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === TOOLTIP_ALARM) {
        // «Проверено N минут назад» — пересчитать по сохранённому состоянию
        if (!isCheckInProgress()) await renderStatus(await loadState());
    } else if (alarm.name === RETRY_ALARM) {
        await checkMail();
    } else if (alarm.name === CHECK_ALARM) {
        await scheduleCheckAlarm({ reset: true }); // следующая проверка — с новым случайным разбросом
        if (await isAway()) await markMissedCheck();
        else await checkMail();
    }
});

ext.contextMenus.onClicked.addListener(handleMenuClick);

// Команды со страниц расширения (настройки, приветствие): проверить почту, открыть почту.
// Ответ — после выполнения, чтобы страница могла обновить состояние
ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== ext.runtime.id) return false;
    const action =
        message?.type === 'checkNow'
            ? () => checkMail({ manual: true })
            : message?.type === 'openMail'
              ? () => openMail()
              : null;
    if (!action) return false;
    action().then(
        () => sendResponse(true),
        () => sendResponse(false)
    );
    return true;
});

// Изменились настройки (в меню или на странице настроек) — обновить меню и иконку
ext.storage.onChanged.addListener(async (changes, area) => {
    // accountList меняется, когда вошли в другой аккаунт или вышли из него
    if (area !== 'local' || ![...SETTING_KEYS, 'accountList', 'accountEmails'].some((key) => key in changes)) return;
    await createContextMenu();
    // Сменили домен почты — сразу проверить почту на новом; сменили имена или набор
    // учитываемых аккаунтов — пересчитать значок, подсказку и список в меню
    // Пришли адреса аккаунтов — тоже: подписи берутся из них
    if (['mailHost', 'accountNames', 'disabledAccounts', 'accountEmails'].some((key) => key in changes)) {
        await checkMail();
    } else await renderStatus(await loadState());
});

// Левый клик по иконке или горячая клавиша (Alt+Shift+Y) — открыть почту или переключиться на открытую вкладку
ext.action.onClicked.addListener(() => openMail());

// Клик по уведомлению — открыть письмо (или почту, если писем несколько) в нужном аккаунте
ext.notifications.onClicked.addListener(async (notificationId) => {
    if (!isMailNotification(notificationId)) return;
    const { hash, uid } = await getNotificationTarget(notificationId);
    await ext.notifications.clear(notificationId);
    await openMail(hash, uid);
});

ext.tabs.onUpdated.addListener(handleTabUpdated);
ext.tabs.onRemoved.addListener(handleTabRemoved);

// Вернулись к компьютеру — проверить почту, если плановая проверка была пропущена
if (ext.idle) {
    ext.idle.setDetectionInterval(IDLE_THRESHOLD_SEC);
    ext.idle.onStateChanged.addListener(handleIdleStateChanged);
}

restore();

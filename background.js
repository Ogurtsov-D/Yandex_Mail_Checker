const DEFAULT_INTERVAL = 5; // минут по умолчанию
const RETRY_INTERVAL_SEC = 30; // секунд между ретраями при ошибке
const MAX_RETRIES = 2; // сколько быстрых ретраев перед переходом на 5-минутный интервал

let isChecking = false;
let retryCount = 0;
let lastCheckTime = null;

// Функция для проверки почты
async function checkYandexMail(isManualCheck = false) {
    if (isChecking) return;
    isChecking = true;

    if (isManualCheck) {
        showLoadingIndicator();
    }

    try {
        const response = await fetch('https://mail.yandex.ru/lite/inbox', {
            method: 'GET',
            credentials: 'include',
            redirect: 'manual'
        });

        // redirect: 'manual' превращает редирект в opaqueredirect (type = 'opaqueredirect', status = 0)
        if (response.type === 'opaqueredirect' || response.status === 0) {
            throw { type: 'auth', message: 'Требуется авторизация' };
        }

        if (!response.ok) {
            const status = response.status;
            if (status >= 500) {
                throw { type: 'server', message: `Ошибка сервера Яндекс (${status})` };
            } else if (status >= 400) {
                throw { type: 'client', message: `Ошибка запроса (${status})` };
            }
            throw { type: 'http', message: `HTTP ${status}` };
        }

        // Проверяем, не вернули ли страницу логина вместо почты
        const html = await response.text();
        if (html.includes('passport.yandex.ru') && !html.includes('b-messages')) {
            throw { type: 'auth', message: 'Требуется авторизация' };
        }

        const count = parseUnreadCount(html);
        const newMessages = parseNewMessages(html);

        // Получаем предыдущее значение для сравнения
        const prev = await chrome.storage.local.get(['unreadCount', 'knownMessageIds']);
        const prevCount = prev.unreadCount ?? 0;
        const knownIds = new Set(prev.knownMessageIds ?? []);

        // Уведомление если появились новые письма
        if (count > 0 && count > prevCount) {
            const unseen = newMessages.filter(m => !knownIds.has(m.id));
            await showNotification(count, prevCount, unseen);
        }

        // Запоминаем ID показанных писем (храним последние 100)
        const allIds = [...new Set([...knownIds, ...newMessages.map(m => m.id)])].slice(-100);

        retryCount = 0; // сбрасываем счётчик ретраев при успехе
        lastCheckTime = Date.now();

        updateBadge(count);
        updateTooltip();

        await chrome.storage.local.set({
            unreadCount: count,
            lastCheck: lastCheckTime,
            lastError: null,
            errorType: null,
            knownMessageIds: allIds
        });

    } catch (error) {
        console.error('Error checking mail:', error);

        const errorType = error.type || 'network';
        const errorMessage = error.message || 'Нет подключения';

        lastCheckTime = Date.now();

        if (errorType === 'auth') {
            // Авторизация — не ретраим, показываем сразу
            retryCount = 0;
            updateBadge(-1, 'auth');
            updateTooltip(errorMessage);
        } else {
            // Сетевая/серверная ошибка — ретрай
            retryCount++;
            updateBadge(-1, 'error');
            updateTooltip(errorMessage);

            if (retryCount <= MAX_RETRIES) {
                // Быстрый ретрай через 30 секунд
                chrome.alarms.create('retryCheck', { delayInMinutes: RETRY_INTERVAL_SEC / 60 });
            }
            // После MAX_RETRIES — просто ждём следующий штатный цикл (5 мин)
        }

        await chrome.storage.local.set({
            unreadCount: -1,
            lastCheck: lastCheckTime,
            lastError: errorMessage,
            errorType: errorType
        });
    } finally {
        isChecking = false;
    }
}

// Парсинг непрочитанных писем (отправитель, тема) из lite HTML
function parseNewMessages(html) {
    const messages = [];

    // Разбиваем HTML по началу каждого блока письма, затем фильтруем непрочитанные
    const blocks = html.split(/<div class="b-messages__message\b/);

    for (const block of blocks) {
        // Только непрочитанные
        if (!block.includes('b-messages__message_unread')) continue;

        // ID: value="192247409093380563" или value="192247409093380553:3" (тред)
        const idMatch = block.match(/name="(?:ids|tids)"[^>]*value="([^"]+)"/);
        const id = idMatch ? idMatch[1].split(':')[0] : '';

        // Отправитель: span.b-messages__from__text > span.b-messages__from__text
        const fromMatch = block.match(/class="b-messages__from__text"[^>]*><span class="b-messages__from__text">([^<]+)<\/span>/);
        const from = fromMatch ? fromMatch[1].trim() : '';

        // Тема: span.b-messages__subject"><span>...</span>
        const subjMatch = block.match(/class="b-messages__subject"><span>([^<]+)<\/span>/);
        const subject = subjMatch ? subjMatch[1].trim() : '';

        if (id) {
            messages.push({ id, from, subject });
        }
    }

    return messages;
}

// Уведомление о новых письмах
async function showNotification(count, prevCount, unseenMessages) {
    const settings = await chrome.storage.local.get(['notificationsEnabled']);
    if (settings.notificationsEnabled === false) return;

    const newCount = count - Math.max(prevCount, 0);

    // Если удалось распарсить конкретные письма — показываем отправителя и тему
    if (unseenMessages.length > 0) {
        // Показываем до 3 последних писем
        const toShow = unseenMessages.slice(0, 3);

        if (toShow.length === 1) {
            const m = toShow[0];
            chrome.notifications.create('new-mail', {
                type: 'basic',
                iconUrl: 'icon128.png',
                title: m.from || 'Новое письмо',
                message: m.subject || '(без темы)',
                priority: 1
            });
        } else {
            const items = toShow.map(m => ({
                title: m.from || 'Отправитель',
                message: m.subject || '(без темы)'
            }));
            chrome.notifications.create('new-mail', {
                type: 'list',
                iconUrl: 'icon128.png',
                title: `${newCount} ${pluralize(newCount, 'новое письмо', 'новых письма', 'новых писем')}`,
                message: '',
                items: items,
                priority: 1
            });
        }
    } else {
        // Fallback: не удалось распарсить детали
        const message = `${newCount} ${pluralize(newCount, 'новое письмо', 'новых письма', 'новых писем')}`;
        chrome.notifications.create('new-mail', {
            type: 'basic',
            iconUrl: 'icon128.png',
            title: message,
            message: 'Откройте почту для просмотра',
            priority: 1
        });
    }
}

// Склонение слов
function pluralize(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
}

// Клик по уведомлению — открыть почту
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === 'new-mail') {
        chrome.tabs.create({ url: 'https://mail.yandex.ru' });
        chrome.notifications.clear('new-mail');
    }
});

// Показываем индикатор загрузки
function showLoadingIndicator() {
    chrome.action.setBadgeText({ text: '↻' });
    chrome.action.setBadgeBackgroundColor({ color: '#d14836' });
    chrome.action.setTitle({ title: 'Проверка почты...' });
}

// Обновление бейджа на иконке
function updateBadge(count, errorType) {
    let text = '';
    let color = '#d14836'; // красный по умолчанию

    if (count > 0) {
        text = count > 99 ? '99+' : count.toString();
    } else if (count === 0) {
        text = '';
    } else if (errorType === 'auth') {
        text = '?';
        color = '#d14836'; // красный — требуется авторизация
    } else {
        text = '!';
        color = '#d14836'; // красный — ошибка сети/сервера
    }

    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
}

// Обновление подсказки с временем последней проверки
function updateTooltip(errorMessage) {
    let tooltip = 'Яндекс.Почта';

    if (errorMessage) {
        tooltip += ` — ${errorMessage}`;
    }

    if (lastCheckTime) {
        tooltip += ` (${formatTimeAgo(lastCheckTime)})`;
    }

    chrome.action.setTitle({ title: tooltip });
}

// Форматирование "N минут назад"
function formatTimeAgo(timestamp) {
    const diff = Math.floor((Date.now() - timestamp) / 1000);

    if (diff < 60) return 'только что';
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes} ${pluralize(minutes, 'минуту', 'минуты', 'минут')} назад`;
    const hours = Math.floor(minutes / 60);
    return `${hours} ${pluralize(hours, 'час', 'часа', 'часов')} назад`;
}

// Парсинг количества непрочитанных писем
function parseUnreadCount(html) {
    try {
        // Извлекаем title для логирования
        const titleTag = html.match(/<title>([^<]*)<\/title>/);
        console.log('Page title:', titleTag ? titleTag[1] : 'not found');

        // Метод 1: Поиск в <title> — "Входящие (47 новых писем)"
        const titleRegex = /<title>[^\(]*Входящие[^\(]*\((\d+)[^\)]*нов/;
        const titleMatch = html.match(titleRegex);
        if (titleMatch && titleMatch[1]) {
            const count = parseInt(titleMatch[1], 10);
            console.log('Method 1 (title):', count);
            return isNaN(count) ? 0 : Math.max(0, count);
        }

        // Метод 2: data-key="inbox" с data-count
        const inboxRegex = /data-key="inbox"[^>]*data-count="(\d+)"/;
        const inboxMatch = html.match(inboxRegex);
        if (inboxMatch && inboxMatch[1]) {
            const count = parseInt(inboxMatch[1], 10);
            console.log('Method 2 (data-key):', count);
            return isNaN(count) ? 0 : Math.max(0, count);
        }

        // Метод 3: Счётчик из aria-label ссылки "Входящие"
        const ariaRegex = /href="\/lite\/inbox"[^>]*aria-label="Входящие,\s*(\d+)\s*нов/;
        const ariaMatch = html.match(ariaRegex);
        if (ariaMatch && ariaMatch[1]) {
            const count = parseInt(ariaMatch[1], 10);
            console.log('Method 3 (aria-label):', count);
            return isNaN(count) ? 0 : Math.max(0, count);
        }

        console.log('No method matched, returning 0');
        return 0;
    } catch (error) {
        console.error('Error parsing HTML:', error);
        return -1;
    }
}

// Создание контекстного меню
async function createContextMenu() {
    const settings = await chrome.storage.local.get(['notificationsEnabled', 'checkInterval']);
    const notifEnabled = settings.notificationsEnabled !== false;
    const currentInterval = settings.checkInterval || DEFAULT_INTERVAL;

    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "check-now",
            title: "Проверить сейчас",
            contexts: ["action"]
        });

        chrome.contextMenus.create({
            id: "separator-1",
            type: "separator",
            contexts: ["action"]
        });

        // Подменю интервала
        chrome.contextMenus.create({
            id: "interval",
            title: "Интервал проверки",
            contexts: ["action"]
        });

        const intervals = [
            { id: "interval-1", value: 1, label: "1 минута" },
            { id: "interval-5", value: 5, label: "5 минут" },
            { id: "interval-15", value: 15, label: "15 минут" },
            { id: "interval-30", value: 30, label: "30 минут" }
        ];

        for (const item of intervals) {
            const mark = item.value === currentInterval ? " ✓" : "";
            chrome.contextMenus.create({
                id: item.id,
                parentId: "interval",
                title: item.label + mark,
                contexts: ["action"]
            });
        }

        chrome.contextMenus.create({
            id: "separator-2",
            type: "separator",
            contexts: ["action"]
        });

        chrome.contextMenus.create({
            id: "toggle-notifications",
            title: notifEnabled ? "🔔 Уведомления (выключить)" : "🔕 Уведомления (включить)",
            contexts: ["action"]
        });
    });
}

// Обновить текст пункта меню уведомлений
function updateNotificationMenuItem(enabled) {
    chrome.contextMenus.update("toggle-notifications", {
        title: enabled ? "🔔 Уведомления (выключить)" : "🔕 Уведомления (включить)"
    });
}

// Обновить галочки в подменю интервалов
function updateIntervalMenuItems(selectedValue) {
    const intervals = [
        { id: "interval-1", value: 1, label: "1 минута" },
        { id: "interval-5", value: 5, label: "5 минут" },
        { id: "interval-15", value: 15, label: "15 минут" },
        { id: "interval-30", value: 30, label: "30 минут" }
    ];

    for (const item of intervals) {
        const mark = item.value === selectedValue ? " ✓" : "";
        chrome.contextMenus.update(item.id, { title: item.label + mark });
    }
}

// Обработчик контекстного меню
chrome.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId === "check-now") {
        checkYandexMail(true);
    } else if (info.menuItemId === "toggle-notifications") {
        const settings = await chrome.storage.local.get(['notificationsEnabled']);
        const current = settings.notificationsEnabled !== false;
        const newValue = !current;
        await chrome.storage.local.set({ notificationsEnabled: newValue });
        updateNotificationMenuItem(newValue);
    } else if (info.menuItemId.startsWith("interval-")) {
        const value = parseInt(info.menuItemId.replace("interval-", ""), 10);
        await chrome.storage.local.set({ checkInterval: value });
        // Пересоздаём аларм с новым интервалом
        chrome.alarms.create('checkMail', { periodInMinutes: value });
        updateIntervalMenuItems(value);
    }
});

// Инициализация аларма и восстановление состояния
async function initAlarm() {
    const result = await chrome.storage.local.get(['unreadCount', 'lastError', 'errorType', 'lastCheck', 'checkInterval']);
    const interval = result.checkInterval || DEFAULT_INTERVAL;

    chrome.alarms.create('checkMail', {
        periodInMinutes: interval
    });

    lastCheckTime = result.lastCheck || null;

    if (result.unreadCount !== undefined) {
        updateBadge(result.unreadCount, result.errorType);

        if (result.lastError) {
            updateTooltip(result.lastError);
        } else {
            updateTooltip();
        }
    }
}

// Периодическое обновление tooltip (время "N минут назад" устаревает)
chrome.alarms.create('updateTooltip', { periodInMinutes: 1 });

// Обработчик алармов
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkMail') {
        checkYandexMail(false);
    } else if (alarm.name === 'retryCheck') {
        checkYandexMail(false);
    } else if (alarm.name === 'updateTooltip') {
        // Обновляем tooltip чтобы "N минут назад" было актуальным
        chrome.storage.local.get(['lastError'], (result) => {
            updateTooltip(result.lastError || undefined);
        });
    }
});

// Установка расширения
chrome.runtime.onInstalled.addListener(() => {
    createContextMenu();
    initAlarm();
    chrome.storage.local.get(['notificationsEnabled'], (result) => {
        if (result.notificationsEnabled === undefined) {
            chrome.storage.local.set({ notificationsEnabled: true });
        }
    });
    checkYandexMail(false);
});

// Запуск браузера
chrome.runtime.onStartup.addListener(() => {
    initAlarm();
    checkYandexMail(false);
});

// Левый клик по иконке — открыть почту
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'https://mail.yandex.ru' });
});

// Инициализация при загрузке service worker (восстановление после выгрузки)
initAlarm();

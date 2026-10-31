const INBOX_URL = 'https://mail.yandex.ru/lite/inbox';
const DEFAULT_INTERVAL = 5; // минут по умолчанию
const RETRY_INTERVAL_SEC = 30; // секунд между ретраями при ошибке
const MAX_RETRIES = 2; // сколько быстрых ретраев перед переходом на штатный интервал
const FETCH_TIMEOUT_MS = 20000; // таймаут запроса к Яндексу
const MAX_KNOWN_IDS = 100; // сколько ID писем помнить для дедупликации уведомлений

// Ошибки, при которых быстрый ретрай бессмысленен (нужно действие пользователя или Яндекса)
const NO_RETRY_ERRORS = new Set(['auth', 'parse']);

let isChecking = false;
let lastCheckTime = null;

// Счётчик ретраев хранится в storage.session: service worker выгружается между
// ретраями, и переменная в памяти обнулялась бы, давая бесконечные повторы.
async function getRetryCount() {
    const { retryCount } = await chrome.storage.session.get('retryCount');
    return retryCount ?? 0;
}

async function setRetryCount(value) {
    await chrome.storage.session.set({ retryCount: value });
}

// Загрузка lite-версии входящих с таймаутом
async function fetchInboxHtml() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(INBOX_URL, {
            method: 'GET',
            credentials: 'include',
            redirect: 'manual',
            cache: 'no-store',
            signal: controller.signal
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

        return await response.text();
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw { type: 'timeout', message: 'Яндекс не ответил вовремя' };
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

// Функция для проверки почты
async function checkYandexMail(isManualCheck = false) {
    if (isChecking) return;
    isChecking = true;

    if (isManualCheck) {
        showLoadingIndicator();
    }

    try {
        const html = await fetchInboxHtml();

        // Проверяем, не вернули ли страницу логина вместо почты
        if (html.includes('passport.yandex.ru') && !html.includes('b-messages')) {
            throw { type: 'auth', message: 'Требуется авторизация' };
        }

        const newMessages = parseNewMessages(html);
        const count = parseUnreadCount(html, newMessages);
        if (count === null) {
            // Капча, изменившаяся вёрстка и т.п. — не выдаём это за «0 писем»
            throw { type: 'parse', message: 'Не удалось прочитать страницу почты' };
        }

        const prev = await chrome.storage.local.get(['unreadCount', 'lastGoodCount', 'knownMessageIds']);
        // Первый запуск: запоминаем текущие письма, не засыпая пользователя уведомлениями о старых
        const isFirstRun = prev.knownMessageIds === undefined;
        const knownIds = new Set(prev.knownMessageIds ?? []);
        const prevCount = prev.lastGoodCount ?? Math.max(prev.unreadCount ?? 0, 0);

        if (!isFirstRun) {
            // Новые письма определяем по ID, а не по росту счётчика:
            // «прочитал одно + пришло одно» не меняет счётчик, но письмо новое.
            const unseen = newMessages.filter(m => !knownIds.has(m.id));
            if (unseen.length > 0) {
                await showNotification(unseen);
            } else if (newMessages.length === 0 && count > prevCount) {
                // Детали писем распарсить не удалось — уведомляем хотя бы о количестве
                await showCountNotification(count - prevCount);
            }
        }

        // Запоминаем ID показанных писем (храним последние MAX_KNOWN_IDS)
        const allIds = [...new Set([...knownIds, ...newMessages.map(m => m.id)])].slice(-MAX_KNOWN_IDS);

        await setRetryCount(0); // сбрасываем счётчик ретраев при успехе
        lastCheckTime = Date.now();

        updateBadge(count);
        updateTooltip();

        await chrome.storage.local.set({
            unreadCount: count,
            lastGoodCount: count,
            lastCheck: lastCheckTime,
            lastError: null,
            errorType: null,
            knownMessageIds: allIds
        });

    } catch (error) {
        console.error('Error checking mail:', error);

        // Ошибки без type — это исключения fetch (TypeError: Failed to fetch), т.е. нет сети
        const errorType = error?.type || 'network';
        const errorMessage = error?.type ? error.message : 'Нет подключения';

        lastCheckTime = Date.now();

        updateBadge(-1, errorType);
        updateTooltip(errorMessage);

        if (NO_RETRY_ERRORS.has(errorType)) {
            await setRetryCount(0);
        } else {
            // Сетевая/серверная ошибка — ретрай
            const retryCount = (await getRetryCount()) + 1;
            await setRetryCount(retryCount);

            if (retryCount <= MAX_RETRIES) {
                // Быстрый ретрай через 30 секунд
                chrome.alarms.create('retryCheck', { delayInMinutes: RETRY_INTERVAL_SEC / 60 });
            }
            // После MAX_RETRIES — просто ждём следующий штатный цикл
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
        const fromMatch = block.match(/class="b-messages__from__text"[^>]*><span class="b-messages__from__text">([\s\S]*?)<\/span>/);
        const from = fromMatch ? cleanHtmlText(fromMatch[1]) : '';

        // Тема: span.b-messages__subject"><span>...</span>
        const subjMatch = block.match(/class="b-messages__subject"><span>([\s\S]*?)<\/span>/);
        const subject = subjMatch ? cleanHtmlText(subjMatch[1]) : '';

        if (id) {
            messages.push({ id, from, subject });
        }
    }

    return messages;
}

const NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…', copy: '©', reg: '®'
};

// Декодирование HTML-сущностей (&quot;, &amp;, &#39;, &#x2014; …).
// В service worker нет DOMParser, поэтому делаем это вручную.
function decodeHtmlEntities(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
        if (entity[0] === '#') {
            const isHex = entity[1] === 'x' || entity[1] === 'X';
            const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
            try {
                return String.fromCodePoint(code);
            } catch {
                return match;
            }
        }
        return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    });
}

// Текст из фрагмента HTML: убираем теги, декодируем сущности, схлопываем пробелы
function cleanHtmlText(fragment) {
    return decodeHtmlEntities(fragment.replace(/<[^>]*>/g, ''))
        .replace(/\s+/g, ' ')
        .trim();
}

function newMailTitle(n) {
    return `${n} ${pluralize(n, 'новое письмо', 'новых письма', 'новых писем')}`;
}

// Уведомление о новых письмах (с отправителем и темой)
async function showNotification(unseenMessages) {
    const settings = await chrome.storage.local.get(['notificationsEnabled']);
    if (settings.notificationsEnabled === false) return;

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
            title: newMailTitle(unseenMessages.length),
            message: '',
            items: items,
            priority: 1
        });
    }
}

// Fallback-уведомление, когда детали писем распарсить не удалось
async function showCountNotification(newCount) {
    const settings = await chrome.storage.local.get(['notificationsEnabled']);
    if (settings.notificationsEnabled === false) return;

    chrome.notifications.create('new-mail', {
        type: 'basic',
        iconUrl: 'icon128.png',
        title: newMailTitle(newCount),
        message: 'Откройте почту для просмотра',
        priority: 1
    });
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

// Похоже ли это на страницу входящих lite-версии (а не капчу/заглушку/другую вёрстку)
function isLiteInboxPage(html) {
    return html.includes('b-messages') || html.includes('href="/lite/inbox"');
}

// Парсинг количества непрочитанных писем.
// Возвращает число или null, если страницу распознать не удалось.
function parseUnreadCount(html, parsedMessages = []) {
    const titleTag = html.match(/<title>([^<]*)<\/title>/);
    console.log('Page title:', titleTag ? titleTag[1] : 'not found');

    // Метод 1: число в скобках в <title> — "Входящие (47 новых писем)", "Inbox (47 new)".
    // Не завязываемся на слово «Входящие», чтобы работало при любом языке интерфейса.
    const titleMatch = html.match(/<title>[^<(]*\((\d+)[^)<]*\)/);
    if (titleMatch) {
        console.log('Method 1 (title):', titleMatch[1]);
        return parseInt(titleMatch[1], 10);
    }

    // Метод 2: data-key="inbox" с data-count
    const inboxMatch = html.match(/data-key="inbox"[^>]*data-count="(\d+)"/);
    if (inboxMatch) {
        console.log('Method 2 (data-key):', inboxMatch[1]);
        return parseInt(inboxMatch[1], 10);
    }

    // Метод 3: счётчик из aria-label ссылки "Входящие"
    const ariaMatch = html.match(/href="\/lite\/inbox"[^>]*aria-label="Входящие,\s*(\d+)\s*нов/);
    if (ariaMatch) {
        console.log('Method 3 (aria-label):', ariaMatch[1]);
        return parseInt(ariaMatch[1], 10);
    }

    // Метод 4: считаем непрочитанные письма на первой странице списка
    if (parsedMessages.length > 0) {
        console.log('Method 4 (unread blocks):', parsedMessages.length);
        return parsedMessages.length;
    }

    // Страница входящих распознана, но непрочитанных нет — это честный ноль
    if (isLiteInboxPage(html)) {
        console.log('Inbox page without unread messages');
        return 0;
    }

    console.warn('Unrecognized page, cannot determine unread count');
    return null;
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
        // Пересоздаём аларм с новым интервалом (принудительно)
        await chrome.alarms.clear('checkMail');
        chrome.alarms.create('checkMail', {
            delayInMinutes: value,
            periodInMinutes: value
        });
        updateIntervalMenuItems(value);
    }
});

// Инициализация аларма и восстановление состояния
async function initAlarm() {
    const result = await chrome.storage.local.get(['unreadCount', 'lastError', 'errorType', 'lastCheck', 'checkInterval']);
    const interval = result.checkInterval || DEFAULT_INTERVAL;

    // Проверяем, существует ли уже аларм — не пересоздаём, чтобы не сбрасывать таймер
    const existing = await chrome.alarms.get('checkMail');
    if (!existing) {
        chrome.alarms.create('checkMail', {
            delayInMinutes: interval,
            periodInMinutes: interval
        });
    }

    const existingTooltip = await chrome.alarms.get('updateTooltip');
    if (!existingTooltip) {
        chrome.alarms.create('updateTooltip', {
            delayInMinutes: 1,
            periodInMinutes: 1
        });
    }

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

// Установка/обновление расширения — принудительно пересоздаём алармы
chrome.runtime.onInstalled.addListener(async () => {
    createContextMenu();
    // При установке/обновлении — сбрасываем алармы и создаём заново
    await chrome.alarms.clearAll();
    const result = await chrome.storage.local.get(['checkInterval']);
    const interval = result.checkInterval || DEFAULT_INTERVAL;
    chrome.alarms.create('checkMail', {
        delayInMinutes: interval,
        periodInMinutes: interval
    });
    chrome.alarms.create('updateTooltip', {
        delayInMinutes: 1,
        periodInMinutes: 1
    });
    chrome.storage.local.get(['notificationsEnabled'], (r) => {
        if (r.notificationsEnabled === undefined) {
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

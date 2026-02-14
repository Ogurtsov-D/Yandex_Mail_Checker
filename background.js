const CHECK_INTERVAL = 5; // минут. Если надо 30 секунд, то 0.5 

let unreadCount = 0;
let isChecking = false;
let lastError = null;

// Функция для проверки почты
async function checkYandexMail(isManualCheck = false) {
    if (isChecking) return;
    isChecking = true;

    // Для принудительной проверки показываем индикатор загрузки
    if (isManualCheck) {
        showLoadingIndicator();
    }

    try {
        const response = await fetch('https://mail.yandex.ru/lite/inbox', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const count = parseUnreadCount(html);
        
        unreadCount = count;
        lastError = null; // Сбрасываем ошибку при успехе
        
        updateBadge(count);
        updateTooltip("Яндекс.Почта"); // Статичная подсказка при успехе
        
        // Сохраняем в storage
        await chrome.storage.local.set({ 
            unreadCount: count, 
            lastCheck: Date.now(),
            lastError: null
        });
        
    } catch (error) {
        console.error('Error checking mail:', error);
        unreadCount = -1;
        lastError = error.message;
        
        updateBadge(-1);
        updateTooltip(`Ошибка: ${error.message}`);
        
        await chrome.storage.local.set({ 
            unreadCount: -1, 
            lastCheck: Date.now(),
            lastError: error.message
        });
    } finally {
        isChecking = false;
    }
}

// Показываем индикатор загрузки
function showLoadingIndicator() {
    chrome.action.setBadgeText({ text: '↻' });
    chrome.action.setBadgeBackgroundColor({ color: '#d14836' }); // Оставляем стандартный цвет
    updateTooltip("Проверка почты...");
}

// Обновление бейджа на иконке
function updateBadge(count) {
    let text = '';
    let color = '#d14836'; // Стандартный цвет
    
    if (count > 0) {
        text = count > 99 ? '99+' : count.toString();
    } else if (count === -1) {
        text = '!';
    } else {
        text = '';
    }
    
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: color });
}

// Обновление подсказки
function updateTooltip(tooltipText) {
    chrome.action.setTitle({ title: tooltipText });
}

// Парсинг количества непрочитанных писем
function parseUnreadCount(html) {
    try {
        console.log('Parsing Yandex Mail HTML...');
        
        // Метод 1: Поиск по новому селектору Yandex Mail
//        const counterRegex = /"unreadCounter"[^>]*>(\d+)/;
//        const counterMatch = html.match(counterRegex);
//        if (counterMatch && counterMatch[1]) {
//            const count = parseInt(counterMatch[1], 10);
//            console.log('Found via unreadCounter:', count);
//            return isNaN(count) ? 0 : Math.max(0, count);
//        }
        
        // Метод 2: Поиск по атрибуту data-key (для папки "Входящие")
//        const inboxRegex = /data-key="inbox"[^>]*data-count="(\d+)"/;
//        const inboxMatch = html.match(inboxRegex);
//        if (inboxMatch && inboxMatch[1]) {
//            const count = parseInt(inboxMatch[1], 10);
//            console.log('Found via data-key inbox:', count);
//            return isNaN(count) ? 0 : Math.max(0, count);
//        }
        
        // Метод 3: Поиск по классу нового счетчика
//        const newCounterRegex = /class="[^"]*mail-NestedList-Item-Info[^"]*"[^>]*>(\d+)/;
//        const newCounterMatch = html.match(newCounterRegex);
//        if (newCounterMatch && newCounterMatch[1]) {
//            const count = parseInt(newCounterMatch[1], 10);
//           console.log('Found via new counter class:', count);
//            return isNaN(count) ? 0 : Math.max(0, count);
//        }

        
        // Метод 4.1: Поиск по старому селектору (на всякий случай) исправленный только на входящие:
//        const oldCounterRegex = /b-folders__folder[^>]*data-key="inbox"[^>]*>[\s\S]*?b-folders__folder__num[^>]*>(\d+)/;
//        const oldCounterMatch = html.match(oldCounterRegex);
//        if (oldCounterMatch && oldCounterMatch[1]) {
//            const count = parseInt(oldCounterMatch[1], 10);
//            console.log('Found via old counter class (inbox only):', count);
//            return isNaN(count) ? 0 : Math.max(0, count);
//        }

        
        // Метод 4: Поиск по старому селектору (на всякий случай)
//        const oldCounterRegex = /class="[^"]*b-folders__folder__num[^"]*"[^>]*>(\d+)/;
//        const oldCounterMatch = html.match(oldCounterRegex);
//        if (oldCounterMatch && oldCounterMatch[1]) {
//            const count = parseInt(oldCounterMatch[1], 10);
//            console.log('Found via old counter class:', count);
//            return isNaN(count) ? 0 : Math.max(0, count);
//        }
        
        // Метод 5.1: Поиск числа рядом с "Входящие" исправленный 
        const titleRegex = /<title>[^\(]*Входящие[^\(]*\((\d+)[^\)]*нов/;
        const titleMatch = html.match(titleRegex);
        if (titleMatch && titleMatch[1]) {
            const count = parseInt(titleMatch[1], 10);
            console.log('Found in title (inbox only):', count);
            return isNaN(count) ? 0 : Math.max(0, count);
        }	

        // Метод 5.2: Поиск числа рядом с "Входящие" альтернативный
//        const titleRegexAlt = /<title>[^<]*Входящие[^<]*\((\d+)[^\)]*новое письмо[^<]*<\/title>/;
 //       const titleMatchAlt = html.match(titleRegexAlt);
//        if (titleMatchAlt && titleMatchAlt[1]) {
//            const count = parseInt(titleMatchAlt[1], 10);
//            console.log('Found in title (alternative):', count);
//            return isNaN(count) ? 0 : Math.max(0, count);
//        }
		
        // Метод 5: Поиск числа рядом с "Входящие"
//        const inboxTextRegex = /Входящие[^<]*<[^>]*>[\s\D]*?(\d+)/;
//        const inboxTextMatch = html.match(inboxTextRegex);
//        if (inboxTextMatch && inboxTextMatch[1]) {
//            const count = parseInt(inboxTextMatch[1], 10);
//            console.log('Found near "Входящие" :', count);
//           return isNaN(count) ? 0 : Math.max(0, count);
//        }
        
        console.log('No counter found, returning 0');
        return 0;
        
    } catch (error) {
        console.error('Error parsing HTML:', error);
        return -1;
    }
}

// Создание контекстного меню
function createContextMenu() {
    chrome.contextMenus.create({
        id: "check-now",
        title: "Проверить сейчас",
        contexts: ["action"]
    });
}

// Обработчик контекстного меню
function setupContextMenuHandler() {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === "check-now") {
            // Принудительная проверка с индикатором
            checkYandexMail(true);
        }
    });
}

// Инициализация аларма
async function initAlarm() {
    // Создаем аларм для периодической проверки (30 секунд)
    chrome.alarms.create('checkMail', { 
        periodInMinutes: CHECK_INTERVAL 
    });
    
    // Восстанавливаем последнее состояние
    const result = await chrome.storage.local.get(['unreadCount', 'lastCheck', 'lastError']);
    if (result.unreadCount !== undefined) {
        unreadCount = result.unreadCount;
        lastError = result.lastError || null;
        
        updateBadge(unreadCount);
        
        // Восстанавливаем подсказку в зависимости от состояния
        if (lastError) {
            updateTooltip(`Ошибка: ${lastError}`);
        } else {
            updateTooltip("Яндекс.Почта");
        }
    }
}

// Обработчик алармов
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkMail') {
        // Автоматическая проверка без индикатора
        checkYandexMail(false);
    }
});

// Обработчик установки/запуска
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Yandex Mail Checker installed');
    
    // Создаем контекстное меню
    createContextMenu();
    
    // Инициализируем аларм
    initAlarm();
    
    // Первая проверка (автоматическая, без индикатора)
    checkYandexMail(false);
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Browser started');
    initAlarm();
    // Автоматическая проверка при запуске браузера
    checkYandexMail(false);
});

// Обработчик клика по иконке (левая кнопка) - открываем почту
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: 'https://mail.yandex.ru' });
});

// Инициализация контекстного меню при загрузке
setupContextMenuHandler();

// Первоначальная инициализация
initAlarm();
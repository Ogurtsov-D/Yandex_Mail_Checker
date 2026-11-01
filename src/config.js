// Адреса
export const MAIL_URL = 'https://mail.yandex.ru/';
export const MAIL_TAB_PATTERN = 'https://mail.yandex.ru/*';
// Счётчики непрочитанных (unread — во всех папках, кроме «Спама») и новых писем
// (fresh — пришедших после последнего захода в почту). Адрес с ?silent — как у расширения Yandex Mail Watcher
export const COUNTERS_URL = 'https://mail.yandex.ru/api/v2/bar/counters?silent';
// Lite-версия «Входящих»: отправитель и тема новых писем, запасной источник счётчика
export const INBOX_URL = 'https://mail.yandex.ru/lite/inbox';

// Интервалы автопроверки (минуты), доступные в меню
export const INTERVALS = [1, 5, 15, 30];
export const DEFAULT_INTERVAL = 5;

// Повторы при ошибках сети/сервера
export const RETRY_INTERVAL_SEC = 30;
export const MAX_RETRIES = 2;

// Таймаут запроса к Яндексу
export const FETCH_TIMEOUT_MS = 20000;

// Сколько ID писем помнить, чтобы не уведомлять об одном письме дважды
export const MAX_KNOWN_IDS = 100;

// Перепроверка после действий во вкладке почты
export const RECHECK_DELAY_MS = 3000; // ждём, пока Яндекс сохранит «прочитано»
export const MIN_RECHECK_GAP_MS = 15000; // не чаще одного запроса в 15 секунд

// Сколько писем показывать в уведомлении
export const MAX_NOTIFICATION_ITEMS = 3;

export const BADGE_COLOR = '#d14836';

// Подробные логи в консоли service worker (chrome://extensions → service worker)
export const DEBUG = false;

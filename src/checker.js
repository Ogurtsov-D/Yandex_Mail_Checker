// Проверка почты: загрузка lite-страницы, разбор, уведомления, повторы при ошибках
import { ext } from './api.js';
import { FETCH_TIMEOUT_MS, INBOX_URL, MAX_KNOWN_IDS, MAX_RETRIES, RETRY_INTERVAL_SEC } from './config.js';
import { debug } from './log.js';
import { notifyNewCount, notifyNewMessages } from './notifications.js';
import { isLoginPage, parseUnreadCount, parseUnreadMessages } from './parser.js';
import { RETRY_ALARM } from './settings.js';
import { renderChecking, renderStatus } from './status.js';

export class MailCheckError extends Error {
    // type: auth | parse | server | client | http | timeout | network | internal
    // status — HTTP-код для server/client/http. Текст для пользователя — errorText() в format.js
    constructor(type, status = null) {
        super(status ? `${type} ${status}` : type);
        this.name = 'MailCheckError';
        this.type = type;
        this.status = status;
    }
}

// При этих ошибках быстрый повтор бессмыслен: нужно действие пользователя или Яндекса
const NO_RETRY_ERRORS = new Set(['auth', 'parse']);

let isChecking = false;
let lastCheckTime = null;

export function getLastCheckTime() {
    return lastCheckTime;
}

export function setLastCheckTime(timestamp) {
    lastCheckTime = timestamp ?? null;
}

// Загрузка lite-версии «Входящих» с таймаутом
async function fetchInboxHtml() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(INBOX_URL, {
            credentials: 'include',
            redirect: 'manual', // редирект = Яндекс отправляет на страницу входа
            cache: 'no-store',
            signal: controller.signal
        });

        if (response.type === 'opaqueredirect' || response.status === 0) {
            throw new MailCheckError('auth');
        }
        if (response.status >= 500) {
            throw new MailCheckError('server', response.status);
        }
        if (response.status >= 400) {
            throw new MailCheckError('client', response.status);
        }
        if (!response.ok) {
            throw new MailCheckError('http', response.status);
        }

        return await response.text();
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new MailCheckError('timeout');
        }
        if (error instanceof MailCheckError) throw error;
        // Исключения самого fetch (TypeError: Failed to fetch) — нет сети
        throw new MailCheckError('network');
    } finally {
        clearTimeout(timer);
    }
}

// Счётчик повторов хранится в storage.session: service worker выгружается между
// повторами, и переменная в памяти обнулялась бы, давая бесконечные повторы
async function getRetryCount() {
    const { retryCount } = await ext.storage.session.get('retryCount');
    return retryCount ?? 0;
}

async function setRetryCount(value) {
    await ext.storage.session.set({ retryCount: value });
}

async function handleSuccess(html) {
    const messages = parseUnreadMessages(html);
    const count = parseUnreadCount(html, messages);
    if (count === null) {
        // Капча, изменившаяся вёрстка и т.п. — не выдаём это за «0 писем»
        throw new MailCheckError('parse');
    }

    const prev = await ext.storage.local.get(['unreadCount', 'lastGoodCount', 'knownMessageIds']);
    // Первый запуск: запоминаем текущие письма, не уведомляя о старых
    const isFirstRun = prev.knownMessageIds === undefined;
    const knownIds = new Set(prev.knownMessageIds ?? []);
    const prevCount = prev.lastGoodCount ?? Math.max(prev.unreadCount ?? 0, 0);

    if (!isFirstRun) {
        // Новые письма определяем по ID, а не по росту счётчика:
        // «прочитал одно + пришло одно» не меняет счётчик, но письмо новое
        const unseen = messages.filter((m) => !knownIds.has(m.id));
        if (unseen.length > 0) {
            await notifyNewMessages(unseen);
        } else if (messages.length === 0 && count > prevCount) {
            await notifyNewCount(count - prevCount);
        }
    }

    const now = Date.now();
    const state = {
        unreadCount: count,
        lastGoodCount: count,
        errorType: null,
        errorStatus: null,
        lastError: null,
        lastCheck: now,
        lastSuccess: now
    };

    await ext.storage.local.set({
        ...state,
        knownMessageIds: [...new Set([...knownIds, ...messages.map((m) => m.id)])].slice(-MAX_KNOWN_IDS)
    });
    await setRetryCount(0);
    return state;
}

async function handleFailure(error) {
    const type = error.type ?? 'network';
    console.warn('Mail check failed:', error.message);

    if (NO_RETRY_ERRORS.has(type)) {
        await setRetryCount(0);
    } else {
        const retryCount = (await getRetryCount()) + 1;
        await setRetryCount(retryCount);
        if (retryCount <= MAX_RETRIES) {
            await ext.alarms.create(RETRY_ALARM, { delayInMinutes: RETRY_INTERVAL_SEC / 60 });
        }
        // После MAX_RETRIES ждём следующую плановую проверку
    }

    // Храним тип ошибки, а не текст: подсказка покажет его на текущем языке браузера
    const update = { errorType: type, errorStatus: error.status ?? null, lastError: null, lastCheck: Date.now() };
    await ext.storage.local.set(update);
    // Последний успешный результат сохраняется и показывается в подсказке
    const { lastSuccess, lastGoodCount } = await ext.storage.local.get(['lastSuccess', 'lastGoodCount']);
    return { ...update, lastSuccess, lastGoodCount };
}

// Проверить почту и обновить иконку. manual — проверка по команде пользователя (показывает «↻»)
export async function checkMail({ manual = false } = {}) {
    if (isChecking) return;
    isChecking = true;

    try {
        if (manual) await renderChecking();

        let state;
        try {
            const html = await fetchInboxHtml();
            if (isLoginPage(html)) throw new MailCheckError('auth');
            state = await handleSuccess(html);
            debug('Проверка успешна:', state);
        } catch (error) {
            if (!(error instanceof MailCheckError)) {
                // Ошибка в самом расширении — пишем стек, чтобы её можно было приложить к Issue
                console.error(error);
                error = new MailCheckError('internal');
            }
            state = await handleFailure(error);
        }

        lastCheckTime = state.lastCheck;
        await renderStatus(state);
    } finally {
        isChecking = false;
    }
}

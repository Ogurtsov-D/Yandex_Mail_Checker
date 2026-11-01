// Проверка почты: счётчики Яндекса, уведомления о новых письмах, запасной путь через lite-версию, повторы при ошибках
import { ext } from './api.js';
import { FETCH_TIMEOUT_MS, MAX_KNOWN_IDS, MAX_RETRIES, RETRY_INTERVAL_SEC } from './config.js';
import { hasHostAccess, mailUrls } from './hosts.js';
import { t } from './i18n.js';
import { debug } from './log.js';
import { notificationId, notifyNewCount, notifyNewMessages } from './notifications.js';
import { isLoginPage, parseUnreadCount, parseUnreadMessages } from './parser.js';
import { getSettings, RETRY_ALARM } from './settings.js';
import { renderChecking, renderStatus } from './status.js';

class MailCheckError extends Error {
    // type: auth | parse | permission | server | client | timeout | network | internal
    // status — HTTP-код для server/client. Текст для пользователя — errorText() в format.js
    constructor(type, status = null) {
        super(status ? `${type} ${status}` : type);
        this.name = 'MailCheckError';
        this.type = type;
        this.status = status;
    }
}

// При этих ошибках быстрый повтор бессмыслен: нужно действие пользователя или Яндекса
const NO_RETRY_ERRORS = new Set(['auth', 'parse', 'permission']);

let isChecking = false;
let lastCheckTime = null;

export function getLastCheckTime() {
    return lastCheckTime;
}

export function setLastCheckTime(timestamp) {
    lastCheckTime = timestamp ?? null;
}

const httpError = (status) => new MailCheckError(status >= 500 ? 'server' : 'client', status);

// Запрос к почте с cookie пользователя и таймаутом: { ok, status, text }.
// Редирект или 401 — пользователь не вошёл в почту
async function request(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            credentials: 'include',
            redirect: 'manual', // редирект = Яндекс отправляет на страницу входа
            cache: 'no-store',
            signal: controller.signal
        });

        if (response.type === 'opaqueredirect' || response.status === 0 || response.status === 401) {
            throw new MailCheckError('auth');
        }
        return { ok: response.ok, status: response.status, text: response.ok ? await response.text() : '' };
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

const isCount = (n) => Number.isInteger(n) && n >= 0;

// Счётчики почты по аккаунтам: [{ uid, unread, fresh }]. С ?multi Яндекс отвечает массивом
// по всем аккаунтам, в которые выполнен вход: [{ uid, data: { counters: { unread, fresh } } }];
// ответ без массива ({ counters }) — один аккаунт без uid.
// null — API недоступно (нет такого адреса, ответ другого формата); тогда счётчик берётся из lite-версии
async function fetchCounters(urls) {
    const response = await request(urls.counters);
    if (!response.ok) {
        if (response.status >= 500) throw httpError(response.status);
        return null;
    }
    let data;
    try {
        data = JSON.parse(response.text);
    } catch {
        return null;
    }
    const entries = Array.isArray(data)
        ? data.map((entry) => ({ uid: entry?.uid, ...entry?.data?.counters }))
        : [{ uid: null, ...data?.counters }];
    const accounts = entries
        .filter(
            ({ uid, unread, fresh }) => (uid === null || /^\d+$/.test(String(uid))) && isCount(unread) && isCount(fresh)
        )
        .map(({ uid, unread, fresh }) => ({ uid: uid === null ? null : String(uid), unread, fresh }));
    return accounts.length > 0 ? accounts : null;
}

// Lite-версия «Входящих» — только запасной путь, когда API счётчиков недоступно. Она всегда показывает
// аккаунт по умолчанию (?uid= на неё не действует), а её загрузка считается заходом в почту
// и обнуляет fresh (проверено владельцем)
async function fetchInboxHtml(urls) {
    const response = await request(urls.inbox);
    // Другие не-2xx: редиректы при redirect: 'manual' приходят как opaqueredirect
    if (!response.ok) throw httpError(response.status);
    if (isLoginPage(response.text)) throw new MailCheckError('auth');
    return response.text;
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

// Запомнить ID писем, чтобы не уведомлять о них повторно
function rememberIds(knownIds, messages) {
    return [...new Set([...knownIds, ...messages.map((m) => m.id)])].slice(-MAX_KNOWN_IDS);
}

async function saveSuccess(unreadCount, freshCount, extra) {
    const now = Date.now();
    const state = {
        unreadCount,
        freshCount,
        errorType: null,
        errorStatus: null,
        lastCheck: now,
        lastSuccess: now,
        accountSummary: null,
        ...extra.state
    };
    await ext.storage.local.set({ ...state, accounts: extra.accounts });
    await setRetryCount(0);
    return state;
}

// Один аккаунт по его счётчикам. prev — сохранённое состояние аккаунта: { lastFresh, lastUnread }.
// account — { uid, label }, когда аккаунтов несколько, иначе null. Возвращает новое состояние аккаунта.
//
// Отправителя и тему новых писем расширение не узнаёт: их можно взять только со страницы
// почты (lite-версии), а Яндекс считает её загрузку заходом в почту и обнуляет fresh —
// счётчик новых сбрасывался бы во всех браузерах, а уведомление тут же убиралось (проверено владельцем)
async function checkAccount({ fresh, unread }, prev, { enabled, account }) {
    // Первая проверка аккаунта: только запоминаем числа
    let added = 0;
    if (enabled && prev.lastFresh != null) {
        if (fresh >= prev.lastFresh) {
            added = fresh - prev.lastFresh;
        } else if (fresh > 0 && unread > (prev.lastUnread ?? Infinity)) {
            // fresh уменьшился, но непрочитанных стало больше: пользователь заходил в почту
            // (Яндекс обнуляет fresh), и после этого пришло fresh писем — все они новые.
            // Если непрочитанных не прибавилось, новое письмо просто прочитали в другом клиенте
            added = fresh;
        }
    }

    if (added > 0) await notifyNewCount(added, account);

    // Пользователь зашёл в почту и увидел новые письма — уведомление о них больше не нужно
    if (fresh === 0 && prev.lastFresh > 0) await ext.notifications.clear(notificationId(account));

    return { lastFresh: fresh, lastUnread: unread };
}

// Основной способ: счётчики Яндекса по всем аккаунтам, в которые выполнен вход.
// На бейдже — сумма по учитываемым аккаунтам: unread (все папки, кроме «Спама») или fresh.
// Рост fresh — пришли новые письма: уведомление с их числом
async function checkByCounters(list) {
    const { accounts: stored = {} } = await ext.storage.local.get('accounts');
    const { disabledAccounts, accountNames } = await getSettings();
    const multiple = list.length > 1;
    // Аккаунты, которых нет в этом ответе (например, у них временно нет чисел), сохраняют
    // своё состояние: иначе, вернувшись, они считались бы новыми и письма за перерыв пропали бы
    const accounts = { ...stored };
    const summary = [];

    for (const [index, counters] of list.entries()) {
        const key = counters.uid ?? '';
        const enabled = !multiple || !disabledAccounts.includes(key);
        // Подпись — имя, заданное на странице настроек, иначе «Аккаунт N»
        const label = accountNames[key] || t('accountNumber', index + 1);
        const account = multiple ? { uid: key, label } : null;
        accounts[key] = await checkAccount(counters, stored[key] ?? {}, { enabled, account });
        summary.push({ uid: key, label, unread: counters.unread, fresh: counters.fresh, enabled });
    }

    // Список аккаунтов с числами — для меню и страницы настроек. Записываем, только когда он
    // изменился: по этому ключу меню пересоздаётся
    const accountList = multiple ? summary : [];
    const { accountList: prevList = [] } = await ext.storage.local.get('accountList');
    if (JSON.stringify(prevList) !== JSON.stringify(accountList)) await ext.storage.local.set({ accountList });

    const counted = summary.filter((a) => a.enabled);
    const sum = (field) => counted.reduce((total, a) => total + a[field], 0);
    return saveSuccess(sum('unread'), sum('fresh'), {
        accounts,
        state: { accountSummary: multiple ? summary : null }
    });
}

// Запасной способ, если API счётчиков недоступно: всё из lite-версии «Входящих»
async function checkByInboxPage(html) {
    const messages = parseUnreadMessages(html);
    const count = parseUnreadCount(html, messages);
    if (count === null) {
        // Капча, изменившаяся вёрстка и т.п. — не выдаём это за «0 писем»
        throw new MailCheckError('parse');
    }

    const prev = await ext.storage.local.get(['unreadCount', 'accounts']);
    const known = prev.accounts?.['']?.knownMessageIds;
    // Первый запуск: запоминаем текущие письма, не уведомляя о старых
    const isFirstRun = known === undefined;
    const knownIds = new Set(known ?? []);
    const prevCount = prev.unreadCount ?? 0;

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

    // Lite-версия знает только текущий аккаунт — храним его под пустым ключом.
    // Состояние аккаунтов из API сбрасывается: когда API вернётся, его первая проверка не уведомляет
    return saveSuccess(count, null, { accounts: { '': { knownMessageIds: rememberIds(knownIds, messages) } } });
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
    const update = { errorType: type, errorStatus: error.status ?? null, lastCheck: Date.now() };
    await ext.storage.local.set(update);
    // unreadCount при ошибке не меняется — это последний успешный результат, он показывается в подсказке
    const { lastSuccess, unreadCount } = await ext.storage.local.get(['lastSuccess', 'unreadCount']);
    return { ...update, lastSuccess, unreadCount };
}

// Проверить почту и обновить иконку. manual — проверка по команде пользователя (показывает «↻»)
export async function checkMail({ manual = false } = {}) {
    if (isChecking) return;
    isChecking = true;

    try {
        if (manual) await renderChecking();

        let state;
        try {
            const urls = await mailUrls();
            // Пользователь выбрал другой домен почты, но отозвал разрешение на доступ к нему
            if (!(await hasHostAccess(urls.host))) throw new MailCheckError('permission', urls.host);
            const counters = await fetchCounters(urls);
            debug('Счётчики:', counters ?? 'API недоступно, читаем lite-версию');
            state = counters ? await checkByCounters(counters) : await checkByInboxPage(await fetchInboxHtml(urls));
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

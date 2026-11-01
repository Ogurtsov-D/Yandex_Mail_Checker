// Проверка почты: счётчики Яндекса, детали новых писем из lite-версии, уведомления, повторы при ошибках
import { ext } from './api.js';
import { FETCH_TIMEOUT_MS, MAX_KNOWN_IDS, MAX_RETRIES, RETRY_INTERVAL_SEC } from './config.js';
import { hasHostAccess, mailUrls } from './hosts.js';
import { t } from './i18n.js';
import { debug } from './log.js';
import { notificationId, notifyNewCount, notifyNewMessages } from './notifications.js';
import { isLoginPage, parseAccountLogin, parseUnreadCount, parseUnreadMessages } from './parser.js';
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

// Lite-версия «Входящих» (uid — аккаунт, когда их несколько)
async function fetchInboxHtml(urls, uid = null) {
    const response = await request(uid ? `${urls.inbox}?uid=${uid}` : urls.inbox);
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

// Непрочитанные письма из lite-версии «Входящих» (новые сверху) и логин аккаунта.
// null — страницу получить или распознать не удалось: уведомление обойдётся без подробностей
async function loadInbox(urls, uid) {
    try {
        const html = await fetchInboxHtml(urls, uid);
        const messages = parseUnreadMessages(html);
        if (parseUnreadCount(html, messages) === null) return null;
        return { messages, login: parseAccountLogin(html) };
    } catch (error) {
        if (!(error instanceof MailCheckError)) console.error(error);
        console.warn('Inbox details unavailable:', error.message);
        return null;
    }
}

// Один аккаунт по его счётчикам. prev — сохранённое состояние аккаунта:
// { lastFresh, knownMessageIds, login }. account — { uid, label } для подписи
// уведомлений, когда аккаунтов несколько, иначе null. Возвращает новое состояние аккаунта
async function checkAccount({ uid, fresh }, prev, { urls, enabled, account }) {
    // Первая проверка аккаунта: только запоминаем fresh.
    // fresh уменьшился — пользователь заходил в почту (Яндекс обнуляет fresh) или прочитал
    // новое письмо где-то ещё. В первом случае все fresh писем пришли после обнуления
    const decreased = prev.lastFresh != null && fresh < prev.lastFresh;
    const added = !enabled || prev.lastFresh == null ? 0 : decreased ? fresh : fresh - prev.lastFresh;
    const next = { lastFresh: fresh, knownMessageIds: prev.knownMessageIds, login: prev.login ?? null };

    // Список известных писем нужен, чтобы отличить новые письма от старых непрочитанных.
    // Его заполняем при первой проверке аккаунта (заодно узнаём логин для подписи),
    // дальше — только когда пришли новые письма
    if (added > 0 || prev.knownMessageIds === undefined) {
        const knownIds = new Set(prev.knownMessageIds ?? []);
        const inbox = await loadInbox(urls, uid);
        // Не удалось — пустой список: иначе lite-версия запрашивалась бы при каждой проверке
        next.knownMessageIds = inbox ? rememberIds(knownIds, inbox.messages) : [...knownIds];
        if (inbox?.login) next.login = inbox.login;

        if (added > 0) {
            // Новые сверху; письма могли прийти и в другие папки — тогда во «Входящих» их нет
            const unseen = (inbox?.messages ?? []).filter((m) => !knownIds.has(m.id)).slice(0, added);
            // После уменьшения fresh уведомляем только о письмах, которых ещё не видели:
            // если fresh уменьшился из-за прочтения, новых писем нет
            const label = account && { ...account, label: next.login ?? account.label };
            if (unseen.length > 0) await notifyNewMessages(unseen, decreased ? unseen.length : added, label);
            else if (!decreased) await notifyNewCount(added, label);
        }
    }

    // Пользователь зашёл в почту и увидел новые письма — уведомление о них больше не нужно
    if (fresh === 0 && prev.lastFresh > 0) await ext.notifications.clear(notificationId(account));

    return next;
}

// Основной способ: счётчики Яндекса по всем аккаунтам, в которые выполнен вход.
// На бейдже — сумма по включённым аккаунтам: unread (все папки, кроме «Спама») или fresh.
// Рост fresh — пришли новые письма: их отправителя и тему берём из lite-версии
async function checkByCounters(list, urls) {
    const { accounts: stored = {} } = await ext.storage.local.get('accounts');
    const { disabledAccounts } = await getSettings();
    const multiple = list.length > 1;
    // Аккаунты, которых нет в этом ответе (например, у них временно нет чисел), сохраняют
    // своё состояние: иначе, вернувшись, они считались бы новыми и письма за перерыв пропали бы
    const accounts = { ...stored };
    const summary = [];

    for (const [index, counters] of list.entries()) {
        const key = counters.uid ?? '';
        const prev = stored[key] ?? {};
        const enabled = !multiple || !disabledAccounts.includes(key);
        const label = prev.login ?? t('accountNumber', index + 1);
        const account = multiple ? { uid: key, label } : null;
        accounts[key] = await checkAccount(counters, prev, { urls, enabled, account });
        summary.push({
            uid: key,
            label: accounts[key].login ?? label,
            unread: counters.unread,
            fresh: counters.fresh,
            enabled
        });
    }

    // Список аккаунтов для меню записываем, только когда он изменился: по этому ключу меню пересоздаётся
    const accountList = multiple ? summary.map(({ uid, label }) => ({ uid, label })) : [];
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
            state = counters
                ? await checkByCounters(counters, urls)
                : await checkByInboxPage(await fetchInboxHtml(urls));
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

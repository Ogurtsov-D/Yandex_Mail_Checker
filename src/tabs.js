// Работа со вкладками: открыть почту или письмо в уже открытой вкладке
// и перепроверить счётчик после действий во вкладке почты
import { ext } from './api.js';
import { checkMail, getLastCheckTime } from './checker.js';
import { MIN_RECHECK_GAP_MS, RECHECK_DELAY_MS } from './config.js';
import { mailUrls } from './hosts.js';

async function isMailUrl(url) {
    return typeof url === 'string' && url.startsWith((await mailUrls()).base);
}

function isLiteUrl(url) {
    return new URL(url).pathname.startsWith('/lite');
}

// Вкладка, где пишется письмо: её нельзя уводить на другую страницу
function isComposeUrl(url) {
    return /compose/i.test(url);
}

// Самая недавно использованная вкладка
function mostRecentTab(tabs) {
    return tabs.reduce((best, t) => (!best || (t.lastAccessed ?? 0) > (best.lastAccessed ?? 0) ? t : best), null);
}

async function focusTab(tab, url) {
    await ext.tabs.update(tab.id, url ? { active: true, url } : { active: true });
    await ext.windows.update(tab.windowId, { focused: true });
}

const tabUid = (url) => new URL(url).searchParams.get('uid');

// Открыть почту. hash — конкретное письмо ('#/message/123'); без него — просто почта.
// uid — аккаунт, когда их несколько: подходит только вкладка этого аккаунта (?uid=…),
// новая вкладка открывается сразу в нём. Без uid — любая вкладка почты, аккаунт выбирает Яндекс
export async function openMail(hash = null, uid = null) {
    const urls = await mailUrls();
    const tabs = (await ext.tabs.query({ url: urls.tabPattern })).filter(
        (t) => t.url && (!uid || tabUid(t.url) === uid)
    );
    const newTabUrl = urls.base + (uid ? `?uid=${uid}` : '') + (hash ?? '');

    if (!hash) {
        const tab = mostRecentTab(tabs);
        if (tab) await focusTab(tab);
        else await ext.tabs.create({ url: newTabUrl });
        return;
    }

    // Для письма подходит вкладка с полной версией, где не пишется письмо.
    // Меняем только hash — почта откроет письмо без перезагрузки и с тем же ?uid=.
    const usable = tabs.filter((t) => !isLiteUrl(t.url) && !isComposeUrl(t.url));
    const tab = mostRecentTab(usable);
    if (tab) await focusTab(tab, tab.url.split('#')[0] + hash);
    else await ext.tabs.create({ url: newTabUrl });
}

// ---------- Перепроверка после действий во вкладке почты ----------

let recheckTimer = null;

function scheduleRecheck() {
    // Уже запланирована — не откладываем её снова: частые события
    // (например, мигающий заголовок вкладки) отодвигали бы проверку бесконечно
    if (recheckTimer) return;
    const sinceLast = Date.now() - (getLastCheckTime() ?? 0);
    const delay = Math.max(RECHECK_DELAY_MS, MIN_RECHECK_GAP_MS - sinceLast);
    recheckTimer = setTimeout(() => {
        recheckTimer = null;
        checkMail();
    }, delay);
}

// ID вкладок почты храним в storage.session: onRemoved не сообщает адрес закрытой вкладки.
// Возвращает, была ли вкладка вкладкой почты до изменения.
async function setMailTab(tabId, isMail) {
    const { mailTabIds = [] } = await ext.storage.session.get('mailTabIds');
    const had = mailTabIds.includes(tabId);
    if (had !== isMail) {
        const next = isMail ? [...mailTabIds, tabId] : mailTabIds.filter((id) => id !== tabId);
        await ext.storage.session.set({ mailTabIds: next });
    }
    return had;
}

// Открыли письмо, вернулись в список, сменили папку — меняется адрес;
// изменилось число непрочитанных — Яндекс меняет заголовок вкладки
export async function handleTabUpdated(tabId, changeInfo, tab) {
    if (!changeInfo.url && !changeInfo.title) return;

    const url = changeInfo.url ?? tab?.url;
    if (await isMailUrl(url)) {
        await setMailTab(tabId, true);
        scheduleRecheck();
    } else if (changeInfo.url && (await setMailTab(tabId, false))) {
        // Ушли с почты в этой вкладке
        scheduleRecheck();
    }
}

export async function handleTabRemoved(tabId) {
    if (await setMailTab(tabId, false)) scheduleRecheck();
}

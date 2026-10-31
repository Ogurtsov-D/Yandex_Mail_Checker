// Тексты для бейджа, подсказки и уведомлений
import { locale, plural, t } from './i18n.js';

export function newMailTitle(n) {
    return plural('newMail', n);
}

export function unreadText(n) {
    return n === 0 ? t('noUnread') : plural('unread', n);
}

// «в 14:32» сегодня, «вчера в 14:32», иначе «28.10 в 14:32» (по-английски — «at 02:32 PM», «Oct 28 at …»)
export function formatCheckTime(timestamp, now = Date.now()) {
    const lang = locale();
    const date = new Date(timestamp);
    const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(date);

    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const daysAgo = Math.round((startOfDay(new Date(now)) - startOfDay(date)) / 86400000);

    if (daysAgo === 0) return t('atTime', time);
    if (daysAgo === 1) return t('yesterdayAtTime', time);
    const dayOptions = lang === 'ru' ? { day: '2-digit', month: '2-digit' } : { month: 'short', day: 'numeric' };
    return t('dateAtTime', new Intl.DateTimeFormat(lang, dayOptions).format(date), time);
}

const ERROR_MESSAGES = {
    auth: 'errorAuth',
    server: 'errorServer',
    client: 'errorClient',
    http: 'errorHttp',
    timeout: 'errorTimeout',
    network: 'errorNetwork',
    parse: 'errorParse',
    internal: 'errorInternal'
};

// Текст ошибки на текущем языке (в хранилище лежит только её тип и HTTP-код)
export function errorText(state) {
    const key = ERROR_MESSAGES[state.errorType];
    if (key) return state.errorStatus ? t(key, state.errorStatus) : t(key);
    return state.lastError || t('errorInternal'); // состояние от версий до 1.5.0
}

// Текст на бейдже по сохранённому состоянию
export function badgeText(state) {
    if (state.errorType === 'auth') return '?';
    if (state.errorType) return '!';
    const count = state.unreadCount ?? 0;
    if (count <= 0) return '';
    return count > 99 ? '99+' : String(count);
}

// Подсказка при наведении на иконку
export function tooltipText(state, now = Date.now()) {
    const service = t('serviceName');

    if (state.errorType) {
        const lines = [`${service}: ${errorText(state)}`];
        if (state.lastSuccess) {
            lines.push(t('lastSuccess', formatCheckTime(state.lastSuccess, now), unreadText(state.lastGoodCount ?? 0)));
        }
        return lines.join('\n');
    }

    if (state.lastSuccess) {
        return [
            `${service}: ${unreadText(state.unreadCount ?? 0)}`,
            t('checkedAt', formatCheckTime(state.lastSuccess, now))
        ].join('\n');
    }

    return service;
}

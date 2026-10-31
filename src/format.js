// Тексты для бейджа, подсказки и уведомлений. Только чистые функции.

// Склонение: pluralize(5, 'письмо', 'письма', 'писем') → 'писем'
export function pluralize(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
}

export function newMailTitle(n) {
    return `${n} ${pluralize(n, 'новое письмо', 'новых письма', 'новых писем')}`;
}

export function unreadText(n) {
    if (n === 0) return 'новых писем нет';
    return `${n} ${pluralize(n, 'непрочитанное письмо', 'непрочитанных письма', 'непрочитанных писем')}`;
}

const pad = (n) => String(n).padStart(2, '0');

// «в 14:32» сегодня, «вчера в 14:32», иначе «28.10 в 14:32»
export function formatCheckTime(timestamp, now = Date.now()) {
    const date = new Date(timestamp);
    const today = new Date(now);
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const daysAgo = Math.round((startOfDay(today) - startOfDay(date)) / 86400000);

    if (daysAgo === 0) return `в ${time}`;
    if (daysAgo === 1) return `вчера в ${time}`;
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)} в ${time}`;
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
    const lines = [];

    if (state.errorType) {
        lines.push(`Яндекс.Почта: ${state.lastError}`);
        if (state.lastSuccess) {
            lines.push(
                `Последняя успешная проверка ${formatCheckTime(state.lastSuccess, now)}: ` +
                    unreadText(state.lastGoodCount ?? 0)
            );
        }
    } else if (state.lastSuccess) {
        lines.push(`Яндекс.Почта: ${unreadText(state.unreadCount ?? 0)}`);
        lines.push(`Проверено ${formatCheckTime(state.lastSuccess, now)}`);
    } else {
        lines.push('Яндекс.Почта');
    }

    return lines.join('\n');
}

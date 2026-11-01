// Разбор HTML lite-версии Яндекс.Почты (https://mail.yandex.ru/lite/inbox).
// Только чистые функции: без обращений к API браузера, легко тестировать.
// В service worker нет DOMParser, поэтому разбор сделан регулярными выражениями.

import { debug } from './log.js';

const NAMED_ENTITIES = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: '\u00a0',
    laquo: '«',
    raquo: '»',
    mdash: '—',
    ndash: '–',
    hellip: '…',
    copy: '©',
    reg: '®'
};

// Декодирование HTML-сущностей: &quot; &amp; &#39; &#x2014; …
export function decodeHtmlEntities(text) {
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
export function cleanHtmlText(fragment) {
    return decodeHtmlEntities(fragment.replace(/<[^>]*>/g, ''))
        .replace(/\s+/g, ' ')
        .trim();
}

// Яндекс вернул страницу входа вместо почты
export function isLoginPage(html) {
    return html.includes('passport.yandex.ru') && !html.includes('b-messages');
}

// Похоже ли это на страницу входящих lite-версии (а не капчу, заглушку или другую вёрстку)
function isLiteInboxPage(html) {
    return html.includes('b-messages') || html.includes('b-folders') || html.includes('href="/lite/inbox"');
}

// ---------- Разметка ----------
// Устройство lite-страницы подтверждено кодом расширений, которые с ней работают
// (см. tests/fixtures/README.md): строка письма — <div> с классами b-messages__message
// и b-messages__message_unread, отправитель — <a class="b-messages__from">, тема —
// <span class="b-messages__subject">, счётчик папки — <span class="b-folders__folder__num">
// перед ссылкой на папку. Разбираем по классам и берём текст элемента целиком,
// чтобы мелкие изменения вложенности тегов не ломали разбор.

const classesOf = (tag) => (tag.match(/\sclass="([^"]*)"/)?.[1] ?? '').split(/\s+/);
const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;

// Текст первого элемента <tagName> с классом className, с учётом вложенных одноимённых тегов
function elementText(html, tagName, className) {
    const openings = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
    for (const open of html.matchAll(openings)) {
        if (!classesOf(open[0]).includes(className)) continue;
        const start = open.index + open[0].length;
        const tags = new RegExp(`<(/?)${tagName}\\b[^>]*>`, 'gi');
        tags.lastIndex = start;
        let depth = 1;
        for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
            depth += tag[1] ? -1 : 1;
            if (depth === 0) return cleanHtmlText(html.slice(start, tag.index));
        }
        return cleanHtmlText(html.slice(start));
    }
    return '';
}

// «1 234», «1 234» (неразрывный пробел), «1,234» → 1234; не число → null
function parseNumber(text) {
    const digits = text.replace(/[\s  ,.]/g, '');
    return /^\d+$/.test(digits) ? parseInt(digits, 10) : null;
}

// Непрочитанные письма на странице: [{ id, isThread, from, subject }]
export function parseUnreadMessages(html) {
    const rows = [...html.matchAll(/<div\b[^>]*>/gi)].filter((m) => classesOf(m[0]).includes('b-messages__message'));
    const messages = [];

    rows.forEach((row, i) => {
        if (!classesOf(row[0]).includes('b-messages__message_unread')) return;
        const block = html.slice(row.index, rows[i + 1]?.index ?? html.length);

        // name="ids" value="192247409093380563" — письмо, name="tids" value="…:3" — тред
        // (после разделителя — служебные данные: число писем в треде)
        const input = (block.match(/<input\b[^>]*>/gi) ?? []).find((tag) =>
            ['ids', 'tids'].includes(attribute(tag, 'name'))
        );
        const id = (attribute(input ?? '', 'value') ?? '').split(/[|:]/)[0];
        if (!/^\d+$/.test(id)) return;

        messages.push({
            id,
            isThread: attribute(input, 'name') === 'tids',
            from: elementText(block, 'a', 'b-messages__from') || elementText(block, 'span', 'b-messages__from__text'),
            subject: elementText(block, 'span', 'b-messages__subject')
        });
    });

    return messages;
}

// Счётчик папки «Входящие» из списка папок: <span class="b-folders__folder__num">N</span> … <a href="/lite/inbox">
function inboxFolderCount(html) {
    const folders =
        /<span\b[^>]*\sclass="[^"]*\bb-folders__folder__num\b[^"]*"[^>]*>([^<]*)<\/span>[\s\S]*?<a\b[^>]*\shref="([^"]*)"/gi;
    for (const [, num, href] of html.matchAll(folders)) {
        if (href === '/lite/inbox' || href.startsWith('/lite/inbox?')) return parseNumber(num);
    }
    return null;
}

// Количество непрочитанных писем во «Входящих».
// Возвращает число или null, если страницу распознать не удалось.
export function parseUnreadCount(html, unreadMessages = []) {
    // 1. Число в скобках в <title>: «Входящие (47 новых писем)», «Inbox (1,234 new)».
    //    Не завязываемся на слово «Входящие», чтобы работало при любом языке интерфейса.
    const titleMatch = html.match(/<title>[^<(]*\((\d[\d\s  ,.]*)/);
    const fromTitle = titleMatch ? parseNumber(titleMatch[1]) : null;
    if (fromTitle !== null) {
        debug('Счётчик из <title>:', fromTitle);
        return fromTitle;
    }

    // 2. Счётчик в списке папок
    const fromFolders = inboxFolderCount(html);
    if (fromFolders !== null) {
        debug('Счётчик из списка папок:', fromFolders);
        return fromFolders;
    }

    // 3. Считаем непрочитанные письма на первой странице списка
    if (unreadMessages.length > 0) {
        debug('Счётчик по письмам на странице:', unreadMessages.length);
        return unreadMessages.length;
    }

    // Страница входящих распознана, непрочитанных нет — честный ноль
    if (isLiteInboxPage(html)) return 0;

    return null;
}

// Адрес письма в полной версии почты (добавляется к адресу вкладки): #/message/<id>.
// Формат сверен с расширением pulsar, проверявшим его на живых ящиках в октябре 2026 г.
// Для тредов проверенного формата нет — по клику открывается почта (null).
export function messageHash(message) {
    return message.isThread ? null : `#/message/${message.id}`;
}

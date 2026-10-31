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
    return html.includes('b-messages') || html.includes('href="/lite/inbox"');
}

// Непрочитанные письма на странице: [{ id, isThread, from, subject }]
export function parseUnreadMessages(html) {
    const messages = [];

    // Разбиваем HTML по началу каждого блока письма, затем оставляем непрочитанные
    const blocks = html.split(/<div class="b-messages__message\b/);

    for (const block of blocks) {
        if (!block.includes('b-messages__message_unread')) continue;

        // name="ids" value="192247409093380563" — письмо,
        // name="tids" value="192247409093380553:3" — тред (после двоеточия — число писем)
        const idMatch = block.match(/name="(ids|tids)"[^>]*value="([^"]+)"/);
        if (!idMatch) continue;

        const fromMatch = block.match(
            /class="b-messages__from__text"[^>]*><span class="b-messages__from__text">([\s\S]*?)<\/span>/
        );
        const subjMatch = block.match(/class="b-messages__subject"><span>([\s\S]*?)<\/span>/);

        messages.push({
            id: idMatch[2].split(':')[0],
            isThread: idMatch[1] === 'tids',
            from: fromMatch ? cleanHtmlText(fromMatch[1]) : '',
            subject: subjMatch ? cleanHtmlText(subjMatch[1]) : ''
        });
    }

    return messages;
}

// Количество непрочитанных писем во «Входящих».
// Возвращает число или null, если страницу распознать не удалось.
export function parseUnreadCount(html, unreadMessages = []) {
    // 1. Число в скобках в <title>: «Входящие (47 новых писем)», «Inbox (47 new)».
    //    Не завязываемся на слово «Входящие», чтобы работало при любом языке интерфейса.
    const titleMatch = html.match(/<title>[^<(]*\((\d+)[^)<]*\)/);
    if (titleMatch) {
        debug('Счётчик из <title>:', titleMatch[1]);
        return parseInt(titleMatch[1], 10);
    }

    // 2. data-key="inbox" с data-count
    const inboxMatch = html.match(/data-key="inbox"[^>]*data-count="(\d+)"/);
    if (inboxMatch) {
        debug('Счётчик из data-count:', inboxMatch[1]);
        return parseInt(inboxMatch[1], 10);
    }

    // 3. aria-label ссылки «Входящие»
    const ariaMatch = html.match(/href="\/lite\/inbox"[^>]*aria-label="Входящие,\s*(\d+)\s*нов/);
    if (ariaMatch) {
        debug('Счётчик из aria-label:', ariaMatch[1]);
        return parseInt(ariaMatch[1], 10);
    }

    // 4. Считаем непрочитанные письма на первой странице списка
    if (unreadMessages.length > 0) {
        debug('Счётчик по письмам на странице:', unreadMessages.length);
        return unreadMessages.length;
    }

    // Страница входящих распознана, непрочитанных нет — честный ноль
    if (isLiteInboxPage(html)) return 0;

    return null;
}

// Адрес письма в полной версии почты (добавляется к адресу вкладки): #message/<id> или #thread/t<id>
export function messageHash(message) {
    return message.isThread ? `#thread/t${message.id}` : `#message/${message.id}`;
}

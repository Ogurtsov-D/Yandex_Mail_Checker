// Генератор страниц lite-версии для сценарных тестов.
// Разметка повторяет фрагменты, на которые опирается src/parser.js
// (образцы целиком — в tests/fixtures/).
import { readFileSync } from 'node:fs';

export function fixture(name) {
    return readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
}

export function message({ id, from = 'Отправитель', subject = 'Тема', unread = true, thread = false }) {
    const cls = unread ? 'b-messages__message b-messages__message_unread' : 'b-messages__message';
    const input = thread
        ? `<input type="checkbox" name="tids" class="b-form-checkbox" value="${id}:3">`
        : `<input type="checkbox" name="ids" class="b-form-checkbox" value="${id}">`;
    return (
        `<div class="${cls}">${input}` +
        `<a class="b-messages__from" href="/lite/compose">${from}</a>` +
        `<a class="b-messages__message__link" href="/lite/${thread ? 'thread' : 'message'}/${id}">` +
        `<span class="b-messages__subject">${subject}</span></a></div>`
    );
}

export function inboxPage({ count = 0, messages = [] } = {}) {
    const title = count > 0 ? `Входящие (${count} новых) — Яндекс Почта` : 'Входящие — Яндекс Почта';
    const num = count > 0 ? `<span class="b-folders__folder__num">${count}</span>` : '';
    return (
        `<!DOCTYPE html><html><head><title>${title}</title></head><body>` +
        `<div class="b-folders"><div class="b-folders__folder">${num}` +
        `<a class="b-folders__folder__link" href="/lite/inbox">Входящие</a></div></div>` +
        `<form class="b-messages">${messages.map(message).join('')}</form>` +
        `</body></html>`
    );
}

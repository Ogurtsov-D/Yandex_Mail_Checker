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
        ? `<input type="checkbox" name="tids" value="${id}:3">`
        : `<input type="checkbox" name="ids" value="${id}">`;
    return (
        `<div class="${cls}">${input}` +
        `<span class="b-messages__from__text" title=""><span class="b-messages__from__text">${from}</span></span>` +
        `<a href="/lite/message/${id}"><span class="b-messages__subject"><span>${subject}</span></span></a></div>`
    );
}

export function inboxPage({ count = 0, messages = [] } = {}) {
    const title = count > 0 ? `Входящие (${count} новых) — Яндекс Почта` : 'Входящие — Яндекс Почта';
    return (
        `<!DOCTYPE html><html><head><title>${title}</title></head><body>` +
        `<a href="/lite/inbox">Входящие</a><div class="b-messages">${messages.map(message).join('')}</div>` +
        `</body></html>`
    );
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    cleanHtmlText,
    decodeHtmlEntities,
    isLoginPage,
    messageHash,
    parseUnreadCount,
    parseUnreadMessages
} from '../src/parser.js';
import { fixture } from './helpers/pages.js';

test('непрочитанные письма: ID, тред, отправитель, тема; прочитанные пропускаются', () => {
    const messages = parseUnreadMessages(fixture('inbox-unread.html'));
    assert.deepEqual(messages, [
        {
            id: '192247409093380563',
            isThread: false,
            from: '"Рога & Копыта"',
            subject: 'Заказ №1234 передан курьеру — сегодня'
        },
        { id: '192247409093380553', isThread: true, from: 'Иван Смирнов', subject: 'Отчёт за октябрь' },
        { id: '192247409093380540', isThread: false, from: 'Анна Петрова', subject: 'Встреча в четверг' }
    ]);
});

test('счётчик из заголовка страницы', () => {
    const html = fixture('inbox-unread.html');
    assert.equal(parseUnreadCount(html, parseUnreadMessages(html)), 3);
});

test('счётчик при английском интерфейсе', () => {
    const html = fixture('inbox-english.html');
    assert.equal(parseUnreadCount(html, parseUnreadMessages(html)), 2);
});

test('нет непрочитанных — честный ноль', () => {
    const html = fixture('inbox-empty.html');
    assert.equal(parseUnreadCount(html, parseUnreadMessages(html)), 0);
});

test('капча — null (ошибка), а не «0 писем»', () => {
    const html = fixture('captcha.html');
    assert.equal(parseUnreadCount(html, parseUnreadMessages(html)), null);
});

test('запасные способы подсчёта: data-count, aria-label, письма на странице', () => {
    const body = '<a href="/lite/inbox"></a><div class="b-messages"></div>';
    assert.equal(parseUnreadCount(`<title>Почта</title><a data-key="inbox" data-count="7">${body}`), 7);
    assert.equal(parseUnreadCount(`<title>Почта</title><a href="/lite/inbox" aria-label="Входящие, 4 новых">`), 4);
    assert.equal(parseUnreadCount(`<title>Inbox</title>${body}`, [{ id: '1' }, { id: '2' }]), 2);
});

test('страница входа распознаётся', () => {
    assert.equal(isLoginPage(fixture('login.html')), true);
    assert.equal(isLoginPage(fixture('inbox-unread.html')), false);
});

test('HTML-сущности декодируются', () => {
    assert.equal(decodeHtmlEntities('&quot;A&quot; &amp; &#39;B&#39; &#x2014; &laquo;C&raquo;'), '"A" & \'B\' — «C»');
    assert.equal(decodeHtmlEntities('&unknown; &#xFFFFFFF;'), '&unknown; &#xFFFFFFF;');
    assert.equal(cleanHtmlText('  <b>Важно:</b>\n  счёт&nbsp;оплачен  '), 'Важно: счёт оплачен');
});

test('адрес письма и треда', () => {
    assert.equal(messageHash({ id: '123', isThread: false }), '#message/123');
    assert.equal(messageHash({ id: '456', isThread: true }), '#thread/t456');
});

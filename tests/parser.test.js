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

test('другая вложенность тегов разбирается так же', () => {
    const messages = parseUnreadMessages(fixture('inbox-legacy-markup.html'));
    assert.deepEqual(
        messages.map((m) => [m.id, m.isThread, m.from, m.subject]),
        [
            ['192247409093380563', false, '"Рога & Копыта"', 'Заказ №1234 передан курьеру — сегодня'],
            ['192247409093380553', true, 'Иван Смирнов', 'Отчёт за октябрь'],
            ['192247409093380540', false, 'Анна Петрова', 'Встреча в четверг']
        ]
    );
});

test('больше тысячи писем: числа с разделителями разрядов', () => {
    const html = fixture('inbox-many.html');
    assert.equal(parseUnreadCount(html), 1234);
    // Без числа в заголовке — счётчик из списка папок («1,234»)
    assert.equal(parseUnreadCount(html.replace(/\(1 234[^)]*\)/, '')), 1234);
    assert.equal(parseUnreadCount('<title>Входящие (12\u00a0345 новых)</title><div class="b-messages"></div>'), 12345);
});

test('счётчик из списка папок, если в заголовке его нет', () => {
    const html = fixture('inbox-unread.html').replace('Входящие (3 новых письма)', 'Входящие');
    assert.equal(parseUnreadCount(html), 3);
    // Счётчик других папок («Спам») не путается со счётчиком «Входящих»
    assert.equal(parseUnreadCount(fixture('inbox-empty.html')), 0);
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

test('запасной способ подсчёта: непрочитанные письма на странице', () => {
    const body = '<a href="/lite/inbox"></a><div class="b-messages"></div>';
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

test('адрес письма; для треда проверенного адреса нет — открывается почта', () => {
    assert.equal(messageHash({ id: '123', isThread: false }), '#/message/123');
    assert.equal(messageHash({ id: '456', isThread: true }), null);
});

test('настоящая разметка lite-версии на компьютере: треды, вложенные span у отправителя и темы', () => {
    const html = fixture('inbox-desktop.html');
    const messages = parseUnreadMessages(html);
    assert.deepEqual(messages, [
        { id: '159596311794942776', isThread: true, from: 'Яндекс ID', subject: 'Вход в аккаунт' },
        { id: '177892185281136346', isThread: true, from: 'Google', subject: 'Мы обновляем Условия использования' }
    ]);
    assert.equal(parseUnreadCount(html, messages), 75);
});

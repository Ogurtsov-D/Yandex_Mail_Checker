// Адреса выбранной почты: mail.yandex.ru, mail.yandex.com, Яндекс 360…
import { ext } from './api.js';
import {
    ACCOUNTS_PATH,
    COUNTERS_PATH,
    DEFAULT_MAIL_HOST,
    INBOX_PATH,
    MAIL_HOSTS,
    MAIL_TAB_PATTERN_TEMPLATE,
    MAIL_URL_TEMPLATE
} from './config.js';

export const isMailHost = (host) => MAIL_HOSTS.includes(host);

// Шаблон разрешения на доступ к домену почты: https://mail.yandex.com/*
export const hostOrigin = (host) => `https://${host}/*`;

// Адреса почты на домене host
export function urlsFor(host) {
    const base = MAIL_URL_TEMPLATE.replace('{host}', host);
    return {
        host,
        base,
        tabPattern: MAIL_TAB_PATTERN_TEMPLATE.replace('{host}', host),
        counters: base + COUNTERS_PATH,
        accounts: base + ACCOUNTS_PATH,
        inbox: base + INBOX_PATH
    };
}

// Адреса почты, выбранной в настройках
export async function mailUrls() {
    const { mailHost } = await ext.storage.local.get('mailHost');
    return urlsFor(isMailHost(mailHost) ? mailHost : DEFAULT_MAIL_HOST);
}

// Есть ли у расширения доступ к домену (для mail.yandex.ru — всегда, остальные пользователь мог отозвать)
export async function hasHostAccess(host) {
    if (host === DEFAULT_MAIL_HOST || !ext.permissions) return true;
    return ext.permissions.contains({ origins: [hostOrigin(host)] });
}

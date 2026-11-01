// Системные уведомления о новых письмах
import { ext, IS_FIREFOX } from './api.js';
import { MAX_NOTIFICATION_ITEMS } from './config.js';
import { newMailTitle } from './format.js';
import { t } from './i18n.js';
import { messageHash } from './parser.js';
import { getSettings, isQuietTime } from './settings.js';
import { iconPath } from './status.js';

const NOTIFICATION_PREFIX = 'new-mail';

// У каждого аккаунта своё уведомление, иначе письмо в одном ящике скрывало бы письмо в другом.
// account — { uid, label }, когда аккаунтов несколько; null — аккаунт один
export function notificationId(account) {
    return account ? `${NOTIFICATION_PREFIX}:${account.uid}` : NOTIFICATION_PREFIX;
}

export function isMailNotification(id) {
    return id === NOTIFICATION_PREFIX || id.startsWith(`${NOTIFICATION_PREFIX}:`);
}

// hash — письмо, которое откроется по клику (null — просто почта)
async function show(options, hash, account) {
    const settings = await getSettings();
    if (!settings.notificationsEnabled || isQuietTime(settings)) return;

    const id = notificationId(account);
    const { notificationTargets = {} } = await ext.storage.session.get('notificationTargets');
    notificationTargets[id] = { hash: hash ?? null, uid: account?.uid ?? null };
    await ext.storage.session.set({ notificationTargets });

    options = { ...options, iconUrl: ext.runtime.getURL(iconPath(128, settings.classicIcon).slice(1)) };
    // Несколько аккаунтов — подписываем, в какой ящик пришло письмо
    if (account) options.contextMessage = account.label;

    if (IS_FIREFOX) {
        // Firefox поддерживает только type: 'basic' и не знает priority и contextMessage
        const { priority, items, contextMessage, ...rest } = options;
        if (options.type === 'list') {
            rest.type = 'basic';
            rest.message = items.map((i) => `${i.title}: ${i.message}`).join('\n');
        }
        if (contextMessage) rest.message = `${rest.message}\n${contextMessage}`;
        options = rest;
    } else {
        // Звук уведомления отключается только в Chrome: в Firefox его задаёт система
        options.silent = !settings.soundEnabled;
    }

    await ext.notifications.create(id, options);
}

// Уведомление о новых письмах с отправителем и темой.
// total — сколько всего пришло писем: часть могла попасть не во «Входящие», и деталей о них нет
export async function notifyNewMessages(messages, total = messages.length, account = null) {
    if (total === 1) {
        const [m] = messages;
        await show(
            {
                type: 'basic',
                title: m.from || t('newMessage'),
                message: m.subject || t('noSubject'),
                priority: 1
            },
            messageHash(m),
            account
        );
        return;
    }

    await show(
        {
            type: 'list',
            title: newMailTitle(total),
            message: '',
            items: messages.slice(0, MAX_NOTIFICATION_ITEMS).map((m) => ({
                title: m.from || t('unknownSender'),
                message: m.subject || t('noSubject')
            })),
            priority: 1
        },
        null,
        account
    );
}

// Запасное уведомление, когда детали писем разобрать не удалось
export async function notifyNewCount(count, account = null) {
    await show(
        {
            type: 'basic',
            title: newMailTitle(count),
            message: t('openMailToView'),
            priority: 1
        },
        null,
        account
    );
}

// Куда вести по клику на уведомление: { hash, uid } (hash null — просто почта, uid null — аккаунт один)
export async function getNotificationTarget(id) {
    const { notificationTargets = {} } = await ext.storage.session.get('notificationTargets');
    return notificationTargets[id] ?? { hash: null, uid: null };
}

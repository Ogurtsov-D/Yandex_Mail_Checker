// Системные уведомления о новых письмах
import { ext, IS_FIREFOX } from './api.js';
import { MAX_NOTIFICATION_ITEMS } from './config.js';
import { newMailTitle } from './format.js';
import { t } from './i18n.js';
import { messageHash } from './parser.js';
import { getSettings, isQuietTime } from './settings.js';
import { iconPath } from './status.js';

export const NOTIFICATION_ID = 'new-mail';

// target — hash письма, которое откроется по клику (null — просто открыть почту)
async function show(options, target) {
    const settings = await getSettings();
    if (!settings.notificationsEnabled || isQuietTime(settings)) return;

    await ext.storage.session.set({ notificationTarget: target ?? null });
    options = { ...options, iconUrl: ext.runtime.getURL(iconPath(128, settings.classicIcon).slice(1)) };

    if (IS_FIREFOX) {
        // Firefox поддерживает только type: 'basic' и не знает priority
        const { priority, items, ...rest } = options;
        if (options.type === 'list') {
            rest.type = 'basic';
            rest.message = items.map((i) => `${i.title}: ${i.message}`).join('\n');
        }
        options = rest;
    } else {
        // Звук уведомления отключается только в Chrome: в Firefox его задаёт система
        options.silent = !settings.soundEnabled;
    }

    await ext.notifications.create(NOTIFICATION_ID, options);
}

// Уведомление о новых письмах с отправителем и темой.
// total — сколько всего пришло писем: часть могла попасть не во «Входящие», и деталей о них нет
export async function notifyNewMessages(messages, total = messages.length) {
    if (total === 1) {
        const [m] = messages;
        await show(
            {
                type: 'basic',
                title: m.from || t('newMessage'),
                message: m.subject || t('noSubject'),
                priority: 1
            },
            messageHash(m)
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
        null
    );
}

// Запасное уведомление, когда детали писем разобрать не удалось
export async function notifyNewCount(count) {
    await show(
        {
            type: 'basic',
            title: newMailTitle(count),
            message: t('openMailToView'),
            priority: 1
        },
        null
    );
}

// Куда вести по клику на уведомление (hash письма или null)
export async function getNotificationTarget() {
    const { notificationTarget } = await ext.storage.session.get('notificationTarget');
    return notificationTarget ?? null;
}

// Состояние последней проверки и его отображение на иконке (бейдж + подсказка)
import { ext } from './api.js';
import { BADGE_COLOR } from './config.js';
import { badgeText, tooltipText } from './format.js';
import { t } from './i18n.js';

const STATE_KEYS = ['unreadCount', 'freshCount', 'errorType', 'errorStatus', 'lastCheck', 'lastSuccess'];

export async function loadState() {
    return ext.storage.local.get(STATE_KEYS);
}

export async function renderStatus(state) {
    await Promise.all([
        ext.action.setBadgeText({ text: badgeText(state) }),
        ext.action.setBadgeBackgroundColor({ color: BADGE_COLOR }),
        ext.action.setTitle({ title: tooltipText(state) })
    ]);
}

// Индикатор ручной проверки
export async function renderChecking() {
    await Promise.all([
        ext.action.setBadgeText({ text: '↻' }),
        ext.action.setBadgeBackgroundColor({ color: BADGE_COLOR }),
        ext.action.setTitle({ title: t('checking') })
    ]);
}

// Состояние последней проверки и его отображение на иконке (бейдж + подсказка)
import { ext } from './api.js';
import { BADGE_COLOR } from './config.js';
import { badgeText, tooltipText } from './format.js';
import { t } from './i18n.js';
import { getSettings } from './settings.js';

const STATE_KEYS = ['unreadCount', 'freshCount', 'errorType', 'errorStatus', 'lastCheck', 'lastSuccess'];

export async function loadState() {
    return ext.storage.local.get(STATE_KEYS);
}

// Путь к иконке нужного размера с учётом выбранного вида
export function iconPath(size, classic) {
    return `/icons/${classic ? 'classic/' : ''}icon${size}.png`;
}

async function applyIcon(classic) {
    await ext.action.setIcon({ path: { 16: iconPath(16, classic), 32: iconPath(32, classic) } });
}

export async function renderStatus(state) {
    const { badgeMode, classicIcon } = await getSettings();
    await Promise.all([
        applyIcon(classicIcon),
        ext.action.setBadgeText({ text: badgeText(state, badgeMode) }),
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

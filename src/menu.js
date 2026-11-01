// Контекстное меню на иконке расширения (правый клик)
import { ext, IS_FIREFOX } from './api.js';
import { checkMail } from './checker.js';
import { INTERVALS } from './config.js';
import { plural, t } from './i18n.js';
import { getSettings, saveSettings, setCheckInterval } from './settings.js';

const CHECK_NOW = 'check-now';
const INTERVAL_MENU = 'interval';
const BADGE_MENU = 'badge';
const NOTIFICATIONS_MENU = 'notifications-menu';
const NOTIFICATIONS = 'notifications';
const SOUND = 'sound';
const QUIET_HOURS = 'quiet-hours';
const OPTIONS = 'options';
const intervalItemId = (minutes) => `interval-${minutes}`;
const BADGE_MODES = { 'badge-unread': 'unread', 'badge-fresh': 'fresh' };

function create(props) {
    ext.contextMenus.create({ contexts: ['action'], ...props });
}

async function build() {
    const settings = await getSettings();

    await ext.contextMenus.removeAll();

    // В меню иконки браузер показывает не больше 6 пунктов верхнего уровня (вместе с разделителями)
    create({ id: CHECK_NOW, title: t('menuCheckNow') });
    create({ id: 'separator-1', type: 'separator' });

    create({ id: INTERVAL_MENU, title: t('menuInterval') });
    for (const minutes of INTERVALS) {
        create({
            id: intervalItemId(minutes),
            parentId: INTERVAL_MENU,
            type: 'radio',
            checked: minutes === settings.interval,
            title: plural('minutes', minutes)
        });
    }

    create({ id: BADGE_MENU, title: t('menuBadge') });
    for (const [id, mode] of Object.entries(BADGE_MODES)) {
        create({
            id,
            parentId: BADGE_MENU,
            type: 'radio',
            checked: settings.badgeMode === mode,
            title: t(mode === 'fresh' ? 'menuBadgeFresh' : 'menuBadgeUnread')
        });
    }

    create({ id: NOTIFICATIONS_MENU, title: t('menuNotifications') });
    create({
        id: NOTIFICATIONS,
        parentId: NOTIFICATIONS_MENU,
        type: 'checkbox',
        checked: settings.notificationsEnabled,
        title: t('menuShowNotifications')
    });
    if (!IS_FIREFOX) {
        // В Firefox звук уведомлений задаёт система, расширение им не управляет
        create({
            id: SOUND,
            parentId: NOTIFICATIONS_MENU,
            type: 'checkbox',
            checked: settings.soundEnabled,
            enabled: settings.notificationsEnabled,
            title: t('menuSound')
        });
    }
    create({
        id: QUIET_HOURS,
        parentId: NOTIFICATIONS_MENU,
        type: 'checkbox',
        checked: settings.quietHoursEnabled,
        enabled: settings.notificationsEnabled,
        title: t('menuQuietHours', settings.quietFrom, settings.quietTo)
    });

    // Chrome сам добавляет в меню иконки пункт «Параметры», Firefox — нет
    if (IS_FIREFOX) create({ id: OPTIONS, title: t('menuOptions') });
}

// Пересоздать меню с текущими настройками. Вызовы выстраиваются в очередь:
// одновременные removeAll/create дали бы ошибки повторяющихся id
let pending = Promise.resolve();
export function createContextMenu() {
    pending = pending.then(build, build);
    return pending;
}

export async function handleMenuClick(info) {
    const id = String(info.menuItemId);
    // Галочки и переключатели браузер переключает сам, info.checked — новое состояние.
    // Меню пересоздаётся по storage.onChanged (см. background.js)
    if (id === CHECK_NOW) {
        await checkMail({ manual: true });
    } else if (id === NOTIFICATIONS) {
        await saveSettings({ notificationsEnabled: info.checked });
    } else if (id === SOUND) {
        await saveSettings({ soundEnabled: info.checked });
    } else if (id === QUIET_HOURS) {
        await saveSettings({ quietHoursEnabled: info.checked });
    } else if (id === OPTIONS) {
        await ext.runtime.openOptionsPage();
    } else if (BADGE_MODES[id]) {
        await saveSettings({ badgeMode: BADGE_MODES[id] });
    } else {
        const minutes = INTERVALS.find((m) => intervalItemId(m) === id);
        if (minutes) await setCheckInterval(minutes);
    }
}

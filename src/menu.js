// Контекстное меню на иконке расширения (правый клик)
import { ext } from './api.js';
import { checkMail } from './checker.js';
import { INTERVALS } from './config.js';
import { pluralize } from './format.js';
import { getSettings, setCheckInterval, setNotificationsEnabled } from './settings.js';

const CHECK_NOW = 'check-now';
const INTERVAL_MENU = 'interval';
const NOTIFICATIONS = 'notifications';
const intervalItemId = (minutes) => `interval-${minutes}`;

function create(props) {
    ext.contextMenus.create({ contexts: ['action'], ...props });
}

// Пересоздать меню с текущими настройками (операция идемпотентна)
export async function createContextMenu() {
    const { interval, notificationsEnabled } = await getSettings();

    await ext.contextMenus.removeAll();

    create({ id: CHECK_NOW, title: 'Проверить сейчас' });
    create({ id: 'separator-1', type: 'separator' });

    create({ id: INTERVAL_MENU, title: 'Интервал проверки' });
    for (const minutes of INTERVALS) {
        create({
            id: intervalItemId(minutes),
            parentId: INTERVAL_MENU,
            type: 'radio',
            checked: minutes === interval,
            title: `${minutes} ${pluralize(minutes, 'минута', 'минуты', 'минут')}`
        });
    }

    create({ id: 'separator-2', type: 'separator' });
    create({
        id: NOTIFICATIONS,
        type: 'checkbox',
        checked: notificationsEnabled,
        title: 'Уведомления о новых письмах'
    });
}

export async function handleMenuClick(info) {
    const id = String(info.menuItemId);

    if (id === CHECK_NOW) {
        await checkMail({ manual: true });
    } else if (id === NOTIFICATIONS) {
        // Галочку браузер переключает сам, info.checked — новое состояние
        await setNotificationsEnabled(info.checked);
    } else {
        const minutes = INTERVALS.find((m) => intervalItemId(m) === id);
        if (minutes) await setCheckInterval(minutes);
    }
}

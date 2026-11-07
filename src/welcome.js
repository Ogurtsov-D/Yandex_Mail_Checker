// Страница приветствия: открывается один раз, при установке. Три шага — закрепить значок,
// войти в почту, выбрать главные настройки; шаги отмечаются сами, когда выполнены
import { ext } from './api.js';
import { t } from './i18n.js';
import { getSettings, saveSettings } from './settings.js';
import { mountHostSelect } from './host-select.js';
import { mountStatus } from './status-view.js';

document.documentElement.lang = t('locale');
document.documentElement.dir = t('@@bidi_dir') || 'ltr';
for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
}

const $ = (id) => document.getElementById(id);
const settings = await getSettings();

// Шаг 1. Закреплён ли значок на панели, браузер сообщает через action.getUserSettings
// (Chrome и Edge 91+, Firefox 118+); если не умеет — просто подсказка, без галочки
$('pinHint').textContent = t('welcomePinHint', t('brandName'));
async function updatePin() {
    const userSettings = await (ext.action.getUserSettings?.() ?? Promise.resolve(null)).catch(() => null);
    if (!userSettings) return;
    const pinned = userSettings.isOnToolbar === true;
    $('stepPin').classList.toggle('done', pinned);
    $('pinDone').hidden = !pinned;
    $('pinDemo').hidden = pinned;
}
updatePin();
setInterval(updatePin, 1500);

// Шаг 2. Вход в почту: адрес почты (mail.yandex.ru, .com, Яндекс 360…) и состояние последней проверки;
// шаг выполнен, когда проверка прошла успешно. Смена адреса сразу запускает проверку (background.js)
await mountHostSelect($('mailHost'));
await mountStatus($('status'), (state, status) => {
    $('stepMail').classList.toggle('done', status.kind === 'ok');
});
// Сразу после установки проверка уже идёт; если результата ещё нет — запросить
if (!(await ext.storage.local.get('lastCheck')).lastCheck) ext.runtime.sendMessage({ type: 'checkNow' });

// Шаг 3. Главные настройки — те же, что на странице настроек
$('notificationsEnabled').checked = settings.notificationsEnabled;
$('notificationsEnabled').addEventListener('change', () =>
    saveSettings({ notificationsEnabled: $('notificationsEnabled').checked })
);

function choices(container, name, options, current) {
    for (const [value, key] of options) {
        const label = document.createElement('label');
        label.className = 'choice';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = name;
        radio.value = value;
        radio.checked = current === value;
        radio.addEventListener('change', () => saveSettings({ [name]: value }));
        const text = document.createElement('span');
        text.textContent = t(key);
        label.append(radio, text);
        container.append(label);
    }
}
choices(
    $('badgeModes'),
    'badgeMode',
    [
        ['unread', 'menuBadgeUnread'],
        ['fresh', 'menuBadgeFresh']
    ],
    settings.badgeMode
);
choices(
    $('openModes'),
    'openIn',
    [
        ['tab', 'optionsOpenTab'],
        ['window', 'optionsOpenWindow']
    ],
    settings.openIn
);

$('allSettings').addEventListener('click', (event) => {
    event.preventDefault();
    ext.runtime.openOptionsPage();
});

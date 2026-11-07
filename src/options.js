// Страница настроек: всё, что есть в меню иконки, и то, что в меню не помещается
import { ext, IS_FIREFOX } from './api.js';
import {
    BADGE_COLORS,
    DEFAULT_BADGE_COLOR,
    DEFAULT_BADGE_TEXT_COLOR,
    ICON_STYLES,
    INTERVALS,
    ISSUES_URL
} from './config.js';
import { unreadText } from './format.js';
import { mountHostSelect } from './host-select.js';
import { plural, t } from './i18n.js';
import { reviewUrl } from './links.js';
import { getSettings, saveSettings, setCheckInterval } from './settings.js';
import { iconPath } from './status.js';
import { mountStatus } from './status-view.js';

document.documentElement.lang = t('locale');
document.documentElement.dir = t('@@bidi_dir') || 'ltr';
for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
}

const $ = (id) => document.getElementById(id);
const settings = await getSettings();

// Что сейчас с почтой: результат последней проверки, «Проверить сейчас», «Открыть почту»
mountStatus($('status'));

// Галочки: сразу сохраняются; звук и тихие часы неактивны, когда уведомления выключены
const CHECKBOXES = ['notificationsEnabled', 'soundEnabled', 'quietHoursEnabled', 'pauseWhenIdle'];
function updateDependent() {
    const off = !settings.notificationsEnabled;
    $('soundEnabled').disabled = off;
    $('quietHoursEnabled').disabled = off;
    $('soundRow').classList.toggle('off', off);
    $('quietHoursEnabled').closest('label').classList.toggle('off', off);
    for (const input of $('quietTimes').querySelectorAll('input')) input.disabled = off || !settings.quietHoursEnabled;
}
for (const id of CHECKBOXES) {
    $(id).checked = settings[id];
    $(id).addEventListener('change', () => {
        settings[id] = $(id).checked;
        saveSettings({ [id]: settings[id] });
        updateDependent();
    });
}
// В Firefox звук уведомлений задаёт система
$('soundRow').hidden = IS_FIREFOX;
for (const id of ['quietFrom', 'quietTo']) {
    $(id).value = settings[id];
    $(id).addEventListener('change', () => {
        if ($(id).checkValidity() && $(id).value) saveSettings({ [id]: $(id).value });
    });
}
updateDependent();

// Интервал проверки: будильник пересоздаётся сразу
for (const minutes of INTERVALS) {
    $('interval').append(new Option(plural('minutes', minutes), minutes));
}
$('interval').value = settings.interval;
$('interval').addEventListener('change', () => setCheckInterval(Number($('interval').value)));

// Адрес почты (src/host-select.js)
await mountHostSelect($('mailHost'));

// Карточка выбора: радиокнопка внутри label, содержимое — узлы content
function choice(name, value, checked, content, onChange) {
    const label = document.createElement('label');
    label.className = 'choice';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = name;
    radio.value = value;
    radio.checked = checked;
    radio.addEventListener('change', onChange);
    label.append(radio, ...content);
    return label;
}
const text = (value) => Object.assign(document.createElement('span'), { textContent: value });

// Где открывать почту, если она ещё не открыта
for (const radio of document.querySelectorAll('input[name="openIn"]')) {
    radio.checked = settings.openIn === radio.value;
    radio.addEventListener('change', () => saveSettings({ openIn: radio.value }));
}

// Что показывать на значке
const BADGE_MODES = { unread: 'menuBadgeUnread', fresh: 'menuBadgeFresh' };
for (const [mode, key] of Object.entries(BADGE_MODES)) {
    $('badgeModes').append(
        choice('badgeMode', mode, settings.badgeMode === mode, [text(t(key))], () => saveSettings({ badgeMode: mode }))
    );
}

// Вид значка на панели: образец и название каждого вида
const ICON_NAMES = {
    classic: 'iconClassic',
    minimal: 'iconMinimal',
    blue: 'iconBlue',
    green: 'iconGreen',
    purple: 'iconPurple'
};
for (const style of ICON_STYLES) {
    const image = document.createElement('img');
    image.src = `..${iconPath(32, style)}`;
    image.width = image.height = 32;
    image.alt = '';
    $('iconStyles').append(
        choice('iconStyle', style, settings.iconStyle === style, [image, text(t(ICON_NAMES[style]))], () => {
            settings.iconStyle = style;
            saveSettings({ iconStyle: style });
            updatePreview();
        })
    );
}

// Цвет счётчика: готовые цвета и свой. Образец показывает значок с числом
function updatePreview() {
    $('previewIcon').src = `..${iconPath(128, settings.iconStyle)}`;
    $('previewBadge').style.background = settings.badgeColor;
    $('previewBadge').style.color = settings.badgeTextColor;
    for (const swatch of document.querySelectorAll('.swatch')) {
        const key = swatch.dataset.key;
        // Свой цвет отмечен, когда выбранного цвета нет среди готовых
        const pressed = swatch.dataset.color
            ? settings[key] === swatch.dataset.color
            : !swatch.parentElement.querySelector(`[data-color="${settings[key]}"]`);
        swatch.setAttribute('aria-pressed', String(pressed));
    }
    $('badgeColorCustom').value = settings.badgeColor;
    $('badgeTextColorCustom').value = settings.badgeTextColor;
}
function setColor(key, color) {
    settings[key] = color;
    saveSettings({ [key]: color });
    updatePreview();
}
function palette(container, key, colors) {
    for (const color of colors) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'swatch';
        button.style.background = color;
        button.title = color;
        button.dataset.key = key;
        button.dataset.color = color;
        button.addEventListener('click', () => setColor(key, color));
        container.append(button);
    }
    const wrapper = document.createElement('label');
    wrapper.className = 'swatch custom';
    wrapper.title = t('optionsCustomColor');
    wrapper.dataset.key = key;
    const custom = document.createElement('input');
    custom.type = 'color';
    custom.id = `${key}Custom`;
    custom.setAttribute('aria-label', t('optionsCustomColor'));
    custom.addEventListener('change', () => setColor(key, custom.value));
    wrapper.append(custom);
    container.append(wrapper);
}
palette($('backgroundPalette'), 'badgeColor', BADGE_COLORS);
palette($('textPalette'), 'badgeTextColor', ['#ffffff', '#000000']);
$('resetColors').addEventListener('click', () => {
    setColor('badgeColor', DEFAULT_BADGE_COLOR);
    setColor('badgeTextColor', DEFAULT_BADGE_TEXT_COLOR);
});
updatePreview();

// Несколько аккаунтов: имя (видно в меню, подсказке и уведомлениях) и учитывать ли аккаунт
const { accountList = [], accountEmails = {} } = await ext.storage.local.get(['accountList', 'accountEmails']);
if (accountList.length > 1) {
    $('accounts').hidden = false;
    for (const [index, { uid, unread }] of accountList.entries()) {
        const row = document.createElement('label');
        row.className = 'sub';
        const counted = document.createElement('input');
        counted.type = 'checkbox';
        counted.checked = !settings.disabledAccounts.includes(uid);
        counted.addEventListener('change', () => {
            const others = settings.disabledAccounts.filter((x) => x !== uid);
            settings.disabledAccounts = counted.checked ? others : [...others, uid];
            saveSettings({ disabledAccounts: settings.disabledAccounts });
        });
        const name = document.createElement('input');
        name.type = 'text';
        name.maxLength = 40;
        name.placeholder = accountEmails[uid] ?? t('accountNumber', index + 1);
        name.value = settings.accountNames[uid] ?? '';
        name.addEventListener('change', () => {
            const value = name.value.trim();
            if (value) settings.accountNames[uid] = value;
            else delete settings.accountNames[uid];
            saveSettings({ accountNames: { ...settings.accountNames } });
        });
        const count = document.createElement('span');
        count.className = 'hint';
        count.textContent = unreadText(unread);
        row.append(counted, name, count);
        $('accountList').append(row);
    }
}

// Горячая клавиша открытия почты: её можно переназначить в настройках браузера
const commands = (await ext.commands?.getAll?.()) ?? [];
const shortcut = commands.find((c) => c.name === '_execute_action')?.shortcut;
$('shortcut').textContent = shortcut || t('optionsShortcutNone');

// Подвал: версия, оценка в магазине, сообщение об ошибке
$('version').textContent = t('optionsVersion', ext.runtime.getManifest().version);
$('rate').href = reviewUrl({ id: ext.runtime.id, isFirefox: IS_FIREFOX, userAgent: navigator.userAgent });
$('report').href = ISSUES_URL;

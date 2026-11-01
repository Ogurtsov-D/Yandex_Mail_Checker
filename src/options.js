// Страница настроек: то, что неудобно задавать в меню иконки
import { ext } from './api.js';
import { DEFAULT_MAIL_HOST, MAIL_HOSTS } from './config.js';
import { unreadText } from './format.js';
import { hostOrigin } from './hosts.js';
import { t } from './i18n.js';
import { getSettings, saveSettings } from './settings.js';

document.documentElement.lang = t('locale');
document.documentElement.dir = t('@@bidi_dir') || 'ltr';
for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
}

const $ = (id) => document.getElementById(id);
const settings = await getSettings();

for (const id of ['quietHoursEnabled', 'pauseWhenIdle', 'classicIcon']) {
    $(id).checked = settings[id];
    $(id).addEventListener('change', () => saveSettings({ [id]: $(id).checked }));
}
for (const id of ['quietFrom', 'quietTo']) {
    $(id).value = settings[id];
    $(id).addEventListener('change', () => {
        if ($(id).checkValidity() && $(id).value) saveSettings({ [id]: $(id).value });
    });
}

// Адрес почты. Доступ к доменам, кроме mail.yandex.ru, браузер выдаёт по запросу —
// запрос должен прозвучать сразу в ответ на действие пользователя, поэтому он в обработчике change
const select = $('mailHost');
for (const host of MAIL_HOSTS) {
    const option = document.createElement('option');
    option.value = host;
    option.textContent = host === 'mail.360.yandex.ru' ? `${host} — ${t('optionsMailHost360')}` : host;
    select.append(option);
}
select.value = settings.mailHost;
select.addEventListener('change', async () => {
    const previous = settings.mailHost;
    const host = select.value;
    const granted = host === DEFAULT_MAIL_HOST || (await ext.permissions.request({ origins: [hostOrigin(host)] }));
    if (!granted) {
        select.value = previous;
        return;
    }
    settings.mailHost = host;
    await saveSettings({ mailHost: host });
    // Доступ к прежнему домену больше не нужен — отдаём его обратно
    if (previous !== DEFAULT_MAIL_HOST) await ext.permissions.remove({ origins: [hostOrigin(previous)] });
});

// Несколько аккаунтов: имя (видно в меню, подсказке и уведомлениях) и учитывать ли аккаунт
const { accountList = [] } = await ext.storage.local.get('accountList');
if (accountList.length > 1) {
    $('accounts').hidden = false;
    for (const [index, { uid, unread }] of accountList.entries()) {
        const row = document.createElement('label');
        row.className = 'row';
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
        name.placeholder = t('accountNumber', index + 1);
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

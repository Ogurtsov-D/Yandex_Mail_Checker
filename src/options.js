// Страница настроек: то, что неудобно задавать в меню иконки
import { ext } from './api.js';
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

// Горячая клавиша открытия почты: её можно переназначить в настройках браузера
const commands = (await ext.commands?.getAll?.()) ?? [];
const shortcut = commands.find((c) => c.name === '_execute_action')?.shortcut;
$('shortcut').textContent = shortcut || t('optionsShortcutNone');

// Выбор адреса почты (настройки, приветствие). Доступ к доменам, кроме mail.yandex.ru, браузер
// выдаёт по запросу — запрос должен прозвучать сразу в ответ на действие пользователя,
// поэтому он в обработчике change; доступ к прежнему домену отдаём обратно
import { ext } from './api.js';
import { DEFAULT_MAIL_HOST, MAIL_HOSTS } from './config.js';
import { hostOrigin } from './hosts.js';
import { t } from './i18n.js';
import { getSettings, saveSettings } from './settings.js';

export async function mountHostSelect(select) {
    let current = (await getSettings()).mailHost;
    for (const host of MAIL_HOSTS) {
        select.append(new Option(host === 'mail.360.yandex.ru' ? `${host} — ${t('optionsMailHost360')}` : host, host));
    }
    select.value = current;
    select.addEventListener('change', async () => {
        const host = select.value;
        const granted = host === DEFAULT_MAIL_HOST || (await ext.permissions.request({ origins: [hostOrigin(host)] }));
        if (!granted) {
            select.value = current;
            return;
        }
        const previous = current;
        current = host;
        await saveSettings({ mailHost: host });
        if (previous !== DEFAULT_MAIL_HOST) await ext.permissions.remove({ origins: [hostOrigin(previous)] });
    });
}

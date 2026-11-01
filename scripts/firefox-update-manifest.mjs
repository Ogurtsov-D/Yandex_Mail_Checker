// updates.json для тех, кто установил версию 1.4.x из файла .xpi со страницы релизов.
// В тех версиях в манифесте записан update_url (последний релиз: .../releases/latest/download/updates.json):
// Firefox периодически скачивает этот файл и, если версия новее, ставит файл по ссылке update_link.
// С версии 1.5.0 расширение публикуется в каталоге addons.mozilla.org, поэтому ссылка ведёт на файл
// из каталога: установив его, Firefox дальше обновляет расширение через каталог.
//
// Использование: node scripts/firefox-update-manifest.mjs 1.5.0 > dist/updates.json
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const repoUrl = manifest.homepage_url;
const addonId = manifest.browser_specific_settings.gecko.id;

// Адрес, который проверяют версии 1.4.x
export const UPDATE_URL = `${repoUrl}/releases/latest/download/updates.json`;

// Последняя опубликованная в каталоге версия
export const AMO_LATEST_URL = `https://addons.mozilla.org/firefox/downloads/latest/${encodeURIComponent(addonId)}/latest.xpi`;

export function updateManifest(version) {
    return {
        addons: {
            [addonId]: {
                updates: [{ version, update_link: AMO_LATEST_URL }]
            }
        }
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const version = process.argv[2];
    if (!version) {
        console.error('Укажите версию: node scripts/firefox-update-manifest.mjs 1.5.0');
        process.exit(1);
    }
    console.log(JSON.stringify(updateManifest(version), null, 2));
}

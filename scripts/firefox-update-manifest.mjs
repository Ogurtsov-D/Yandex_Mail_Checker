// updates.json для автообновления Firefox-версии, распространяемой через GitHub Releases.
// Firefox периодически скачивает этот файл по адресу update_url из манифеста
// (последний релиз: .../releases/latest/download/updates.json) и, если версия новее,
// устанавливает подписанный .xpi по ссылке update_link.
//
// Использование: node scripts/firefox-update-manifest.mjs 1.4.1 > dist/updates.json
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const repoUrl = manifest.homepage_url;

// Имя подписанного файла в релизе
export function xpiName(version) {
    return `yandex-mail-checker-${version}-firefox.xpi`;
}

// Адрес, который Firefox будет проверять на обновления
export const UPDATE_URL = `${repoUrl}/releases/latest/download/updates.json`;

export function updateManifest(version) {
    return {
        addons: {
            [manifest.browser_specific_settings.gecko.id]: {
                updates: [
                    {
                        version,
                        update_link: `${repoUrl}/releases/download/v${version}/${xpiName(version)}`
                    }
                ]
            }
        }
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const version = process.argv[2];
    if (!version) {
        console.error('Укажите версию: node scripts/firefox-update-manifest.mjs 1.4.1');
        process.exit(1);
    }
    console.log(JSON.stringify(updateManifest(version), null, 2));
}

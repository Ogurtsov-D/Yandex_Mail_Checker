// Печатает раздел CHANGELOG.md для указанной версии — текст описания релиза на GitHub.
// Использование: node scripts/release-notes.mjs 1.4.0
import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
    console.error('Укажите версию: node scripts/release-notes.mjs 1.4.0');
    process.exit(1);
}

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const sections = changelog.split(/^## /m);
const section = sections.find((s) => s.startsWith(`[${version}]`));
if (!section) {
    console.error(`В CHANGELOG.md нет раздела [${version}]`);
    process.exit(1);
}

const body = section
    .split('\n')
    .slice(1)
    .filter((line) => !/^\[[\d.]+\]: /.test(line))
    .join('\n')
    .trim();

const install =
    '\n\n---\n\n**Установка:** [Chrome Web Store](https://chromewebstore.google.com/detail/gkpnpejbpnldkkeoeapjdilknlmojoon) · ' +
    '[Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/pncdgkochfhddiclomicdbbhfgoeamcm) · ' +
    '[каталог дополнений Firefox](https://addons.mozilla.org/firefox/addon/yandex_mail_checker/). ' +
    'Новая версия появляется в магазинах после их проверки; установленное расширение обновится само. ' +
    'Архивы ниже — для установки без магазина.';

console.log(body + install);

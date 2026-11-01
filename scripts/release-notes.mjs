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
    '\n\n---\n\n**Установка:** Firefox — из каталога дополнений Firefox (версия появляется там после проверки Mozilla); ' +
    'Chrome и браузеры на его основе — архив `…-chrome.zip` ниже. Подробнее — в ' +
    '[инструкции в README](https://github.com/Ogurtsov-D/Yandex_Mail_Checker#установка).';

console.log(body + install);

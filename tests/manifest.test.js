// Целостность проекта: версии совпадают, файлы на месте, иконки нужных размеров
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const manifest = JSON.parse(read('manifest.json'));

test('версия одинакова в manifest.json, package.json и CHANGELOG.md', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.equal(manifest.version, pkg.version);
    const latest = read('CHANGELOG.md').match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
    assert.equal(latest, manifest.version, 'первая версия в CHANGELOG.md должна совпадать с manifest.json');
});

test('все файлы из манифеста существуют', () => {
    const files = [
        manifest.background.service_worker,
        ...manifest.background.scripts,
        ...Object.values(manifest.icons),
        ...Object.values(manifest.action.default_icon)
    ];
    for (const file of files) assert.ok(existsSync(new URL(file, root)), `нет файла ${file}`);
});

test('размер иконок соответствует имени (Chrome Web Store требует 128×128), у каждого вида значка — 16, 32 и 128', async () => {
    const { ICON_STYLES } = await import('../src/config.js');
    const files = Object.entries(manifest.icons);
    for (const style of ICON_STYLES) {
        for (const size of [16, 32, 128]) files.push([size, `icons/${style}/icon${size}.png`]);
    }
    for (const [size, file] of files) {
        const png = readFileSync(new URL(file, root));
        assert.equal(png.toString('latin1', 1, 4), 'PNG', `${file} — не PNG`);
        const width = png.readUInt32BE(16);
        const height = png.readUInt32BE(20);
        assert.deepEqual([width, height], [Number(size), Number(size)], `${file}: ${width}×${height}`);
    }
});

test('название и описание укладываются в ограничения магазинов на всех языках', async () => {
    const { readdirSync } = await import('node:fs');
    for (const locale of readdirSync(new URL('_locales/', root))) {
        const messages = JSON.parse(read(`_locales/${locale}/messages.json`));
        // Chrome Web Store: описание — не длиннее 132 символов, название — 75
        if (messages.extDescription)
            assert.ok(messages.extDescription.message.length <= 132, `${locale}: описание длиннее 132`);
        if (messages.extName) assert.ok(messages.extName.message.length <= 75, `${locale}: название длиннее 75`);
    }
});

test('данные для каталога Mozilla — из списков, которые знает каталог', () => {
    const metadata = JSON.parse(read('scripts/amo-metadata.json'));
    // Списки addons.mozilla.org: src/olympia/constants/licenses.py и categories.py в mozilla/addons-server.
    // Неизвестное значение каталог отклоняет, и релиз не публикуется
    const LICENSES = ['MPL-2.0', 'GPL-2.0-only', 'GPL-3.0-only', 'LGPL-2.1-only', 'LGPL-3.0-only', 'MIT', 'Apache-2.0'];
    const CATEGORIES = ['alerts-updates', 'social-communication', 'privacy-security', 'other'];
    assert.ok(LICENSES.includes(metadata.version.license), `лицензия ${metadata.version.license}`);
    for (const category of metadata.categories) assert.ok(CATEGORIES.includes(category), `категория ${category}`);
    assert.ok(metadata.summary['en-US'] && metadata.summary['en-US'].length <= 250);
});

test('фоновый скрипт объявлен и для Chrome, и для Firefox', () => {
    assert.equal(manifest.background.type, 'module');
    assert.equal(manifest.background.service_worker, manifest.background.scripts[0]);
    assert.ok(manifest.browser_specific_settings?.gecko?.id);
});

test('updates.json переводит версии 1.4.x из файла .xpi на версию из каталога Mozilla', async () => {
    const { UPDATE_URL, AMO_LATEST_URL, updateManifest } = await import('../scripts/firefox-update-manifest.mjs');
    const id = manifest.browser_specific_settings.gecko.id;
    assert.deepEqual(updateManifest('9.9.9'), {
        addons: { [id]: { updates: [{ version: '9.9.9', update_link: AMO_LATEST_URL }] } }
    });
    assert.equal(
        AMO_LATEST_URL,
        'https://addons.mozilla.org/firefox/downloads/latest/yandex-mail-checker%40ogurtsov-d.github.io/latest.xpi'
    );
    // Этот адрес записан в update_url версий 1.4.x — менять его нельзя
    assert.equal(UPDATE_URL, `${manifest.homepage_url}/releases/latest/download/updates.json`);
});

test('сборка для Firefox — для каталога Mozilla: без update_url', async () => {
    const { execFileSync } = await import('node:child_process');
    execFileSync(process.execPath, [fileURLToPath(new URL('scripts/build.mjs', root))], { stdio: 'ignore' });
    const firefox = JSON.parse(read('dist/firefox/manifest.json'));
    assert.equal(firefox.browser_specific_settings.gecko.update_url, undefined);
    assert.equal(firefox.browser_specific_settings.gecko.id, manifest.browser_specific_settings.gecko.id);
    // В Chrome и Edge настройки открываются во вкладке, в Firefox — на странице дополнения
    const chrome = JSON.parse(read('dist/chrome/manifest.json'));
    assert.equal(chrome.options_ui.open_in_tab, true);
    assert.equal(firefox.options_ui.open_in_tab, undefined);
});

test('переводы: все языки полные, формы числа по правилам языка, ключи из кода и манифеста существуют', async () => {
    const { readdirSync } = await import('node:fs');
    const { loadMessages } = await import('./helpers/browser-mock.js');
    const locales = readdirSync(new URL('_locales/', root));
    const all = Object.fromEntries(locales.map((l) => [l, loadMessages(l)]));
    const ru = all.ru;
    const en = all.en;
    const FORMS = /_(zero|one|two|few|many|other)$/;
    // Ключи без суффикса формы числа (unread_few → unread)
    const base = (messages) => [...new Set(Object.keys(messages).map((k) => k.replace(FORMS, '')))].sort();
    const pluralBases = [
        ...new Set(
            Object.keys(en)
                .filter((k) => FORMS.test(k))
                .map((k) => k.replace(FORMS, ''))
        )
    ];

    for (const [locale, messages] of Object.entries(all)) {
        // Региональный вариант (en_GB) может переопределять часть сообщений: остальные браузер берёт из en
        const regional = locale.includes('_') && locales.includes(locale.split('_')[0]);
        if (regional) {
            for (const key of Object.keys(messages)) assert.ok(key in en, `${locale}: лишний ключ ${key}`);
        } else {
            assert.deepEqual(base(messages), base(en), `${locale}: набор сообщений отличается от en`);
            // Все формы числа, которые различает язык (Intl.PluralRules по коду из сообщения locale)
            const categories = new Intl.PluralRules(messages.locale.message).resolvedOptions().pluralCategories;
            for (const key of pluralBases) {
                for (const category of categories) {
                    assert.ok(messages[`${key}_${category}`], `${locale}: нет формы ${key}_${category}`);
                }
            }
        }
        assert.ok(messages.locale, `${locale}: нет сообщения locale`);
        for (const [key, entry] of Object.entries(messages)) {
            assert.ok(entry.message.trim(), `${locale}: пустое сообщение ${key}`);
            for (const name of entry.message.match(/\$[A-Z0-9_]+\$/g) ?? []) {
                assert.ok(
                    entry.placeholders?.[name.slice(1, -1).toLowerCase()],
                    `${locale}/${key}: нет placeholder ${name}`
                );
            }
            // Те же подстановки, что в английском: перевод не теряет число, время или адрес
            const expected = (en[key]?.message.match(/\$[A-Z0-9_]+\$/g) ?? []).sort();
            const actual = (entry.message.match(/\$[A-Z0-9_]+\$/g) ?? []).sort();
            if (en[key] && !FORMS.test(key)) assert.deepEqual(actual, expected, `${locale}/${key}: подстановки`);
        }
    }

    const used = new Set();
    for (const file of readdirSync(new URL('src/', root))) {
        const code = read(`src/${file}`);
        for (const [, key] of code.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)) used.add(key);
        for (const [, key] of code.matchAll(/\bplural\('([A-Za-z0-9_]+)'/g)) used.add(`${key}_other`);
        for (const [, key] of code.matchAll(/\bdata-i18n="([A-Za-z0-9_]+)"/g)) used.add(key);
    }
    for (const [, key] of read('src/format.js').matchAll(/: '(error[A-Za-z]+)'/g)) used.add(key);
    for (const [, key] of JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) used.add(key);
    for (const key of used) {
        assert.ok(ru[key] && en[key], `нет перевода для ключа ${key}`);
    }
    // Форма числа может обходиться без самого числа («הודעה אחת» — «одно сообщение»), остальные — нет
    for (const [locale, messages] of Object.entries(all)) {
        for (const [key, entry] of Object.entries(messages)) {
            if (FORMS.test(key) && !key.endsWith('_one') && !key.endsWith('_two')) {
                assert.match(entry.message, /\$COUNT\$/, `${locale}/${key}: нет числа`);
            }
        }
    }
    assert.ok(existsSync(new URL(`_locales/${manifest.default_locale}/messages.json`, root)));
});

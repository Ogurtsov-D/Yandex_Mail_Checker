// Целостность проекта: версии совпадают, файлы на месте, иконки нужных размеров
import assert from 'node:assert/strict';
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

test('размер иконок соответствует имени (Chrome Web Store требует 128×128)', () => {
    for (const [size, file] of Object.entries(manifest.icons)) {
        const png = readFileSync(new URL(file, root));
        assert.equal(png.toString('latin1', 1, 4), 'PNG', `${file} — не PNG`);
        const width = png.readUInt32BE(16);
        const height = png.readUInt32BE(20);
        assert.deepEqual([width, height], [Number(size), Number(size)], `${file}: ${width}×${height}`);
    }
});

test('фоновый скрипт объявлен и для Chrome, и для Firefox', () => {
    assert.equal(manifest.background.type, 'module');
    assert.equal(manifest.background.service_worker, manifest.background.scripts[0]);
    assert.ok(manifest.browser_specific_settings?.gecko?.id);
});

test('updates.json для автообновления Firefox ссылается на подписанный файл релиза', async () => {
    const { UPDATE_URL, updateManifest, xpiName } = await import('../scripts/firefox-update-manifest.mjs');
    const id = manifest.browser_specific_settings.gecko.id;
    assert.deepEqual(updateManifest('9.9.9'), {
        addons: {
            [id]: {
                updates: [
                    {
                        version: '9.9.9',
                        update_link: `${manifest.homepage_url}/releases/download/v9.9.9/${xpiName('9.9.9')}`
                    }
                ]
            }
        }
    });
    assert.equal(UPDATE_URL, `${manifest.homepage_url}/releases/latest/download/updates.json`);
    assert.ok(UPDATE_URL.startsWith('https://'), 'Firefox принимает update_url только по HTTPS');
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

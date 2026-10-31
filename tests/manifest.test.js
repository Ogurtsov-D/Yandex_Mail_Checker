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

// Сборка расширения для публикации:
//   dist/chrome/, dist/firefox/ — распакованные версии со своим manifest.json
//   dist/yandex-mail-checker-<версия>-chrome.zip, ...-firefox.zip — архивы для релиза и магазинов
// Без зависимостей: zip формируется средствами Node.js.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { UPDATE_URL } from './firefox-update-manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

// Что входит в расширение (тесты, документация и служебные файлы — нет)
const INCLUDE = ['src', 'icons', '_locales', 'LICENSE'];

const targets = {
    chrome: (m) => {
        delete m.browser_specific_settings;
        m.background = { service_worker: m.background.service_worker, type: m.background.type };
        return m;
    },
    firefox: (m) => {
        delete m.minimum_chrome_version;
        m.background = { scripts: m.background.scripts, type: m.background.type };
        // Подписанная версия из GitHub Releases обновляется сама (см. firefox-update-manifest.mjs)
        m.browser_specific_settings.gecko.update_url = UPDATE_URL;
        return m;
    }
};

// ---------- Минимальный zip (deflate) ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files) {
    const local = [];
    const central = [];
    let offset = 0;
    // Фиксированная дата (1 января 2026): одинаковые исходники дают одинаковый архив
    const dosTime = 0;
    const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

    for (const { name, data } of files) {
        const nameBuf = Buffer.from(name, 'utf8');
        const compressed = deflateRawSync(data, { level: 9 });
        const crc = crc32(data);

        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4); // версия для распаковки
        header.writeUInt16LE(0x0800, 6); // имена в UTF-8
        header.writeUInt16LE(8, 8); // deflate
        header.writeUInt16LE(dosTime, 10);
        header.writeUInt16LE(dosDate, 12);
        header.writeUInt32LE(crc, 14);
        header.writeUInt32LE(compressed.length, 18);
        header.writeUInt32LE(data.length, 22);
        header.writeUInt16LE(nameBuf.length, 26);
        local.push(header, nameBuf, compressed);

        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50, 0);
        entry.writeUInt16LE(20, 4);
        entry.writeUInt16LE(20, 6);
        entry.writeUInt16LE(0x0800, 8);
        entry.writeUInt16LE(8, 10);
        entry.writeUInt16LE(dosTime, 12);
        entry.writeUInt16LE(dosDate, 14);
        entry.writeUInt32LE(crc, 16);
        entry.writeUInt32LE(compressed.length, 20);
        entry.writeUInt32LE(data.length, 24);
        entry.writeUInt16LE(nameBuf.length, 28);
        entry.writeUInt32LE(offset, 42);
        central.push(entry, nameBuf);

        offset += header.length + nameBuf.length + compressed.length;
    }

    const centralSize = central.reduce((sum, b) => sum + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...local, ...central, end]);
}

function listFiles(dir) {
    return readdirSync(dir)
        .sort()
        .flatMap((name) => {
            const path = join(dir, name);
            return statSync(path).isDirectory() ? listFiles(path) : [path];
        });
}

// ---------- Сборка ----------

rmSync(dist, { recursive: true, force: true });

for (const [target, adapt] of Object.entries(targets)) {
    const outDir = join(dist, target);
    mkdirSync(outDir, { recursive: true });

    for (const item of INCLUDE) cpSync(join(root, item), join(outDir, item), { recursive: true });
    const targetManifest = adapt(structuredClone(manifest));
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(targetManifest, null, 2) + '\n');

    const files = listFiles(outDir).map((path) => ({
        name: relative(outDir, path).split(sep).join('/'),
        data: readFileSync(path)
    }));
    const zipName = `yandex-mail-checker-${manifest.version}-${target}.zip`;
    writeFileSync(join(dist, zipName), createZip(files));
    console.log(`dist/${zipName} (${files.length} файлов)`);
}

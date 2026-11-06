// Ссылка «Оценить расширение» ведёт в тот магазин, откуда расширение установлено
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewUrl } from '../src/links.js';

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/142.0 Safari/537.36';
const EDGE_UA = `${CHROME_UA} Edg/142.0`;

test('по ID расширения: Chrome Web Store и Edge Add-ons', () => {
    assert.match(
        reviewUrl({ id: 'gkpnpejbpnldkkeoeapjdilknlmojoon', userAgent: EDGE_UA }),
        /chromewebstore\.google\.com\/detail\/gkpn.*\/reviews/
    );
    assert.match(
        reviewUrl({ id: 'pncdgkochfhddiclomicdbbhfgoeamcm', userAgent: CHROME_UA }),
        /microsoftedge\.microsoft\.com\/addons\/detail\/pncd/
    );
});

test('Firefox — каталог Mozilla', () => {
    assert.match(
        reviewUrl({ id: 'yandex-mail-checker@ogurtsov-d.github.io', isFirefox: true }),
        /addons\.mozilla\.org\/.*\/reviews\//
    );
});

test('установлено не из магазина — по браузеру', () => {
    assert.match(reviewUrl({ id: 'abc', userAgent: EDGE_UA }), /microsoftedge/);
    assert.match(reviewUrl({ id: 'abc', userAgent: CHROME_UA }), /chromewebstore/);
});

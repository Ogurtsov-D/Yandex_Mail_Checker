// Отправка новой версии в Chrome Web Store и Microsoft Edge Add-ons (вызывается из release.yml).
//   node scripts/publish-stores.mjs chrome dist/yandex-mail-checker-<версия>-chrome.zip
//   node scripts/publish-stores.mjs edge dist/yandex-mail-checker-<версия>-chrome.zip
// Ключи — из секретов репозитория (см. docs/development.md, «Chrome Web Store и Edge»).
// Магазин проверяет версию сам и публикует её после проверки; ждать этого скрипт не должен.
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL, URLSearchParams } from 'node:url';

const CWS_API = 'https://chromewebstore.googleapis.com';
const CWS_SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const EDGE_API = 'https://api.addons.microsoftedge.microsoft.com';

// Заметка для проверяющих Edge (поле Notes for certification)
export const EDGE_NOTES =
    'To test, sign in to Yandex Mail at https://mail.yandex.ru in the same browser profile (a free account works). ' +
    'The badge shows the unread count; right-click the toolbar icon for the menu. ' +
    'The extension makes requests only to the Yandex Mail address chosen in the settings. ' +
    'Source code: https://github.com/Ogurtsov-D/Yandex_Mail_Checker';

const POLL_ATTEMPTS = 30;
const POLL_DELAY_MS = 5000;

const base64url = (data) => Buffer.from(data).toString('base64url');
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(response, what) {
    const text = await response.text();
    if (!response.ok) throw new Error(`${what}: HTTP ${response.status} ${text}`);
    return text ? JSON.parse(text) : {};
}

// Токен доступа Google по ключу служебного аккаунта (JSON из Google Cloud): JWT, подписанный RS256
export async function googleAccessToken(key, { fetch = globalThis.fetch, now = Date.now() } = {}) {
    const iat = Math.floor(now / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(
        JSON.stringify({ iss: key.client_email, scope: CWS_SCOPE, aud: GOOGLE_TOKEN_URL, iat, exp: iat + 3600 })
    );
    const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key.private_key, 'base64url');
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${header}.${claims}.${signature}`
        })
    });
    const { access_token: token } = await readJson(response, 'Токен Google');
    return token;
}

// Chrome Web Store API v2: загрузить архив, дождаться обработки, отправить на проверку
export async function publishChrome(
    { key, publisherId, extensionId, zip },
    { fetch = globalThis.fetch, sleep = defaultSleep } = {}
) {
    const token = await googleAccessToken(key, { fetch });
    const auth = { Authorization: `Bearer ${token}` };
    const item = `publishers/${publisherId}/items/${extensionId}`;

    const upload = await readJson(
        await fetch(`${CWS_API}/upload/v2/${item}:upload`, { method: 'POST', headers: auth, body: zip }),
        'Загрузка в Chrome Web Store'
    );
    let state = upload.uploadState;
    for (let i = 0; /IN_PROGRESS/.test(state) && i < POLL_ATTEMPTS; i++) {
        await sleep(POLL_DELAY_MS);
        const status = await readJson(
            await fetch(`${CWS_API}/v2/${item}:fetchStatus`, { headers: auth }),
            'Состояние загрузки в Chrome Web Store'
        );
        state = status.lastAsyncUploadState;
    }
    if (state !== 'SUCCEEDED') throw new Error(`Chrome Web Store не принял архив: ${state}`);

    const published = await readJson(
        await fetch(`${CWS_API}/v2/${item}:publish`, {
            method: 'POST',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: '{}'
        }),
        'Отправка на проверку в Chrome Web Store'
    );
    return published.state;
}

// Ждать завершения операции Edge: InProgress → Succeeded / Failed
async function edgeOperation(url, headers, what, { fetch, sleep }) {
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
        await sleep(POLL_DELAY_MS);
        const operation = await readJson(await fetch(url, { headers }), what);
        if (operation.status === 'Succeeded') return operation;
        if (operation.status === 'Failed') {
            const details = (operation.errors ?? []).map((e) => e.message).join('; ');
            throw new Error(`${what}: ${operation.errorCode ?? ''} ${operation.message ?? ''} ${details}`.trim());
        }
    }
    throw new Error(`${what}: нет ответа за ${(POLL_ATTEMPTS * POLL_DELAY_MS) / 1000} с`);
}

// Номер операции — последняя часть заголовка Location
function operationId(response, what) {
    const location = response.headers.get('location');
    if (response.status !== 202 || !location) throw new Error(`${what}: HTTP ${response.status}`);
    return location.split('/').filter(Boolean).pop();
}

// Microsoft Edge Add-ons API v1.1: загрузить архив в черновик и отправить его на проверку
export async function publishEdge(
    { productId, clientId, apiKey, zip, notes = EDGE_NOTES },
    { fetch = globalThis.fetch, sleep = defaultSleep } = {}
) {
    const auth = { Authorization: `ApiKey ${apiKey}`, 'X-ClientID': clientId };
    const product = `${EDGE_API}/v1/products/${productId}/submissions`;
    const env = { fetch, sleep };

    const uploaded = await fetch(`${product}/draft/package`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/zip' },
        body: zip
    });
    const uploadId = operationId(uploaded, 'Загрузка в Edge Add-ons');
    await edgeOperation(`${product}/draft/package/operations/${uploadId}`, auth, 'Загрузка в Edge Add-ons', env);

    const submitted = await fetch(product, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
    });
    const submitId = operationId(submitted, 'Отправка на проверку в Edge Add-ons');
    await edgeOperation(`${product}/operations/${submitId}`, auth, 'Отправка на проверку в Edge Add-ons', env);
}

async function main([store, zipPath]) {
    const env = process.env;
    const zip = readFileSync(zipPath);
    if (store === 'chrome') {
        const missing = ['CHROME_SERVICE_ACCOUNT_KEY', 'CHROME_PUBLISHER_ID', 'CHROME_EXTENSION_ID'].filter(
            (n) => !env[n]
        );
        if (missing.length)
            return console.log(
                `::warning::Не заданы секреты ${missing.join(', ')} — версия не отправлена в Chrome Web Store`
            );
        const state = await publishChrome({
            key: JSON.parse(env.CHROME_SERVICE_ACCOUNT_KEY),
            publisherId: env.CHROME_PUBLISHER_ID,
            extensionId: env.CHROME_EXTENSION_ID,
            zip
        });
        console.log(`::notice::Chrome Web Store: версия отправлена на проверку (${state})`);
    } else if (store === 'edge') {
        const missing = ['EDGE_PRODUCT_ID', 'EDGE_CLIENT_ID', 'EDGE_API_KEY'].filter((n) => !env[n]);
        if (missing.length)
            return console.log(
                `::warning::Не заданы секреты ${missing.join(', ')} — версия не отправлена в Edge Add-ons`
            );
        await publishEdge({
            productId: env.EDGE_PRODUCT_ID,
            clientId: env.EDGE_CLIENT_ID,
            apiKey: env.EDGE_API_KEY,
            zip
        });
        console.log('::notice::Edge Add-ons: версия отправлена на проверку');
    } else {
        throw new Error('Укажите магазин: chrome или edge');
    }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main(process.argv.slice(2)).catch((error) => {
        console.log(`::warning::${error.message}`);
        process.exit(1);
    });
}

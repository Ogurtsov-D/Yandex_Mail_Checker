// Отправка версии в Chrome Web Store и Edge Add-ons (scripts/publish-stores.mjs) на подменённом fetch
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { URLSearchParams } from 'node:url';
import { googleAccessToken, publishChrome, publishEdge } from '../scripts/publish-stores.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KEY = {
    client_email: 'cws-publisher@project.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' })
};
const ZIP = Buffer.from('zip');
const noSleep = async () => {};

// Подмена fetch: ответы по очереди, запросы — в calls
function fakeFetch(responses) {
    const calls = [];
    const fetch = async (url, options = {}) => {
        calls.push({ url, ...options });
        const { status = 200, body = {}, location } = responses.shift();
        return {
            ok: status < 300,
            status,
            headers: { get: (name) => (name === 'location' ? location : null) },
            text: async () => JSON.stringify(body)
        };
    };
    return { fetch, calls };
}

test('токен Google: JWT подписан ключом служебного аккаунта, с нужными полями', async () => {
    const { fetch, calls } = fakeFetch([{ body: { access_token: 'token-1' } }]);
    const token = await googleAccessToken(KEY, { fetch, now: 1_700_000_000_000 });
    assert.equal(token, 'token-1');
    assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');

    const form = new URLSearchParams(calls[0].body);
    assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    const [header, claims, signature] = form.get('assertion').split('.');
    const valid = createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(publicKey, signature, 'base64url');
    assert.ok(valid, 'подпись проверяется открытым ключом');
    assert.deepEqual(JSON.parse(Buffer.from(claims, 'base64url')), {
        iss: KEY.client_email,
        scope: 'https://www.googleapis.com/auth/chromewebstore',
        aud: 'https://oauth2.googleapis.com/token',
        iat: 1_700_000_000,
        exp: 1_700_003_600
    });
});

test('Chrome Web Store: загрузка, ожидание обработки, отправка на проверку', async () => {
    const { fetch, calls } = fakeFetch([
        { body: { access_token: 't' } },
        { body: { uploadState: 'IN_PROGRESS' } },
        { body: { lastAsyncUploadState: 'SUCCEEDED' } },
        { body: { state: 'PENDING_REVIEW' } }
    ]);
    const state = await publishChrome(
        { key: KEY, publisherId: 'pub', extensionId: 'ext', zip: ZIP },
        { fetch, sleep: noSleep }
    );
    assert.equal(state, 'PENDING_REVIEW');
    const item = 'publishers/pub/items/ext';
    assert.equal(calls[1].url, `https://chromewebstore.googleapis.com/upload/v2/${item}:upload`);
    assert.equal(calls[1].body, ZIP);
    assert.equal(calls[1].headers.Authorization, 'Bearer t');
    assert.equal(calls[2].url, `https://chromewebstore.googleapis.com/v2/${item}:fetchStatus`);
    assert.equal(calls[3].url, `https://chromewebstore.googleapis.com/v2/${item}:publish`);
});

test('Chrome Web Store: архив не принят — ошибка, на проверку не отправляется', async () => {
    const { fetch, calls } = fakeFetch([{ body: { access_token: 't' } }, { body: { uploadState: 'FAILED' } }]);
    await assert.rejects(
        publishChrome({ key: KEY, publisherId: 'p', extensionId: 'e', zip: ZIP }, { fetch, sleep: noSleep }),
        /FAILED/
    );
    assert.equal(calls.length, 2);
});

test('Chrome Web Store: ответ с ошибкой HTTP — текст ошибки в сообщении', async () => {
    const { fetch } = fakeFetch([{ body: { access_token: 't' } }, { status: 400, body: { error: 'version' } }]);
    await assert.rejects(
        publishChrome({ key: KEY, publisherId: 'p', extensionId: 'e', zip: ZIP }, { fetch, sleep: noSleep }),
        /HTTP 400.*version/
    );
});

test('Edge Add-ons: загрузка в черновик и отправка на проверку с заметкой', async () => {
    const product = 'https://api.addons.microsoftedge.microsoft.com/v1/products/prod/submissions';
    const { fetch, calls } = fakeFetch([
        { status: 202, location: '/v1/products/prod/submissions/draft/package/operations/op-1' },
        { body: { status: 'InProgress' } },
        { body: { status: 'Succeeded' } },
        { status: 202, location: 'op-2' },
        { body: { status: 'Succeeded' } }
    ]);
    await publishEdge({ productId: 'prod', clientId: 'cid', apiKey: 'key', zip: ZIP }, { fetch, sleep: noSleep });
    assert.equal(calls[0].url, `${product}/draft/package`);
    assert.equal(calls[0].headers.Authorization, 'ApiKey key');
    assert.equal(calls[0].headers['X-ClientID'], 'cid');
    assert.equal(calls[0].headers['Content-Type'], 'application/zip');
    assert.equal(calls[1].url, `${product}/draft/package/operations/op-1`);
    assert.equal(calls[3].url, product);
    assert.match(JSON.parse(calls[3].body).notes, /sign in to Yandex Mail/);
    assert.equal(calls[4].url, `${product}/operations/op-2`);
});

test('Edge Add-ons: операция не удалась — ошибка с причиной', async () => {
    const { fetch } = fakeFetch([
        { status: 202, location: 'op-1' },
        { body: { status: 'Failed', errorCode: 'InProgressSubmission', message: 'В проверке', errors: [] } }
    ]);
    await assert.rejects(
        publishEdge({ productId: 'p', clientId: 'c', apiKey: 'k', zip: ZIP }, { fetch, sleep: noSleep }),
        /InProgressSubmission/
    );
});

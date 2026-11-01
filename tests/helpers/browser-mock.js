// Имитация API расширений (chrome.* / browser.*) для тестов в Node.js.
// Использование: installBrowserMock() до импорта модулей из src/.
import { readFileSync } from 'node:fs';

export function loadMessages(locale) {
    return JSON.parse(readFileSync(new URL(`../../_locales/${locale}/messages.json`, import.meta.url), 'utf8'));
}

// chrome.i18n.getMessage: $NAME$ → содержимое placeholder → $1…$9 из аргументов, $$ → $
export function getMessage(messages, key, substitutions = []) {
    const entry = messages[key];
    if (!entry) return '';
    const subs = typeof substitutions === 'string' ? [substitutions] : (substitutions ?? []);
    const fillArgs = (text) => text.replace(/\$(\d)/g, (_, n) => subs[Number(n) - 1] ?? '');
    return entry.message
        .replace(/\$([a-z0-9_@]+)\$/gi, (match, name) => {
            const placeholder = entry.placeholders?.[name.toLowerCase()];
            return placeholder ? fillArgs(placeholder.content) : match;
        })
        .replace(/\$\$/g, '$');
}

// locale — язык перевода, который «выбрал браузер» (ru или en)
export function installBrowserMock({ firefox = false, locale = 'ru' } = {}) {
    const messages = loadMessages(locale);
    const listeners = {};
    const store = { local: {}, session: {} };
    const calls = {
        notifications: [],
        clearedNotifications: [],
        createdTabs: [],
        updatedTabs: [],
        focusedWindows: [],
        menus: [],
        icons: [],
        openedOptions: 0,
        badge: { text: undefined, title: undefined }
    };
    const alarms = {};
    let tabs = [];

    const event = (name) => ({
        addListener: (fn) => {
            listeners[name] = fn;
        }
    });

    const area = (name) => ({
        get: async (keys) => {
            const list = typeof keys === 'string' ? [keys] : keys;
            const result = {};
            for (const key of list) {
                if (key in store[name]) result[key] = structuredClone(store[name][key]);
            }
            return result;
        },
        set: async (items) => {
            Object.assign(store[name], structuredClone(items));
        }
    });

    const api = {
        runtime: {
            getURL: (path) => `extension://test/${path}`,
            onInstalled: event('installed'),
            openOptionsPage: async () => {
                calls.openedOptions++;
            },
            onStartup: event('startup'),
            ...(firefox ? { getBrowserInfo: async () => ({ name: 'Firefox' }) } : {})
        },
        storage: { local: area('local'), session: area('session'), onChanged: event('storageChanged') },
        i18n: {
            getMessage: (key, substitutions) => getMessage(messages, key, substitutions),
            getUILanguage: () => locale
        },
        alarms: {
            create: async (name, info) => {
                alarms[name] = { name, ...info };
            },
            get: async (name) => alarms[name],
            clearAll: async () => {
                for (const key of Object.keys(alarms)) delete alarms[key];
                return true;
            },
            onAlarm: event('alarm')
        },
        notifications: {
            create: async (id, options) => {
                calls.notifications.push({ id, ...options });
                return id;
            },
            clear: async (id) => {
                calls.clearedNotifications.push(id);
                return true;
            },
            onClicked: event('notificationClicked')
        },
        action: {
            setBadgeText: async ({ text }) => {
                calls.badge.text = text;
            },
            setBadgeBackgroundColor: async () => {},
            setIcon: async ({ path }) => {
                calls.icons.push(path);
            },
            setTitle: async ({ title }) => {
                calls.badge.title = title;
            },
            onClicked: event('actionClicked')
        },
        contextMenus: {
            create: (props) => {
                calls.menus.push(props);
            },
            removeAll: async () => {
                calls.menus.length = 0;
            },
            onClicked: event('menuClicked')
        },
        tabs: {
            // Шаблон адреса вида https://mail.yandex.ru/*
            query: async ({ url }) => tabs.filter((t) => t.url.startsWith(url.replace(/\*$/, ''))),
            create: async ({ url }) => {
                calls.createdTabs.push(url);
            },
            update: async (id, props) => {
                calls.updatedTabs.push({ id, ...props });
            },
            onUpdated: event('tabUpdated'),
            onRemoved: event('tabRemoved')
        },
        permissions: {
            // Выданные разрешения на домены (optional_host_permissions)
            contains: async ({ origins }) => origins.every((o) => mock.grantedOrigins.includes(o)),
            request: async ({ origins }) => {
                if (!mock.allowPermissionRequests) return false;
                mock.grantedOrigins.push(...origins);
                return true;
            },
            remove: async ({ origins }) => {
                mock.grantedOrigins = mock.grantedOrigins.filter((o) => !origins.includes(o));
                return true;
            }
        },
        idle: {
            // Состояние пользователя: active | idle | locked (задаётся через mock.idleState)
            queryState: async () => mock.idleState,
            setDetectionInterval: () => {},
            onStateChanged: event('idleStateChanged')
        },
        commands: {
            getAll: async () => [{ name: '_execute_action', shortcut: 'Alt+Shift+Y' }]
        },
        windows: {
            update: async (id) => {
                calls.focusedWindows.push(id);
            }
        }
    };

    if (firefox) globalThis.browser = api;
    else globalThis.chrome = api;

    const mock = {
        api,
        listeners,
        store,
        calls,
        alarms,
        fetchCount: 0,
        setTabs(list) {
            tabs = list;
        },
        requests: [],
        // Ответ Яндекса на все запросы: строка (HTML или JSON), функция (url, options) =>
        // Response-подобный объект, или Error для сбоя сети. Ответ API счётчиков задаётся
        // отдельно — mock.counters(); без него на счётчики приходит тот же ответ
        respond(response) {
            mock.inboxResponse = response;
        },
        // Ответ API счётчиков: { unread, fresh } — один аккаунт ({ counters }); массив
        // [{ uid, unread, fresh }] — несколько аккаунтов, как отвечает Яндекс с ?multi;
        // null — 404 (API нет); строка, функция или Error — как в respond()
        counters(value) {
            mock.countersResponse = Array.isArray(value)
                ? JSON.stringify(value.map(({ uid, ...counters }) => ({ uid, data: { counters } })))
                : value && typeof value === 'object' && !(value instanceof Error)
                  ? JSON.stringify({ counters: value })
                  : value === null
                    ? () => ({ type: 'basic', status: 404, ok: false })
                    : value;
        },
        // Сбросить состояние между тестами (обработчики событий сохраняются)
        reset() {
            store.local = {};
            store.session = {};
            for (const key of Object.keys(alarms)) delete alarms[key];
            calls.notifications.length = 0;
            calls.clearedNotifications.length = 0;
            calls.createdTabs.length = 0;
            calls.updatedTabs.length = 0;
            calls.focusedWindows.length = 0;
            calls.icons.length = 0;
            calls.openedOptions = 0;
            mock.idleState = 'active';
            mock.grantedOrigins = [];
            mock.allowPermissionRequests = true;
            calls.badge.text = undefined;
            calls.badge.title = undefined;
            tabs = [];
            mock.fetchCount = 0;
            mock.requests.length = 0;
            mock.inboxResponse = '';
            mock.countersResponse = undefined;
        }
    };

    globalThis.fetch = async (url, options) => {
        mock.fetchCount++;
        mock.requests.push(url);
        const isCounters = url.includes('/api/v2/bar/counters');
        const response = isCounters && mock.countersResponse !== undefined ? mock.countersResponse : mock.inboxResponse;
        if (response instanceof Error) throw response;
        if (typeof response === 'function') return response(url, options);
        return { type: 'basic', status: 200, ok: true, text: async () => response };
    };
    mock.reset();
    return mock;
}

// Дождаться завершения цепочек промисов
export async function flush() {
    for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
}

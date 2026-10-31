// Имитация API расширений (chrome.* / browser.*) для тестов в Node.js.
// Использование: installBrowserMock() до импорта модулей из src/.

export function installBrowserMock({ firefox = false } = {}) {
    const listeners = {};
    const store = { local: {}, session: {} };
    const calls = {
        notifications: [],
        clearedNotifications: [],
        createdTabs: [],
        updatedTabs: [],
        focusedWindows: [],
        menus: [],
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
            onStartup: event('startup'),
            ...(firefox ? { getBrowserInfo: async () => ({ name: 'Firefox' }) } : {})
        },
        storage: { local: area('local'), session: area('session') },
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
            query: async () => tabs.filter((t) => t.url.startsWith('https://mail.yandex.ru/')),
            create: async ({ url }) => {
                calls.createdTabs.push(url);
            },
            update: async (id, props) => {
                calls.updatedTabs.push({ id, ...props });
            },
            onUpdated: event('tabUpdated'),
            onRemoved: event('tabRemoved')
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
        // Ответ Яндекса: строка HTML, функция (url, options) => Response-подобный объект, или Error для сбоя сети
        respond(response) {
            globalThis.fetch = async (url, options) => {
                mock.fetchCount++;
                if (response instanceof Error) throw response;
                if (typeof response === 'function') return response(url, options);
                return { type: 'basic', status: 200, ok: true, text: async () => response };
            };
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
            calls.badge.text = undefined;
            calls.badge.title = undefined;
            tabs = [];
            mock.fetchCount = 0;
        }
    };
    return mock;
}

// Дождаться завершения цепочек промисов
export async function flush() {
    for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
}

// Состояние почты для страниц расширения (настройки, приветствие): строка «что сейчас»
// и кнопки «Проверить сейчас» / «Открыть почту». Проверку и открытие почты выполняет фоновый скрипт
import { ext } from './api.js';
import { errorText, formatCheckTime, unreadText } from './format.js';
import { t } from './i18n.js';
import { loadState } from './status.js';

// { kind: 'ok' | 'error' | 'none', text } по сохранённому результату последней проверки
export function describeStatus(state, now = Date.now()) {
    if (state.errorType) return { kind: 'error', auth: state.errorType === 'auth', text: errorText(state) };
    if (state.lastSuccess) {
        return {
            kind: 'ok',
            text: `${unreadText(state.unreadCount ?? 0)} · ${t('checkedAt', formatCheckTime(state.lastSuccess, now))}`
        };
    }
    return { kind: 'none', text: t('statusNotChecked') };
}

export const checkNow = () => ext.runtime.sendMessage({ type: 'checkNow' });
export const openMailbox = () => ext.runtime.sendMessage({ type: 'openMail' });

// Блок состояния: значок, текст и кнопки; обновляется при каждой проверке и раз в 30 секунд
// («Проверено только что» → «1 минуту назад»). onChange(state) — для страниц, которым нужно больше
export function mountStatus(container, onChange) {
    container.classList.add('status');
    const icon = document.createElement('span');
    icon.className = 'status-icon';
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'status-text';
    text.setAttribute('role', 'status');
    const actions = document.createElement('span');
    actions.className = 'status-actions';
    const button = (key, handler) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = t(key);
        b.addEventListener('click', handler);
        return b;
    };
    const check = button('menuCheckNow', async () => {
        check.disabled = true;
        icon.textContent = '↻';
        text.textContent = t('checking');
        await checkNow();
        check.disabled = false;
        await render();
    });
    const open = button('welcomeOpenMail', openMailbox);
    actions.append(open, check);
    container.append(icon, text, actions);

    async function render() {
        const state = await loadState();
        const status = describeStatus(state);
        container.dataset.kind = status.kind;
        icon.textContent = status.kind === 'ok' ? '✓' : status.kind === 'error' ? '!' : '…';
        text.textContent = status.text;
        // Нужен вход — главная кнопка «Открыть почту»
        open.classList.toggle('primary', status.kind !== 'ok');
        onChange?.(state, status);
    }

    ext.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && ['lastCheck', 'lastSuccess', 'errorType', 'unreadCount'].some((k) => k in changes))
            render();
    });
    setInterval(render, 30_000);
    return render();
}

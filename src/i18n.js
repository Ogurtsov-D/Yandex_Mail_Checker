// Переводы интерфейса: _locales/<язык>/messages.json.
// Язык выбирает браузер (язык интерфейса), иначе — default_locale из manifest.json.
import { ext } from './api.js';

// Сообщение перевода; аргументы подставляются вместо $1, $2… (см. placeholders в messages.json)
export function t(key, ...args) {
    return ext.i18n.getMessage(key, args.length ? args.map(String) : undefined);
}

let cachedLocale;

// Язык перевода, который реально используется. Не язык браузера: для немецкого
// браузера сработает английский перевод, и склонять нужно по-английски.
export function locale() {
    cachedLocale ??= t('locale') || 'en';
    return cachedLocale;
}

// Сообщение с числом в нужной форме: plural('unread', 3) → ключ unread_few → «3 непрочитанных письма»
export function plural(key, n) {
    const category = new Intl.PluralRules(locale()).select(n);
    return t(`${key}_${category}`, n) || t(`${key}_other`, n);
}

// Ссылки со страницы настроек
import { CHROME_WEB_STORE_ID, EDGE_ADDONS_ID, REVIEW_URLS } from './config.js';

// Страница отзывов в том магазине, откуда установлено расширение. Магазин узнаём по ID расширения:
// у Chrome Web Store и Edge Add-ons он свой. Установлено не из магазина — по браузеру
export function reviewUrl({ id, isFirefox, userAgent = '' }) {
    if (isFirefox) return REVIEW_URLS.firefox;
    if (id === EDGE_ADDONS_ID) return REVIEW_URLS.edge;
    if (id === CHROME_WEB_STORE_ID) return REVIEW_URLS.chrome;
    return /\bEdg\//.test(userAgent) ? REVIEW_URLS.edge : REVIEW_URLS.chrome;
}

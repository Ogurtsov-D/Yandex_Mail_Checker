import { DEBUG } from './config.js';

// Отладочный вывод: включается флагом DEBUG в config.js
export function debug(...args) {
    if (DEBUG) console.log('[mail-checker]', ...args);
}

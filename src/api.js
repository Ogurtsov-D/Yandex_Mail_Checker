// Единая точка доступа к API расширений.
// Firefox предоставляет `browser`, Chrome — `chrome` (в новых версиях и `browser`);
// в Manifest V3 оба возвращают промисы, колбэки не используем.
export const ext = globalThis.browser ?? globalThis.chrome;

// runtime.getBrowserInfo есть только в Firefox
export const IS_FIREFOX = typeof globalThis.browser?.runtime?.getBrowserInfo === 'function';

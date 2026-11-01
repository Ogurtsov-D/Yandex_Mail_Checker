// Пауза, пока пользователь не за компьютером: плановые проверки пропускаются,
// а при возвращении почта проверяется сразу
import { ext } from './api.js';
import { checkMail } from './checker.js';
import { IDLE_THRESHOLD_SEC } from './config.js';
import { getSettings } from './settings.js';

// Пользователь не за компьютером (простой дольше IDLE_THRESHOLD_SEC или экран заблокирован)
// и пауза включена в настройках
export async function isAway() {
    if (!ext.idle) return false;
    const { pauseWhenIdle } = await getSettings();
    if (!pauseWhenIdle) return false;
    return (await ext.idle.queryState(IDLE_THRESHOLD_SEC)) !== 'active';
}

// Плановая проверка пропущена — проверить, когда пользователь вернётся
export async function markMissedCheck() {
    await ext.storage.session.set({ missedWhileAway: true });
}

export async function handleIdleStateChanged(state) {
    if (state !== 'active') return;
    const { missedWhileAway } = await ext.storage.session.get('missedWhileAway');
    if (!missedWhileAway) return;
    await ext.storage.session.set({ missedWhileAway: false });
    await checkMail();
}

# Участие в разработке

Спасибо за интерес к проекту! Здесь описано, как устроен код, как его проверить и как выпустить новую версию.

## Быстрый старт

Нужны [Node.js 22+](https://nodejs.org/) и браузер на основе Chromium или Firefox. Устанавливать зависимости не нужно: тесты используют встроенный в Node.js `node:test`, а линтеры запускаются через `npx`.

```bash
git clone https://github.com/Ogurtsov-D/Yandex_Mail_Checker.git
cd Yandex_Mail_Checker
npm test
```

Запуск расширения из исходников:

- **Chrome:** `chrome://extensions` → «Режим разработчика» → «Загрузить распакованное расширение» → корневая папка репозитория.
- **Firefox:** `about:debugging#/runtime/this-firefox` → «Загрузить временное дополнение…» → `manifest.json` в корне репозитория.

После изменений нажмите ↻ на карточке расширения (в Firefox — «Перезагрузить»). Подробный журнал включается флагом `DEBUG = true` в `src/config.js`.

## Команды

| Команда | Что делает |
|---------|------------|
| `npm test` | Автотесты |
| `npm run lint` | ESLint и проверка форматирования Prettier |
| `npm run format` | Отформатировать код Prettier |
| `npm run build` | Собрать `dist/chrome/`, `dist/firefox/` и zip-архивы для релиза |
| `npm run lint:firefox` | Собрать и проверить версию для Firefox официальным линтером Mozilla (`web-ext lint --self-hosted`) |
| `npm run check` | Всё сразу — то же, что проверяет GitHub Actions |

## Структура проекта

```
├── manifest.json          # манифест для Chrome и Firefox (сборка делает отдельные версии)
├── src/
│   ├── background.js      # точка входа: регистрация обработчиков событий
│   ├── checker.js         # проверка почты: запрос, разбор, уведомления, повторы при ошибках
│   ├── parser.js          # разбор HTML lite-версии (чистые функции)
│   ├── format.js          # тексты бейджа и подсказки, формат времени
│   ├── i18n.js            # переводы: t() и plural()
│   ├── notifications.js   # системные уведомления
│   ├── tabs.js            # открытие почты и письма, перепроверка после действий во вкладке
│   ├── menu.js            # контекстное меню на иконке
│   ├── settings.js        # настройки и расписание проверки
│   ├── status.js          # бейдж и подсказка на иконке
│   ├── api.js             # chrome.* / browser.*
│   ├── config.js          # адреса, интервалы, таймауты, флаг DEBUG
│   └── log.js             # отладочный вывод
├── _locales/
│   ├── ru/messages.json   # русский интерфейс
│   └── en/messages.json   # английский интерфейс (используется по умолчанию)
├── icons/
│   ├── icon.svg           # исходник иконки
│   └── icon*.png          # 16, 32, 48, 128 px — собираются из icon.svg
├── tests/
│   ├── *.test.js          # автотесты
│   ├── helpers/           # имитация API браузера и генератор страниц
│   └── fixtures/          # образцы HTML-страниц lite-версии
├── scripts/
│   ├── build.mjs          # сборка архивов
│   ├── firefox-update-manifest.mjs  # updates.json для автообновления Firefox
│   ├── render-icons.mjs   # PNG-иконки из icons/icon.svg
│   └── release-notes.mjs  # описание релиза из CHANGELOG.md
├── docs/
│   ├── screenshot.png, screenshot-en.png  # картинки для README и README.en.md
│   └── mockup.html, mockup-en.html        # их исходники
├── README.md, README.en.md                # описание на русском и английском
└── .github/               # GitHub Actions, Dependabot, шаблоны Issues и PR
```

## Как устроены тесты

- `parser.test.js` — разбор страниц, чистые функции.
- `format.test.js`, `format-en.test.js` — тексты интерфейса на русском и английском.
- `checker.test.js`, `background.test.js`, `firefox.test.js` — логика расширения на имитации API браузера (`tests/helpers/browser-mock.js`): хранилище, будильники, уведомления, вкладки и ответы Яндекса подменяются, таймеры управляются через `mock.timers`.
- `manifest.test.js` — версии совпадают, файлы на месте, иконки нужных размеров, переводы полные: каждый ключ из кода есть в обоих языках.

**Если Яндекс изменил вёрстку**, сохраните новую страницу в `tests/fixtures/` (инструкция и требования к удалению личных данных — в [tests/fixtures/README.md](tests/fixtures/README.md)), добавьте тест и поправьте `src/parser.js`.

## Переводы

Все тексты интерфейса — в `_locales/ru/messages.json` и `_locales/en/messages.json`; в коде они берутся через `t('ключ')` и `plural('ключ', число)` из `src/i18n.js`. Язык выбирает браузер: русский — для русского интерфейса браузера, английский — для всех остальных.

- Новый текст добавляйте **в оба файла** — иначе упадёт `manifest.test.js`.
- Формы числа — отдельные ключи с суффиксами [правил Unicode](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html): для русского `_one`, `_few`, `_many`, `_other` (1 письмо, 2 письма, 5 писем, 1,5 письма), для английского `_one`, `_other`.
- Подстановки — через `placeholders` (`$COUNT$` → `$1`), как в [документации Chrome](https://developer.chrome.com/docs/extensions/reference/api/i18n).
- Новый язык: создайте `_locales/<код>/messages.json` со всеми ключами и укажите код языка в ключе `locale`.

## Иконка

Исходник — `icons/icon.svg`. После правки пересоберите PNG (нужен Playwright, в проект он не входит):

```bash
npm install -g playwright && npx playwright install chromium
NODE_PATH="$(npm root -g)" node scripts/render-icons.mjs
```

## Обновления зависимостей

Раз в месяц [Dependabot](https://docs.github.com/ru/code-security/dependabot) предлагает PR с новыми версиями действий GitHub Actions (`.github/dependabot.yml`). Если проверка в PR зелёная — вливайте. Версии линтеров (`eslint@10`, `prettier@3`, `web-ext@10`) указаны в `package.json` и обновляются вручную.

## Правила для изменений

- Перед отправкой запустите `npm run check`.
- Новое поведение — с тестом.
- Изменения, заметные пользователю, — в раздел `## [Не выпущено]` в начале `CHANGELOG.md` (создайте его, если нет).
- Если изменились тексты меню, бейджа или уведомлений, обновите `docs/mockup.html` и `docs/mockup-en.html` и пересоздайте `docs/screenshot.png` и `docs/screenshot-en.png`: откройте макет в Chrome → DevTools → Ctrl+Shift+P → «Capture full size screenshot».
- Если меняется README, обновите и английскую версию `README.en.md`.
- Расширение не должно обращаться никуда, кроме `mail.yandex.ru`, и не должно выполнять действий в почте.

## Выпуск новой версии

1. Обновите версию в `manifest.json` и `package.json` (одинаковую, например `1.5.0`). Каждая версия выпускается один раз: Mozilla не подпишет её повторно.
2. Переименуйте `## [Не выпущено]` в `CHANGELOG.md` в `## [1.5.0] — ГГГГ-ММ-ДД`.
3. Влейте изменения в `main` и дождитесь зелёной проверки.
4. Создайте тег — любым способом:
    - в терминале: `git tag v1.5.0 && git push origin v1.5.0`;
    - на GitHub: **Releases → Draft a new release → Choose a tag → `v1.5.0` (Create new tag) → Publish release**.

GitHub Actions проверит, что тег совпадает с версией в `manifest.json`, прогонит тесты, соберёт архивы для Chrome и Firefox, подпишет Firefox-версию в Mozilla и приложит всё к релизу. Описание берётся из `CHANGELOG.md`, если вы не написали своё.

Релиз публикуется только целиком, с подписанным `.xpi`. Если что-то не удалось, релиз не появится, а созданный вручную будет переведён в черновик (см. «Если подпись не удалась»).

## Подпись для Firefox

Firefox навсегда устанавливает только дополнения, подписанные Mozilla. Релиз отправляет расширение на подпись **без публикации в каталоге** (канал `unlisted`): Mozilla автоматически проверяет его и возвращает подписанный `.xpi`, обычно за несколько минут. К релизу прикладываются:

- `yandex-mail-checker-<версия>-firefox.xpi` — подписанное расширение;
- `updates.json` — по нему установленный Firefox находит новые версии. Адрес файла (`…/releases/latest/download/updates.json`) прописывается в `update_url` при сборке для Firefox.

### Настройка (один раз)

1. Войдите на [addons.mozilla.org](https://addons.mozilla.org/) с аккаунтом Mozilla (создайте его, если нет).
2. Откройте [Управление ключами API](https://addons.mozilla.org/developers/addon/api/key/), примите соглашение для разработчиков и нажмите **«Generate new credentials»**.
3. Скопируйте **JWT issuer** (вида `user:12345678:123`) и **JWT secret**. Секрет показывается один раз.
4. В репозитории на GitHub: **Settings → Secrets and variables → Actions → New repository secret** — создайте два секрета:
    - `AMO_JWT_ISSUER` — JWT issuer;
    - `AMO_JWT_SECRET` — JWT secret.

Без этих секретов релиз не публикуется: процесс остановится с ошибкой «Не заданы секреты».

### Если подпись не удалась

Релиз без подписанного `.xpi` не публикуется: если релиз был создан вручную, он становится черновиком (на странице Releases его видите только вы). Причина — в журнале запуска: **Actions → Release →** неудачный запуск → шаг «Подпись для Firefox». Частые случаи:

- **Mozilla отправила версию на ручную проверку**, и шаг не дождался ответа (ждёт 15 минут). Дождитесь одобрения в [кабинете разработчика](https://addons.mozilla.org/developers/addons), скачайте подписанный файл, переименуйте его в `yandex-mail-checker-<версия>-firefox.xpi` и приложите к черновику релиза (**Edit** → перетащите файл → **Save draft**). Затем в Actions откройте неудачный запуск и нажмите **Re-run all jobs**: процесс увидит приложенный `.xpi`, добавит архивы и `updates.json` и опубликует релиз.
- **Не заданы секреты** — добавьте их (см. «Настройка») и нажмите **Re-run all jobs**.
- **Ошибка в ключах** («Unknown JWT iss») — создайте новые ключи на addons.mozilla.org, обновите секреты и нажмите **Re-run all jobs**.
- **Mozilla отклонила версию** или **версия уже отправлялась** — Mozilla не принимает одну версию дважды. Исправьте причину, выпустите следующую версию (например, `1.5.1`), а черновик старой удалите.

`update_url` допустим только при распространении вне каталога. Если расширение когда-нибудь будет опубликовано в каталоге addons.mozilla.org, уберите `update_url` из сборки для Firefox (`scripts/build.mjs`): каталог обновляет расширения сам.

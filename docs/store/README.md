# Материалы для магазинов расширений

Тексты и картинки для карточек расширения в [Chrome Web Store](https://chrome.google.com/webstore/devconsole), [Microsoft Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge/overview) и [каталоге дополнений Firefox](https://addons.mozilla.org/developers/addons). Название и краткое описание магазины берут из самого расширения (`extName` и `extDescription` в `_locales/*/messages.json`, на 19 языках); остальное вставляется в формы вручную.

## Картинки

Пересоздаются скриптом `scripts/store-images.mjs` (запуск — в его заголовке).

| Файл | Где нужен |
|------|-----------|
| `ru/screenshot-1…4.png`, `en/screenshot-1…4.png` — 1280×800 | Снимки экрана во всех трёх магазинах |
| `ru/promo-440x280.png`, `en/promo-440x280.png` | Маленькая промо-картинка Chrome Web Store (Small promo tile) |
| `../../icons/icon128.png` | Иконка магазина (128×128): Chrome Web Store, каталог Firefox |
| `logo-300x300.png` | Логотип для Microsoft Edge Add-ons (Store logo) |

## Общие сведения

| Поле | Значение |
|------|----------|
| Категория | Chrome Web Store и Edge — Communication / «Общение»; Firefox — Alerts & Updates, Social & Communication |
| Сайт | https://github.com/Ogurtsov-D/Yandex_Mail_Checker |
| Поддержка | https://github.com/Ogurtsov-D/Yandex_Mail_Checker/issues |
| Политика конфиденциальности | https://github.com/Ogurtsov-D/Yandex_Mail_Checker/blob/main/PRIVACY.en.md |
| Цена | Бесплатно, все страны |
| Лицензия | GPL-3.0-only |

## Подробное описание

Не перечисляйте в описании адреса почты (mail.yandex.com, .by, .kz…): Chrome Web Store считает такой список злоупотреблением ключевыми словами и отклоняет расширение.

### Русский

Счётчик писем для Яндекс Почты показывает на значке в панели браузера, сколько у вас непрочитанных писем, и сообщает о новых письмах. Держать почту открытой не нужно.

• Число непрочитанных писем во всех папках, кроме «Спама», — как в самой Яндекс Почте. Или только новые письма, пришедшие после вашего последнего захода в почту.
• Уведомления о новых письмах; клик по уведомлению открывает почту. Счётчик новых писем в самой почте при этом не сбрасывается.
• Клик по значку переключает на уже открытую вкладку почты.
• Несколько аккаунтов: сумма на значке, строка на каждый аккаунт в подсказке, быстрый переход в нужный аккаунт по правому клику.
• Яндекс Почта в разных странах и Яндекс 360, в том числе почта на своём домене: адрес почты выбирается в настройках.
• Тихие часы, звук уведомлений, интервал проверки от 1 до 30 минут, пауза, пока вы не за компьютером.
• Горячая клавиша Alt+Shift+Y открывает почту.
• Пять вариантов значка, интерфейс на 19 языках.

Конфиденциальность: расширение обращается только к почте Яндекса с вашими обычными cookie и ничего не отправляет ни автору, ни третьим лицам. Никакой аналитики и рекламы. Расширение ничего не делает в почте: не отмечает письма прочитанными, не удаляет и не отправляет.

Открытый исходный код: https://github.com/Ogurtsov-D/Yandex_Mail_Checker

Расширение — независимый проект и не связано с компанией Яндекс.

### English

Checker for Yandex Mail shows how many unread messages you have on its toolbar icon and notifies you about new mail. No need to keep your mailbox open.

• Unread messages in all folders except Spam — the same number Yandex Mail shows. Or only new messages that arrived since your last visit to the mailbox.
• New mail notifications; click a notification to open your mailbox. The new mail count in Yandex Mail itself is not reset.
• Clicking the icon switches to an already open mail tab.
• Several accounts: the total on the icon, a line per account in the tooltip, and quick access to any account with a right-click.
• Yandex Mail in other countries and Yandex 360, including mail on your own domain: choose the mail address in the settings.
• Quiet hours, notification sound, check interval from 1 to 30 minutes, pause while you are away from the computer.
• Keyboard shortcut Alt+Shift+Y opens your mail.
• Five icon styles, interface in 19 languages.

Privacy: the extension contacts only Yandex Mail, using your usual cookies, and sends nothing to the author or any third party. No analytics, no ads. It performs no actions in your mailbox: it does not mark messages as read, delete or send anything.

Open source: https://github.com/Ogurtsov-D/Yandex_Mail_Checker

This extension is an independent project and is not affiliated with Yandex.

## Вкладка Privacy в Chrome Web Store (и такие же поля в Edge)

Формы — на английском.

**Single purpose description**

> Shows the number of unread Yandex Mail messages on the toolbar icon and notifies the user about new mail.

**Permission justification**

| Разрешение | Justification |
|------------|---------------|
| `storage` | Stores the user's settings (check interval, notifications, quiet hours, mail address, icon style) and the result of the last check, so the badge and tooltip survive browser restarts. |
| `alarms` | Schedules periodic mail checks at the interval the user chooses (1–30 minutes). |
| `contextMenus` | Right-click menu on the toolbar icon: "Check now", check interval, badge mode, notification settings, and the list of accounts. |
| `notifications` | Shows a notification with the number of new messages when new mail arrives. |
| `idle` | Pauses scheduled checks while the computer is idle or locked and checks mail as soon as the user returns. Only the active/idle/locked state is read. |
| Host permission `https://mail.yandex.ru/*` | Requests the unread counters (`/api/v2/bar/counters`) with the user's existing Yandex cookies; with several signed-in accounts, once a day the account list (`/api/v2/bar/accounts`), from which only each account's main email address is used as a label; only if the counters are unavailable, the simplified Inbox page `/lite/inbox`; finds an open mail tab to switch to it and to refresh the counter after the user reads mail. |
| Optional host permissions (`mail.yandex.com`, `.by`, `.kz`, `.com.tr`, `mail.360.yandex.ru`) | Requested only if the user chooses that mail address in the settings; used exactly like `mail.yandex.ru`. Access to the previous address is removed when the user switches. |

**Are you using remote code?** No. All code is included in the package; no external scripts, no `eval`.

**Data usage** — отметить:

- ☑ **Personal communications** — only if the unread counters are unavailable, the extension reads the sender and subject of new messages from the Inbox page to show them in a notification. They are processed only in the browser and not stored or transmitted.
- ☑ **Website content** — the unread counters and the Inbox page of the user's Yandex Mail.
- ☑ **Personally identifiable information** — with several signed-in accounts, the main email address of each account, used only as a label in the tooltip, menu and notifications. Stored only in the browser, never transmitted.

И подтвердить все три утверждения:

- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases.
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL** — https://github.com/Ogurtsov-D/Yandex_Mail_Checker/blob/main/PRIVACY.en.md

## Заметки для проверяющих (поле Notes / Test instructions)

> To test, sign in to Yandex Mail at https://mail.yandex.ru in the same browser profile (a free account works). The badge shows the unread count; right-click the icon for the menu. The extension makes requests only to the Yandex Mail address chosen in the settings. Source code: https://github.com/Ogurtsov-D/Yandex_Mail_Checker

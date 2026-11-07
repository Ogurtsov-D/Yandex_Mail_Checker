# Материалы для магазинов расширений

Тексты и картинки для карточек расширения в [Chrome Web Store](https://chrome.google.com/webstore/devconsole), [Microsoft Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge/overview) и [каталоге дополнений Firefox](https://addons.mozilla.org/developers/addons). Название и краткое описание магазины берут из самого расширения (`extName` и `extDescription` в `_locales/*/messages.json`, на 19 языках); остальное вставляется в формы вручную.

## Картинки

Пересоздаются скриптом `scripts/store-images.mjs` (запуск — в его заголовке).

| Файл | Где нужен |
|------|-----------|
| `ru/screenshot-1…4.png`, `en/screenshot-1…4.png` — 1280×800 | Снимки экрана во всех трёх магазинах |
| `ru/promo-440x280.png`, `en/promo-440x280.png` | Маленькая промо-картинка Chrome Web Store (Small promo tile) и Edge (Small promotional tile) |
| `../../icons/icon128.png` | Иконка магазина (128×128): Chrome Web Store, каталог Firefox |
| `logo-300x300.png` | Логотип для Microsoft Edge Add-ons (Store logo) |
| `opera-64.png` | Иконка для каталога Opera (64×64) |

## Общие сведения

| Поле | Значение |
|------|----------|
| Категория | Chrome Web Store и Edge — Communication / «Общение»; Firefox — Alerts & Updates, Social & Communication |
| Сайт | https://github.com/Ogurtsov-D/Yandex_Mail_Checker |
| Поддержка | https://github.com/Ogurtsov-D/Yandex_Mail_Checker/issues |
| Политика конфиденциальности | https://github.com/Ogurtsov-D/Yandex_Mail_Checker/blob/main/PRIVACY.en.md |
| Цена | Бесплатно, все страны |
| Лицензия | GPL-3.0-only |

> Описание ниже вставляется в магазины как есть. Не добавляйте в него список адресов почты: Chrome Web Store считает перечисление доменов злоупотреблением ключевыми словами и отклоняет расширение.

## Подробное описание

### Русский

Филин показывает на значке в панели браузера, сколько у вас непрочитанных писем, и сообщает о новых письмах. Держать почту открытой не нужно.

Всё бесплатно: без подписок, платных функций и рекламы.

• Число непрочитанных писем во всех папках, кроме «Спама», — как в самой Яндекс Почте. Или только новые письма, пришедшие после вашего последнего захода в почту.
• Несколько аккаунтов — тоже бесплатно: считаются все ящики, в которые вы вошли, а не только выбранный в Яндексе. На значке — сумма, в подсказке — строка на каждый аккаунт, правый клик по значку открывает нужный ящик.
• Уведомления о новых письмах; клик по уведомлению открывает почту. Счётчик новых писем в самой почте при этом не сбрасывается.
• Клик по значку переключает на уже открытую почту, а если её нет — открывает во вкладке или в отдельном окне, как вы выберете.
• Яндекс Почта в разных странах и Яндекс 360, в том числе почта на своём домене: адрес почты выбирается в настройках.
• Тихие часы, звук уведомлений, интервал проверки от 1 до 30 минут, пауза, пока вы не за компьютером.
• Пять вариантов значка и свой цвет счётчика, горячая клавиша Alt+Shift+Y, интерфейс на 19 языках.

Правый клик по значку — меню: «Проверить сейчас», аккаунты, интервал, уведомления. Остальное — на странице настроек расширения.

Конфиденциальность: расширение обращается только к почте Яндекса с вашими обычными cookie. Серверов разработчика нет — ничего не отправляется ни автору, ни третьим лицам. Никакой аналитики. Расширение ничего не делает в почте: не отмечает письма прочитанными, не удаляет и не отправляет. Пароль ему не нужен.

Частые вопросы
• Не приходят уведомления — проверьте, что уведомления браузера разрешены в системе и не включён режим «Не беспокоить» / «Фокусировка».
• На значке «?» — войдите в Яндекс Почту в этом же браузере.
• Почта на другом адресе или в Яндекс 360 — выберите адрес в настройках расширения.

Открытый исходный код: https://github.com/Ogurtsov-D/Yandex_Mail_Checker
Нашли ошибку или неточность в переводе — напишите: https://github.com/Ogurtsov-D/Yandex_Mail_Checker/issues

Расширение — независимый проект и не связано с компанией Яндекс.

### English

Owl shows how many unread messages you have on its toolbar icon and notifies you about new mail. No need to keep your mailbox open.

Everything is free: no subscriptions, no paid features, no ads.

• Unread messages in all folders except Spam — the same number Yandex Mail shows. Or only new messages that arrived since your last visit to the mailbox.
• Several accounts, free as well: every mailbox you are signed in to is counted, not just the one selected in Yandex. The total on the icon, a line per account in the tooltip, and a right-click opens the mailbox you need.
• New mail notifications; click a notification to open your mailbox. The new mail count in Yandex Mail itself is not reset.
• Clicking the icon switches to your already open mailbox, or opens it in a tab or a separate window, as you choose.
• Yandex Mail in other countries and Yandex 360, including mail on your own domain: choose the mail address in the settings.
• Quiet hours, notification sound, check interval from 1 to 30 minutes, pause while you are away from the computer.
• Five icon styles and your own counter color, keyboard shortcut Alt+Shift+Y, interface in 19 languages.

Right-click the icon for the menu: "Check now", accounts, check interval, notifications. Everything else is on the extension settings page.

Privacy: the extension contacts only Yandex Mail, using your usual cookies. There are no developer servers — nothing is sent to the author or any third party. No analytics. It performs no actions in your mailbox: it does not mark messages as read, delete or send anything. It never needs your password.

FAQ
• No notifications — make sure your system allows notifications from the browser and Do Not Disturb / Focus is off.
• "?" on the icon — sign in to Yandex Mail in the same browser.
• Mail at another address or in Yandex 360 — choose the address in the extension settings.

Open source: https://github.com/Ogurtsov-D/Yandex_Mail_Checker
Found a bug or a translation mistake? Let us know: https://github.com/Ogurtsov-D/Yandex_Mail_Checker/issues

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

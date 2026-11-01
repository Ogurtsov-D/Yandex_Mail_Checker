# Checker for Yandex Mail

[Русский](README.md) · **English**

[![Latest release](https://img.shields.io/github/v/release/Ogurtsov-D/Yandex_Mail_Checker?label=release)](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/releases/latest)
[![Checks](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/actions/workflows/ci.yml/badge.svg)](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/actions/workflows/ci.yml)
![Chrome 121+](https://img.shields.io/badge/Chrome-121%2B-4285F4)
![Firefox 142+](https://img.shields.io/badge/Firefox-142%2B-FF7139)
[![License GPLv3](https://img.shields.io/badge/license-GPLv3-blue)](LICENSE)

**A browser extension that shows the number of unread Yandex Mail messages on the toolbar and notifies you about new mail.**

No need to keep your mailbox open: the extension checks your mail, shows the unread count on its icon and tells you about new messages with the sender and subject.

> **Unofficial extension.** Not affiliated with or endorsed by Yandex — [details](#relationship-with-yandex).

![Toolbar counter, menu and notifications](docs/screenshot-en.png)

<sub>Interface mockup: names and subjects are made up; menus and notifications look slightly different depending on your browser and OS.</sub>

## Features

- 🔢 **Unread counter** on the toolbar icon: all folders except Spam, the same as Yandex Mail's own counter, or new messages only
- 📬 **New mail notifications** with sender and subject; clicking one opens that message
- 🖱️ **Clicking the icon** switches to an already open mail tab instead of opening a new one
- ⚡ **Instant refresh**: read a message and the counter updates within seconds
- 🔕 **Sound and quiet hours**: make notifications silent (in Chrome) or turn them off at night
- ⏱️ **Check interval** of 1, 5, 15 or 30 minutes; mail is not checked while you are away from the computer
- ⌨️ **Keyboard shortcut** Alt+Shift+Y opens your mail
- ⚠️ **Clear errors**: "sign-in required", "no connection", "Yandex did not respond" — with hints on what to do
- 🌐 **Interface in 19 languages** — English, Russian, Ukrainian, Belarusian, Kazakh, Uzbek, Azerbaijani, Armenian, Georgian, Turkish, German, French, Romanian, Latvian, Estonian, Finnish, Hebrew and Chinese (Simplified and Traditional); chosen by your browser language. Found a translation mistake? [Let us know](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/issues/new/choose)
- 🔒 **No third-party servers**: your data never leaves the browser

## Installation

The extension is not yet listed in browser stores (Chrome Web Store and addons.mozilla.org are planned), so you install it from a release file. It takes about a minute.

### Chrome, Yandex Browser, Edge, Brave, Opera, Vivaldi

1. Download `yandex-mail-checker-…-chrome.zip` from the [latest release](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/releases/latest).
2. Unzip it into a permanent folder, e.g. `Documents/yandex-mail-checker`. **Do not delete it** — the browser loads the extension from that folder.
3. Open the extensions page: `chrome://extensions` (`browser://extensions` in Yandex Browser, `edge://extensions` in Edge).
4. Turn on **Developer mode** (a toggle in the top right or bottom left corner).
5. Click **Load unpacked** and select the unzipped folder.
6. Pin the icon to the toolbar (puzzle icon → 📌) and sign in to [Yandex Mail](https://mail.yandex.ru) if you haven't yet.

**Updating:** download the new archive, unzip it into the same folder replacing the files, and click ↻ on the extension card. Your settings are kept.

### Firefox

1. Download `yandex-mail-checker-…-firefox.xpi` from the [latest release](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/releases/latest).
2. Open `about:addons`, click ⚙ → **Install Add-on From File…** and choose the downloaded file. You can also drag the file into a Firefox window.
3. Confirm the installation and sign in to [Yandex Mail](https://mail.yandex.ru) if you haven't yet.

The `.xpi` file is signed by Mozilla: the extension stays installed and **updates automatically**.

### Requirements

| Browser | Version |
|---------|---------|
| Chrome and Chromium-based browsers | 121 or later |
| Firefox | 142 or later (Android is not supported) |

You need to be signed in to Yandex Mail in the same browser. By default the extension works with `mail.yandex.ru`; mail on `mail.yandex.com`, `.by`, `.kz`, `.com.tr` and Yandex 360 (`mail.360.yandex.ru`, including mail on your own domain) can be chosen in the settings — see ["Mail address"](#mail-address). Notifications work on Windows, macOS and Linux.

## How to use

| Action | Result |
|--------|--------|
| **Click** the icon | Opens your mail, or switches to the mail tab if it is already open |
| **Right-click** the icon | Menu: "Check now", check interval, what the badge shows, notifications, sound and quiet hours |
| **Alt+Shift+Y** | Same as clicking the icon. To change the shortcut: in Chrome — `chrome://extensions/shortcuts`, in Firefox — `about:addons` → ⚙ → "Manage Extension Shortcuts" |
| **Hover** over the icon | Tooltip: how many messages and when the last check was |
| **Click a notification** | Opens that message (or your Inbox if there are several) |

### What the badge means

| Badge | Meaning |
|-------|---------|
| **3** | 3 unread messages (more than 99 shows **99+**) |
| *(empty)* | No new mail |
| **?** | You need to sign in to Yandex Mail |
| **!** | Something went wrong — hover over the icon to see what |
| **↻** | A manual check is in progress |

The tooltip looks like this:

```
Yandex Mail: 3 unread messages, 1 new
Checked at 02:32 PM
```

"New" means messages that arrived after your last visit to the mailbox. Once you open your mail, this part of the tooltip disappears.

On errors it shows both the reason and the last successful result:

```
Yandex Mail: No connection
Last successful check at 02:20 PM: 3 unread messages
```

### Notifications

You get a notification when Yandex reports new messages. The sender and subject are taken from your Inbox; if a message went to another folder, the notification shows only the number of new messages. Messages that were already unread when you installed the extension are not reported. Once you open your mail, the new mail notification disappears by itself. If a mail tab is open, the message opens there; a tab where you are writing an email is never touched.

Right-click the icon → "Notifications":

- **"Show new mail notifications"** — turn notifications off completely;
- **"Sound"** — silent notifications (Chrome and Chromium-based browsers only; in Firefox the sound is controlled by your system settings);
- **"Quiet hours"** — no notifications at night, from 23:00 to 08:00 by default. You can change the time in the extension settings: right-click the icon → "Options" in Chrome, "Settings…" in Firefox. Messages that arrive during quiet hours are still shown on the counter.

### What the badge shows

Right-click the icon → "Badge shows": **"All unread messages"** (default) or **"New messages only"** — messages received since your last visit to the mailbox. In the second mode the badge clears as soon as you open your mail, even if some messages stay unread.

### Mail address

By default the extension works with `mail.yandex.ru`. If your mail is at `mail.yandex.com`, `mail.yandex.by`, `mail.yandex.kz`, `mail.yandex.com.tr` or in Yandex 360 (`mail.360.yandex.ru`, including mail on your own domain), choose the address in the extension settings (right-click the icon → "Options" in Chrome, "Settings…" in Firefox). The browser will ask for permission to access it.

### Several accounts

If you are signed in to several Yandex accounts, the extension counts mail in all of them:

- the badge shows the total, and the tooltip has a line for each account:
  ```
  Yandex Mail: 80 unread messages, 1 new
  Personal: 75 unread messages, 1 new
  Work: 5 unread messages
  Checked at 02:32 PM
  ```
- right-clicking the icon lists the accounts with their message counts; click an account to open its mailbox. The other menu items move to the "Settings" submenu;
- a notification is labelled with the account the messages arrived in, and clicking it opens that account. It has no sender or subject: the simplified version of Yandex Mail they come from shows only the default account;
- on the settings page you can name the accounts ("Account 1", "Account 2" by default) and uncheck an account to leave it out of the badge and notifications.

Clicking the icon does not pick an account: it switches to an open mail tab or, if there is none, opens mail in the account selected in Yandex. With one account everything works as before.

### While you are away

After 5 minutes of inactivity or when the screen is locked, scheduled checks pause; when you come back, mail is checked right away. You can turn the pause off in the extension settings.

## Troubleshooting

<details>
<summary><b>The badge shows "?" although I am signed in</b></summary>

The extension works with mail in the same browser profile, at the address chosen in the settings (`mail.yandex.ru` by default). Open `https://<mail address>/lite/inbox`, for example https://mail.yandex.ru/lite/inbox: if Yandex asks you to sign in, do so, then right-click the icon → "Check now". If your mail is at a different address, choose it in the settings.

</details>

<details>
<summary><b>The badge shows "!" and "Could not read the mail page"</b></summary>

Open https://mail.yandex.ru/lite/inbox. If Yandex shows a CAPTCHA, solve it. If the page opens normally but the error persists, Yandex has probably changed the page layout: please [report a bug](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/issues/new/choose).

</details>

<details>
<summary><b>The badge shows "!" and "No connection" / "Yandex did not respond in time"</b></summary>

A network problem or an issue on Yandex's side. The extension retries twice after 30 seconds and then continues on its regular schedule. You don't need to do anything.

</details>

<details>
<summary><b>Notifications don't appear</b></summary>

Check, in order:

1. Right-click the icon → "Notifications": "Show new mail notifications" is checked, and quiet hours are off or not in effect right now.
2. Your operating system allows notifications from the browser: Windows — Settings → System → Notifications; macOS — System Settings → Notifications.
3. Do Not Disturb / Focus mode is off.

</details>

<details>
<summary><b>Clicking a notification opens the wrong message</b></summary>

Please [report a bug](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/issues/new/choose) and include the address from the browser's address bar that you get when you open the message in your mailbox yourself (you can mask the message number with asterisks).

</details>

<details>
<summary><b>How to see the extension log</b></summary>

Chrome: `chrome://extensions` → extension card → **service worker** link → **Console** tab.
Firefox: `about:debugging#/runtime/this-firefox` → **Inspect** next to the extension → **Console**.

Remove any personal data before attaching the log to a bug report.

</details>

## Limitations

- Mail is checked at one address — the one chosen in the settings.
- Sender and subject in notifications come from the first Inbox page of the simplified (lite) version of Yandex Mail. If Yandex changes or retires it, notifications arrive without the sender and subject.
- The extension gets the counter from Yandex the same way the mail page does. If Yandex changes that, the extension falls back to counting via the lite version — the counter then covers the Inbox only.

## How it works

On every check the extension requests the mail counters (`https://mail.yandex.ru/api/v2/bar/counters`) with your usual Yandex cookies. These are two numbers: how many messages are unread (in all folders except Spam) and how many arrived since your last visit to the mailbox. The first number is shown on the icon. When the second one grows, the extension opens the simplified Inbox page (`https://mail.yandex.ru/lite/inbox`) — just as if you opened it yourself — and reads the ID, sender and subject of the new messages. The IDs are compared with the ones it already knows, so each message is reported only once. If you are signed in to several accounts, Yandex returns the counters for all of them in one response; the simplified page is not requested then, because it only shows the default account.

If the counters are unavailable, the extension counts unread messages using the simplified Inbox page.

Checks run on schedule, when you click "Check now", and a few seconds after you act in the mail tab — but no more often than once every 15 seconds. The time of scheduled checks varies slightly (up to ±12.5% of the interval), so requests don't follow a strict timer.

## Privacy

The extension contacts only Yandex Mail at the chosen address (`mail.yandex.ru` by default) and sends nothing to the author or any third party. The unread count, recent message IDs and settings are stored in your browser. Details are in the [privacy policy](PRIVACY.md) (in Russian).

| Permission | Why it is needed |
|------------|------------------|
| `https://mail.yandex.ru/*` | Read the counters and the message list; find an open mail tab and notice changes in it |
| `storage` | Keep settings and the result of the last check |
| `alarms` | Check mail on schedule |
| `notifications` | Show new mail notifications |
| `contextMenus` | Right-click menu on the icon |
| `https://mail.yandex.com/*`, `.by`, `.kz`, `.com.tr`, `https://mail.360.yandex.ru/*` | Optional: the browser asks for one only when you choose that mail address in the settings, and access to the previous address is given back when you switch |
| `idle` | Pause checks while you are away: the extension only learns whether the computer is active, idle or locked |

## Contributing

Bug reports and suggestions are welcome in [Issues](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/issues/new/choose) — in English or Russian. Report vulnerabilities only [privately](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/security/advisories/new); see [SECURITY.md](SECURITY.md). How the code is organized, how to run tests and how to release a new version is described in [CONTRIBUTING.md](CONTRIBUTING.md). Version history is in [CHANGELOG.md](CHANGELOG.md). These documents are in Russian.

## Acknowledgements

- Yandex — for the lightweight version of its mail service that this extension is built on.
- The authors of the tools that development relies on: [ESLint](https://eslint.org/), [Prettier](https://prettier.io/) and Mozilla's [web-ext](https://github.com/mozilla/web-ext).
- Everyone who reports bugs and suggests improvements — [contributors](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/graphs/contributors).

## Relationship with Yandex

This extension is an independent open-source project. It is not affiliated with or endorsed by Yandex. "Yandex" and "Yandex Mail" are trademarks of their owner and are used only to indicate which service the extension works with.

The extension only reads the mail counters and the Inbox page on behalf of a user who is already signed in: it does not bypass CAPTCHA or authentication, does not perform any actions in the mailbox and does not modify Yandex pages. Scheduled checks run no more than once a minute, checks after actions in the mail tab no more than once every 15 seconds.

If you represent Yandex and have questions about this project, please write in [Issues](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/issues) or, if the matter is not for public discussion, send a [private message](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/security/advisories/new). We will discuss changes to the project or its removal.

## License

© 2026 [Ogurtsov-D](https://github.com/Ogurtsov-D). Distributed under the [GNU GPL v3](LICENSE): you may use, modify and redistribute it under the same terms. Provided "as is", without any warranty.

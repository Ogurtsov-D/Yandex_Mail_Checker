# Privacy Policy

*[Русская версия](PRIVACY.md).* *Effective November 1, 2026, for the "Checker for Yandex Mail" browser extension (formerly Yandex Mail Checker), version 1.5.0 and later.*

"Checker for Yandex Mail" is an open-source browser extension. It does not collect user data and does not share it with the author or any third party.

## What the extension accesses

- **Only Yandex Mail at the address you choose** — `mail.yandex.ru` by default; in the settings you can choose `mail.yandex.com`, `.by`, `.kz`, `.com.tr` or Yandex 360 (`mail.360.yandex.ru`). The browser grants access to another address only after you confirm it, and the extension gives back access to the previous address when you switch. The extension requests the mail counters (`https://mail.yandex.ru/api/v2/bar/counters`: the number of unread and new messages). If you are signed in to several accounts, once a day it requests the list of accounts (`https://mail.yandex.ru/api/v2/bar/accounts`) and takes only the main email address of each account from it, to label the accounts; the other details in the response (name, date of birth, etc.) are not read or stored. Only if the counters are unavailable does it request the Inbox page (`https://mail.yandex.ru/lite/inbox`). The requests are sent with the cookies your browser already stores for Yandex. The extension never sees your password and does not store cookies.
- **Updates.** The version from the Firefox Add-ons catalog is updated by Firefox itself through the catalog; version 1.4 installed from an `.xpi` file checks for updates on `github.com`. The Chrome version installed from a release archive does not update by itself — a new version is installed the same way, manually. The extension sends nothing in either case.
- **Computer state** (the `idle` permission): whether the computer is active, idle or locked — so that mail is not checked while you are away. The extension does not learn what exactly you are doing and does not send this anywhere.
- **Mail tabs at the chosen address.** The extension sees the address and title of these tabs only: to switch to an open mailbox and to update the counter after you read mail. Addresses and content of other tabs are not available to it.

## What is stored and where

All data is stored **only in your browser** (`storage.local` and `storage.session`):

| Data | Why |
|------|-----|
| Number of unread and new messages, time and result of the last check | Show the badge and tooltip, notice new mail |
| The number of new messages in each account at the previous check; if the counters are unavailable, IDs of up to 100 recent unread messages | Avoid notifying about the same messages twice |
| Account numbers (uid), their main email addresses, message counts and the names you gave to accounts, if you are signed in to several accounts | Show the accounts in the tooltip, menu and notifications; remember which accounts to leave out |
| Settings: mail address, check interval, notifications, sound, quiet hours, what the badge shows, pause while away, icon style | Remember your choices |
| ID of the message from the last notification (until the browser is closed) | Open that message when you click the notification |

The sender and subject of messages are read only if the counters are unavailable — to show a notification — and are not stored.

## What the extension does not do

- It does not share your data with the author or any third party. Yandex only receives ordinary requests to your own mailbox (the counters and the Inbox page) with your cookies — the same as when you open your mail in the browser; the extension sends nothing beyond them.
- It does not use analytics, trackers or ads.
- It does not read message bodies and does not perform any actions in the mailbox (does not mark messages as read, delete or send anything).

## How to delete the data

Remove the extension — the browser will erase everything it stored.

## Questions

Ask in [Issues](https://github.com/Ogurtsov-D/Yandex_Mail_Checker/issues). The source code, which lets you verify everything above, is open in this repository.

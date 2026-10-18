# Better Sidebar Privacy Policy

Last updated: 2026-10-17

Better Sidebar is a Chrome extension that lets you put the channels you follow into your own groups in Twitch's sidebar. It is an independent project and is not affiliated with, endorsed by, or sponsored by Twitch.

## What the extension accesses

- **Your Twitch account.** The extension connects only the Twitch account that is signed in on twitch.tv in your browser. It uses Twitch's sign-in (OAuth) and asks for one permission, `user:read:follows`, which lets it read the list of channels you follow and which of them are live. It cannot follow, unfollow, chat, or change anything on your account.
- **Twitch pages.** On twitch.tv it reads the sidebar so it can show your groups there. It does not read or change anything else on the page, and it does not run on other sites.

## What is stored, and where

Your groups, your followed-channel list, your settings, and your Twitch login token are stored in your browser using `chrome.storage.local`. This data stays on your device. It is not sent to the developer or to any third party, and the extension has no server of its own.

## Who the extension talks to

Only Twitch's own servers:

- `id.twitch.tv`, to sign in and to check or revoke your token.
- `api.twitch.tv`, to read the channels you follow and their live status.

## What the extension does not do

- It does not collect analytics or telemetry.
- It does not use advertising, trackers, or third-party scripts.
- It does not sell, share, or transfer user data.
- It does not use your data for anything other than showing your groups in the Twitch sidebar.

## Removing your data

- **Logout** (in the extension's popup) deletes your token, tells Twitch to revoke it, and removes that account's groups and channel list from your browser. It does not sign you out of Twitch.
- If another Twitch account signs in on twitch.tv, the previous account's token, groups, and channel list are removed.
- Uninstalling the extension removes everything it stored. You can also revoke its access at any time in your Twitch settings under Connections.

## Contact

Questions or concerns: https://github.com/clgerhardt/better-twitch-sidebar-extension/issues

## Changes

If this policy changes, the new version will be published at this location with an updated date.

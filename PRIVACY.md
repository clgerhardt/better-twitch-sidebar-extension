# Better Sidebar Privacy Policy

Last updated: 2026-10-21

Better Sidebar is a Chrome extension that lets you put the channels you follow into your own groups in Twitch's sidebar. It is an independent project and is not affiliated with, endorsed by, or sponsored by Twitch.

## What the extension accesses

- **Your Twitch account.** The extension connects only the Twitch account that is signed in on twitch.tv in your browser. It uses Twitch's sign-in (OAuth) and asks for one permission, `user:read:follows`, which lets it read the list of channels you follow and which of them are live. It cannot follow, unfollow, chat, or change anything on your account.
- **Twitch pages.** On twitch.tv it reads the sidebar so it can show your groups there. It does not read or change anything else on the page, and it does not run on other sites.

## What is stored, and where

Your groups, your followed-channel list, your settings, and your Twitch login token are stored in your browser using `chrome.storage.local`. This data stays on your device. It is not sent to the developer or to any third party, and the extension has no server of its own.

**Syncing groups across your devices.** Your groups are also copied to `chrome.storage.sync`, so they follow you to your other browsers where you use Chrome with sync turned on. This covers the group names and their order, which group is the default, group colors, and which of your followed channels (by their Twitch login names) is in which group. It does not include your login token, your followed-channel list, or your settings. Chrome sends this to Google as part of your browser's own sync, under your Google account and its sync settings; the extension does not send it anywhere itself, and the developer cannot see it. Without Chrome sync, `chrome.storage.sync` only stays on your device. The copy is kept separately for each Twitch account. You can turn this off with "Turn off" next to "Groups sync across your devices" in the extension's popup, which stops further syncing and does not delete what was already synced. Turning it on again replaces this device's groups with the synced copy.

**Checking that Chrome sync is on.** The popup has a "Check Chrome sync" button. Tapping it makes Chrome ask whether to let the extension "know your email address" (the `identity.email` permission, which is optional and not requested at install). The extension uses it only to learn whether Chrome sync is turned on, to tell you if your groups are staying on this device; it does not read, store, or send the address. If you decline, nothing changes. You can take the permission back in `chrome://extensions` under the extension's details.

## Who the extension talks to

Only Twitch's own servers:

- `id.twitch.tv`, to sign in and to check or revoke your token.
- `api.twitch.tv`, to read the channels you follow and their live status.

The extension talks to no other server. The synced copy of your groups (above) is handled by Chrome's own sync.

## What the extension does not do

- It does not collect analytics or telemetry.
- It does not use advertising, trackers, or third-party scripts.
- It does not sell, share, or transfer user data.
- It does not use your data for anything other than showing your groups in the Twitch sidebar.

## Removing your data

- **Logout** (in the extension's popup) deletes your token, tells Twitch to revoke it, and removes that account's groups and channel list from this browser. It does not sign you out of Twitch. The synced copy of your groups is not deleted, so your groups come back when you connect that account again.
- If another Twitch account signs in on twitch.tv, the previous account's token, groups, and channel list are removed from this browser (the synced copy of that account's groups stays, kept separate).
- To delete the synced copy of your groups, clear your Chrome sync data at https://chrome.google.com/sync.
- Uninstalling the extension removes everything it stored on this device. You can also revoke its access at any time in your Twitch settings under Connections.

## Contact

Questions or concerns: https://github.com/clgerhardt/better-twitch-sidebar-extension/issues

## Changes

If this policy changes, the new version will be published at this location with an updated date.

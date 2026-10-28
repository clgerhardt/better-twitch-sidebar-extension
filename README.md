# Better Sidebar

A Chrome extension that lets you put the channels you follow into your own groups, right in Twitch's left sidebar. It keeps Twitch's look and feel: the rows are Twitch's own, the extension only adds the groups.

> Better Sidebar is an independent project. It is not affiliated with, endorsed by, or sponsored by Twitch.

## What it does

- **Groups in the sidebar.** Your followed channels are listed under groups you create. Every channel starts in "Ungrouped". Live channels come first, highest viewer count first, then offline channels.
- **Twitch's own rows.** Each channel is Twitch's own row (badges such as Watch Streak, "+1" shared streams, offline styling), so it looks and behaves like the original.
- **Fresh data.** Live status and viewer counts refresh about once a minute while a Twitch tab is in front, with a thin bar showing how old the data is. It does not poll while no Twitch tab is in front.
- **Manage Groups.** A dark two-pane dialog: groups on the left, and on the right the selected group with every channel to tick in or out of it, plus search. Create, rename and delete groups (names are 3 to 15 characters and unique whatever their capitalisation). Deleting a group sends its channels back to Ungrouped.
- **Collapsed sidebar.** When Twitch's side nav is collapsed, each group shows its initial, and hovering it names the group and its live count.
- **Your language.** The extension follows the language Twitch is set to (30 languages, including right to left Arabic). Game names come from Twitch's own rows, so they appear in your language; a live channel Twitch did not render a row for shows the game's English name, because Twitch's API has no translated game names.
- **Popup.** Hide Twitch's original followed list, the Stories section, or the live channels section, and log out. The settings apply to every open Twitch tab.

## Your account and your data

- **One account only.** The extension connects only the Twitch account that is signed in on twitch.tv in this browser, and it checks the account that authorized it. It never offers a way to sign in as anyone else.
- **What it asks for.** One permission: `user:read:follows`, which lets it read who you follow and which of them are live. It cannot follow, unfollow, chat or change anything on your account.
- **Where data lives.** Your groups, your channel list, your settings and your login token are stored in this browser (`chrome.storage.local`). The extension talks only to Twitch's own servers (`api.twitch.tv` for your follows, `id.twitch.tv` to sign in, check and revoke the token) and has no server of its own.
- **If something changes.**
  - Signing out of Twitch hides the groups and pauses refreshing. Nothing is deleted, and the same account signing back in gets its groups back.
  - If another account signs in on Twitch, the previous account's token, groups and channel list are removed, so one account's groups are never shown to another.
  - If Twitch stops accepting the saved login, the sidebar and popup show a Reconnect button. Your groups are kept.
  - **Logout** removes the token (and tells Twitch to revoke it) and all of that account's data. It does not sign you out of Twitch.
- Incognito mode is not supported.

## Install for development

You need Node 18, or 20 and newer, and [Yarn 1](https://classic.yarnpkg.com/).

1. **Create a Twitch application** at https://dev.twitch.tv/console/apps and copy its **Client ID**. No client secret is used: the extension signs in with Twitch's implicit flow.
2. **Configure the build.** Copy `.env.example` to `.env` and put the Client ID in `VITE_TWITCH_CLIENT_ID`.
3. **Install and build.**
   ```sh
   yarn
   yarn build:chrome
   ```
   The extension is built into `dist_chrome/`.
4. **Load it in Chrome.** Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked** and select `dist_chrome`.
5. **Register the redirect URL.** Chrome shows the extension's ID on its card. In your Twitch application add `https://<extension id>.chromiumapp.org/` as an OAuth Redirect URL. An unpacked extension's ID depends on where it is loaded from, so if the ID changes, register the new URL.
6. Open https://www.twitch.tv while signed in, click the extension's icon, and press **Connect**.

### Working on it

- `yarn dev` rebuilds on every change. Chrome gives each build new file names, so after a rebuild **reload the extension** on `chrome://extensions` and **refresh the Twitch tab**, or the sidebar will not appear.
- `VITE_LOGGER_LEVEL=debug yarn build:chrome` turns on the extension's debug log. Rebuild without it when you are done.
- `yarn typecheck` runs the TypeScript compiler over the project.
- Firefox is not supported yet. `yarn build:firefox` exists but is deferred and has not been kept up to date.

## Tests

The tests run in Playwright with its bundled Chromium, against a fake Twitch page and a stubbed Twitch API. They never use a real account or the real network, and they never log in.

```sh
npx playwright install chromium   # once
yarn test:e2e                     # builds the extension, then runs every test
```

Run a single file with `npx playwright test e2e/groups-dialog.spec.ts` (build first with `yarn build:chrome`, because `playwright test` does not rebuild).

## How it is organised

```
src/pages/
  background/   service worker: connect, refresh, account checks
  content/      what runs on twitch.tv: sidebar groups, Manage Groups dialog
  popup/        the toolbar popup
  options/      the options page (a placeholder for now)
  shared/       code shared by those parts (Twitch API client, snapshot, refresh rules, i18n)
  utils/        constants, logger, pure helpers (grouping, name rules)
e2e/            Playwright tests and the fake Twitch page they use
docs/design/    why it is built this way
```

The design notes in `docs/design/` explain the decisions: [the overhaul plan](docs/design/extension-overhaul.md), [moving Twitch fetching into the background](docs/design/background-fetch.md), [binding the extension to the signed-in Twitch account](docs/design/account-binding.md), [rendering from the page](docs/design/page-local-rendering.md) and [localization](docs/design/localization.md) (finding Twitch's sidebar in any language, the 30 languages the extension is shown in, and how to add one).

## Publishing

Run `yarn build:chrome`, zip the contents of `dist_chrome/`, and upload the zip to the [Chrome Web Store](https://developer.chrome.com/docs/webstore/publish/). Use your own name and branding that does not suggest a connection to Twitch.

## Contributing

Issues and pull requests are welcome. Please run `yarn typecheck` and `yarn test:e2e` before opening a pull request.

## License

MIT. See [LICENSE](LICENSE).

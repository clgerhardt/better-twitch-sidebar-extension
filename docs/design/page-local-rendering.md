# Plan: the page renders itself, no active-tab coupling

Status: draft for review. Follows `account-binding.md` and phase 6 of `background-fetch.md` (item 3, the part of the cleanup that is a redesign and not a deletion).

## Why

Two things still depend on the background guessing which tab the user is looking at, with `chrome.tabs.query({ active: true, currentWindow: true })`:

| What | How it works today | What goes wrong |
|---|---|---|
| Rendering the sidebar | The content script posts `FOLLOWED_CHANNELS_LOADED` on a long-lived port; the background asks the *active* tab for its id and replies with `RenderFollowersInSideBar` | A background tab, or any window where the popup or devtools is "active", gets the wrong id or none. The content script also needs a reconnect loop, a 20 second heartbeat and a re-request, only to survive the service worker restarting |
| Popup toggles (hide followed / stories / live) | The popup writes `globalState`, then sends a message to the *active* tab only | Other Twitch tabs do not update until reloaded. Opening the popup as a tab breaks it (`CLAUDE.md` has a rule for this) |
| Sidebar expanded or collapsed | The page's mutation observer posts to the background, which writes `sideBarStateByTab[tabId]` for the *active* tab; the sidebar reads it back by tab id | Two storage keys for the same thing (`sideBarStateByTab` with and without the prefix), per-tab state that is only a fact about the DOM, and the stored state can be for a different tab than the page that changed |

None of this needs the background. Everything the content script needs is on its own page or in `chrome.storage`.

Also found while reading this code: `attachStorageListener` in `background/storage.ts` logs the old and new value of every storage change to the service worker console, which includes `twitchToken`. It is only useful for debugging and should be deleted regardless.

## Target

The content script is self-contained:

1. **Mounts itself.** The setup it already runs (wait for the sidebar elements, apply visibility) ends by mounting the two React roots. No port, no heartbeat, no tab id.
2. **Reads expanded or collapsed from the page.** A small hook watches the `aria-label` of `[data-a-target=side-nav-arrow]` ("Collapse Side Nav" means expanded) with a MutationObserver and exposes a boolean. Nothing is stored. The `3.5rem` / `0rem` height of the Manage Groups root follows the same boolean.
3. **Applies toggles from storage.** The content script already has the hide/show code (`applySidebarVisibilityFromState`). It runs it on load and whenever `globalState` changes in `chrome.storage.onChanged`. The popup only writes `globalState`; it no longer needs to know which tab to message. Every open Twitch tab updates, active or not.
4. **Keeps its mount.** If Twitch re-renders the sidebar and our roots disappear, the same observer puts them back (today the port reconnect is what re-requests a render, which only covers one case).

The background keeps: install and update handling, Connect, refresh, account-switch watching. It loses the content-script port, `tabs.onUpdated`, `tabs.onRemoved`, the per-tab sidebar state and the storage logger.

## What goes away

- `chrome.runtime.onConnect` handler for `content-script`, and the content script's `openPort`, reconnect, `postToBackground`, heartbeat interval.
- `constants.portMessages`, the `SYS:Followers:*` render/expand/collapse/toggle message strings, `useSidebarState`, the `tabId` prop on `AccordianChannels` and `ManageGroupsCTA`.
- `SIDEBAR_STATE_KEY`, `sideBarStateByTab`, `updateSidebarState`, the `onUpdated` and `onRemoved` listeners (the `onUpdated` one also matches `https://twitch.tv` and so never fires for `www.twitch.tv`).
- The popup's `chrome.tabs.query` + `sendMessage` in `ToggleList`.
- `attachStorageListener`.
- Existing installs: remove the stale `sideBarStateByTab` keys once, on install or update (like `followedChannels`).

## Decision for you

Toggles currently reach only the active tab. Reading from storage makes them apply to **every** open Twitch tab, immediately. I recommend that, since it is the same setting for the whole browser profile. The alternative (per-tab toggles) would need per-tab storage, which is the thing being removed.

## Phases (each a reviewable commit, tests first)

1. **Expanded state from the page.** New hook; `AccordianChannels` and `ManageGroupsCTA` use it; `tabId` props go. Tests: collapsing and expanding on the fixture changes the sidebar and the Manage Groups height; no `sideBarStateByTab` is written; works while a second Twitch tab is in front.
2. **Toggles from storage.** Content applies `globalState` on change; popup stops messaging tabs. Tests: a toggle changes every open Twitch tab, including one in the background; the popup opened as a tab no longer matters.
3. **The page mounts itself.** Render from `setUpPage`, re-mount if the roots are removed; delete the port, heartbeat and reconnect code on both sides. Tests: the content script opens no port (`chrome.runtime.connect` call count is zero); the sidebar appears with the service worker stopped; removing `#__root` from the page brings it back.
4. **Delete the leftovers.** Background listeners, per-tab state, `attachStorageListener`, dead constants and messages; one-time storage cleanup. Update `CLAUDE.md` (the active-tab rule becomes unnecessary). Full suite plus a manual look in a real window.

## Risks

- **Twitch changes the collapse button.** The selector and the label text live in one place with a fixture test. If the button is missing, assume expanded.
- **Rendering before the sidebar exists.** `setUpPage` already waits up to five seconds for the sections; the mount stays behind that wait and the re-mount observer covers late or replaced sections.
- **Observer cost.** One observer on the sidebar container (not `document.body` with every subtree change, as the current one does); to be checked with a profile in phase 3.
- **The legacy port also kept the service worker alive.** Nothing in the page needs the worker to be alive any more: refreshes and Connect are one-shot messages that wake it.

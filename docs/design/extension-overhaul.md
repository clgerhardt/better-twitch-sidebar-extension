# Better Twitch Sidebar: overhaul design doc

Status: draft for review. No code changes accompany this doc.

## Context

The extension grew by accretion. Auth (Twitch OAuth) and API-backed channel loading were added on top of an older DOM-scraping design, so two data models now coexist and disagree. The goal of this doc is to agree on direction, reuse what works, and delete what doesn't before any refactor begins.

## Goals

1. **Augment Twitch, don't replace it.** Keep the same look and feel as Twitch's own channel rows. The extension only adds the group experience: group headers/sections and a way to manage groups. Rows may be recreated from Twitch-derived HTML templates filled with API data, but must look like native Twitch rows.
2. **Keep the auth integration.** Twitch OAuth via `chrome.identity` stays and becomes a first-class shared service (it will be needed for future features).
3. **One source of truth for state**, readable by the page (content script), popup, options page and background. Browser storage choices made deliberately.
4. **Conventional MV3 layout** with clear boundaries: background (service worker), content, popup/options, shared.
5. **Fresh-install and update safe.** Updating the extension never wipes user groups.

Non-goals (for now): offline mode, re-skinning Twitch UI. Firefox is deferred (see open items) but nothing should make it hard.

Agreed: groups and settings sync across devices (`chrome.storage.sync`); e2e tests (Playwright) come first.

## What exists and how it behaves today (verified in Chrome 154)

| Area | Files | Status |
|---|---|---|
| Content injection | `content/index.tsx` | Works: port to background, waits for sidebar, mounts React roots (`#__root`, `#__manage-groups-root`) before the "Live Channels" section |
| Auth | `utils/getValidTwitchToken.ts`, `hooks/userTwitchToken.ts`, `components/shared/Authenticate.tsx`, `manifest.json` oauth2 | Works (implicit grant, token + `tokenIssuedAt` in `chrome.storage.local`). `Authenticate.tsx` is not rendered anywhere. `fetchTwitchUser` is duplicated in it and in `Popup.tsx` |
| Channel data | `hooks/useSidebarGroups.ts` | Works: Twitch Helix `channels/followed` + `users` + `streams`, chunked, rate-limit retry. Runs in every tab on every page load, no caching |
| Sidebar UI | `AccordianChannels.tsx` | Renders groups as accordion with its own custom channel rows (the thing we want to stop doing). ~125 lines of dead commented code at top |
| Manage Groups dialog | `groups-dialog/*`, `ManageGroupsCta.tsx` | UI renders (z-index and blank-name error fixed). **Reads the wrong data**, so adding a group has no effect on the sidebar (see below) |
| Popup | `Popup.tsx`, `UserGreeting`, `GuestGreeting`, `UI/ToggleList.tsx` | Renders and shows the logged-in user. Toggles are meant to hide Followed Channels, Stories and Live Channels via DOM `display` but do not take effect (see known defects) |
| Background | `background/index.ts`, `storage.ts`, `utils.ts` | Mostly legacy: port message router, per-tab sidebar state, cookie-based login check |

## Known user-visible defects (reported from manual testing)

- **Popup toggles do nothing.** Toggling "Hide Original Followers List" / "Hide Stories" / "Hide Live Channels" does not change the Twitch UI. Cause not yet found. Suspect: `waitForSidebarElements` in `content/index.tsx` requires all three selectors (including `[class*='storiesLeftNavSection']`) and silently gives up after 5s, so saved visibility is never applied. Note the original followed list stayed visible on a default install even though `hideOriginalFollowersList` defaults to true.
- **Adding a group in Manage Groups does not appear in the sidebar.** Direct result of problem 1 below: the dialog writes `betterTwitchSidebar`, the sidebar reads `followedChannels`/`channelGroups`.

## Key problems found

1. **Two disjoint data models (the main bug).** Sidebar writes/reads `followedChannels` + `channelGroups`. The dialog hooks read `betterTwitchSidebar` + `bttvSidebar_channelGroups`. So the Manage Groups table shows "no records", and nothing the dialog writes reaches the sidebar. Verified in the browser.
2. **Legacy scraping path is dead weight.** Parsing the sidebar HTML (`parser.ts`, `observer.ts` channel-card observer, `waitUntilNoMoreShowMoreButton`, `INITALIZE_FOLLOWED_CHANNELS_FROM_HTML`, `InitializeFollowerSideContent`, `transformer.ts`, `merging.ts`, `channelGroupMap.ts`) is replaced by the API but still wired in.
3. **`onInstalled` calls `clearAllStorage()`.** Every extension update deletes the user's groups.
4. **`getLocalStorage` rejects on missing/falsy keys**, causing error logs on fresh install and making empty values (`[]`, `{}`, `false`) unstorable via `setLocalStorage`.
5. **"Active tab" coupling.** Background decides which tab to message and whose sidebar state to store via `tabs.query({active:true})`; popup/devtools/background tabs break it. Per-tab sidebar state is redundant (it is just a DOM fact).
6. **Storage listeners copy-pasted** in five hooks; fetch-then-subscribe logic repeated.
7. **Manifest hygiene:** placeholder name/description; content script `matches` includes `http://*/*` and `https://*/*` (runs everywhere); unused permissions (`bookmarks`, `webRequest`, `cookies`, `scripting`, `unlimitedStorage`); hard-coded extension id in `redirect_uri`; `devtools_page` / `panel` unused.
8. **Token handling:** implicit grant with an assumed 4h expiry rather than reading real `expires_in`; token is readable by the content script, which runs next to page code.
9. **Mock data** (~2.7k lines) shipped in source; `.env`-gated logger.

## Reuse / throw away

**Keep (move to shared where noted):**
- OAuth flow: `buildAuthUrl`, `extractTokenFromRedirectUrl`, silent re-auth, `chrome.identity.launchWebAuthFlow` -> becomes `shared/auth` service
- Helix fetching logic from `useSidebarGroups.ts` (`fetchChunked`, follows pagination, live map) -> `shared/twitch-api`, run in background, not per-page
- `GroupNameForm` validation, `ManageGroupsDialog` shell, `Groups/Channels` data tables (fix data source only)
- `domUtils` helpers (`getElementBySelector`, `createElement`, `insertBefore`), `applySidebarVisibilityFromState`, Tailwind setup, Vite configs and build scripts
- Popup shell and `ToggleList`
- `Group`, `Channel`, `GlobalState` models (trimmed; `Channel.expandedHTML` goes)

**Rewrite:**
- `AccordianChannels` -> a DOM-augmenting layer (see below), not a re-render of channel rows
- `background/index.ts` -> small service worker: auth, API refresh, alarms, storage migration; typed message handlers
- Storage: one typed `storage` module and one `useStorage(key)` hook replacing the five hooks and `getLocalStorage` rejection semantics

**Delete:** HTML-parsing path listed in problem 2, `InitializeFollowerSideContent`, per-tab `sideBarStateByTab`, cookie-based `isUserLoggedIn`, `mock/`, `devtools`/`panel` pages and the `devtools_page` manifest entry, commented-out code, `Authenticate.tsx` (or fold into popup), duplicate `fetchTwitchUser`.

## Proposed architecture

```
src/
  background/      service worker: auth, api refresh, migration, message router
  content/         twitch DOM augmentation + React islands
  popup/ options/  extension pages
  shared/
    storage/       typed keys, get/set/subscribe, schema version + migrations
    messaging/     typed message map (request/response), one place
    twitch/        auth + helix client + types
    models/        Group, Channel, Settings
```

**Storage:**
- `chrome.storage.local`: groups, channel->group map, cached followed/live snapshot, UI settings. Shared across page, popup, options, background; `onChanged` for sync.
- `chrome.storage.local` also holds the Twitch OAuth access token (`twitchToken`, plus expiry), persisted so users do not re-login every browser start (see Decisions).
- `chrome.storage.sync` (agreed): user's group definitions, channel->group assignments and toggles, so they follow the profile (8 KB/item, 100 KB total; keep the channel->group map compact and key by login or user id; watch quota with many follows).
- Page `localStorage` is not used (per-origin, invisible to popup).
- Every record versioned (`schemaVersion`); migration on `onInstalled(reason: "update")`, never `clear()`.

**DOM approach (decided: templates filled from API data):**
- Group sections and rows are rendered by the extension, but each row is built from an HTML *template* copied from Twitch's own row markup so it looks native, then filled with API data (name, game, viewers, image, link).
- Row variants seen so far: live with viewer count, offline (dimmed), "Watch Streak N", "Hype Train • Level N", shared stream ("+1"). Partner/verified badge and others to be confirmed during capture.
- Template source: prefer a real row cloned from the user's page at runtime (so we follow Twitch markup changes); fall back to captured fixtures checked into the repo. The same fixtures feed the e2e tests.
- Selectors and template variants live in one module with a smoke check, since Twitch markup changes without notice.
- Extension UI (group headers, Manage Groups button, dialog) rendered as React islands in a Shadow DOM so Tailwind and Twitch CSS stop bleeding into each other (also fixes the dark-input styling in the dialog).

**Data flow:** background owns fetching Helix data on an alarm + on demand, writes snapshot to storage; content/popup/options only read storage and send intent messages (create group, assign channel, refresh). No per-page API calls, no active-tab queries.

## Decisions (formerly open)

1. **Token stays in `chrome.storage.local`** so users are not asked to log in repeatedly. Keep the existing silent re-auth (`launchWebAuthFlow` with `interactive: false`) as the refresh path when the token expires or a Helix call returns 401, and read the real `expires_in` instead of assuming 4h. Interactive login only when silent re-auth fails. Content scripts should not read the token: only the background uses it (see data flow).
2. **Firefox: deferred.** Keep browser-specific pieces behind `shared/` wrappers (event page vs service worker, OAuth redirect URL, `browser` namespace) so adding it later is cheap. The repo already has a Firefox Vite config.
3. **`devtools` and `panel` pages: dropped** (template leftovers, unused by the product). Removed in phase 5, along with the `devtools_page` manifest entry.
4. **Rules of engagement for AI-driven test runs** are recorded in the repo `CLAUDE.md`.

## Proposed phasing (each a reviewable commit/PR)

0. **E2E harness (Playwright):** bundled Chromium with persistent context and the extension loaded; a local fixture page imitating the Twitch sidebar (captured HTML, covering the row variants); `api.twitch.tv` stubbed with `page.route`; token seeded into extension storage via the service worker. Login is never automated; a real-Twitch smoke check stays manual. Start with tests that capture the two known defects.
1. Docs + manifest cleanup (names, matches, permissions)
2. Shared storage + typed messaging + migration (no behaviour change; fixes `clear()` on update and the two-key bug)
3. Move auth + Helix client to background/shared; popup and content consume
4. Replace `AccordianChannels` with DOM-augmenting layer + Shadow DOM islands
5. Delete scraping path, mocks, dead code

## Verification (for the later implementation phases)

- Primary: Playwright e2e suite (phase 0), run in CI and locally
- Manual: `yarn build:chrome`; load via the CDP flow used in testing (`--enable-unsafe-extension-debugging`, `Extensions.loadUnpacked`) in a throwaway profile
- Logged-out, fresh-install, logged-in and extension-update (storage preserved) scenarios
- Dialog edits visibly change sidebar grouping; popup toggles apply to the open Twitch tab
- Rendered rows match the Twitch row templates for each variant (live, offline, watch streak, hype train, shared stream)

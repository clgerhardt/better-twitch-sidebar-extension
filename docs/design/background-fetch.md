# Plan: move the Twitch fetch into the background

Status: draft for review. Follows `extension-overhaul.md` (phase 3: "move auth + Helix client to background/shared").

## Why

Twitch data is fetched from three different places, each with its own copy of the logic, and nothing is cached:

| Where | What it calls | When |
|---|---|---|
| `content/hooks/useSidebarGroups.ts` | `channels/followed`, `users`, `streams` (Helix) | in every Twitch tab, on every page load, and again when the token or user changes |
| `popup/Popup.tsx` | `users` (current user) | each time the popup opens |
| `content/components/shared/Authenticate.tsx` | `users` (current user), plus the interactive login | rendered by `GuestGreeting`; also stores `twitchUserImage`, which Popup's copy does not |

Consequences today:
- Every tab and every page load re-downloads the whole follow list. Nothing is shared between tabs.
- The sidebar shows "Loading..." on each page load instead of the last known data.
- Viewer counts and live status are fixed at page load. They go stale until you refresh.
- The fetch has sequential pagination and a `delay(250)` after every chunk.
- No token handling in the fetch path: the token is read straight from storage. On a 401 the sidebar shows "Failed to fetch followed channels". Expiry is assumed to be 4 hours (`EXPIRES_IN_MS` in `getValidTwitchToken.ts`); the real `expires_in` is ignored.
- The auth code lives under `content/` but only runs in the popup (a content script cannot call `chrome.identity`).
- Three messaging mechanisms: a `content-script` port (render trigger, sidebar expand/collapse, heartbeat), a `popup` port (`SYS:User:LoggedIn`), and `tabs.sendMessage` (popup toggles to the page).

## Goals

1. **One place talks to Twitch:** the background service worker. Content, popup and options never call `api.twitch.tv`.
2. **Show last-known data instantly**, then refresh (stale-while-revalidate).
3. **Live data stays fresh** while a Twitch tab is open, without every tab fetching.
4. **Auth is handled in one place**, including 401 recovery, and never leaves the user stuck on a vague error.
5. **Tests prove it:** the content script makes zero Twitch API calls; one refresh serves all tabs.

Non-goals: changing the groups model (`groupNames`, `channelGroups`), the DOM/template work, `storage.sync`.

## Proposal

### Ownership

| Concern | Owner |
|---|---|
| Token, silent re-auth, interactive login, logout | background |
| Helix calls, paging, rate-limit retry | background (`shared/twitch/`) |
| Snapshot cache + refresh schedule | background |
| Grouping a snapshot into groups (pure function) | `shared/` (used by content and the dialog) |
| Rendering | content / popup (read storage only) |

### Data

Two tiers, because they change at very different speeds:

| Tier | Contents | Refresh |
|---|---|---|
| Static | followed channels: id, login, display name, profile image | on connect, then about every 10 minutes and on demand; profile images are only fetched for channels not seen before |
| Live | which followed channels are live: game, viewer count | about every 60 seconds while a Twitch tab is visible |

Verify in phase 2: `channels/followed` already returns `broadcaster_login` and `broadcaster_name`, so the `users` call is only needed for avatars. `streams/followed` may return the live followed channels in one paginated call and replace the chunked `streams` calls.

New storage keys (add to `constants.ts`):
- `channelSnapshot`: `{ version, fetchedAt, user, channels: [{ id, login, displayName, image, isLive, game, viewers }] }`
  The snapshot belongs to one Twitch user (`user.id`): it is cleared on logout and replaced when a different account connects, so one account's follow list is never shown to another (see the backlog in `extension-overhaul.md`).
- `authState`: `{ status: "connected" | "needs_login" | "error", reason? }`, so UIs can say why nothing loads

Existing keys stay as they are: `twitchToken`, `tokenIssuedAt`, `twitchUserId`, `twitchUserImage`, `groupNames`, `channelGroups`, `globalState`. No migration is needed. `followedChannels` (the derived group list the dialog reads) goes away once the dialog uses the shared layout function.

### Messaging

One-shot typed requests over `chrome.runtime.sendMessage`, replacing the three mechanisms where practical:

| Message | From | Does |
|---|---|---|
| `REFRESH` `{ force? }` | content, popup | refresh now (deduplicated: concurrent calls share one in-flight request) |
| `CONNECT` | popup | interactive login, then fetch |
| `LOGOUT` | popup | clear token and snapshot |
| `GET_AUTH_STATE` | popup, content | read `authState` (also available via storage) |

State changes travel through `chrome.storage.onChanged` on `channelSnapshot` and `authState`, so any number of tabs and the popup update together without the background tracking who is listening.

Kept as they are, for now: the content-script port for render trigger and expand/collapse, since those are page-local. They move onto `sendMessage` in a later cleanup.

### Refresh schedule

- **The visible tab drives it.** While a Twitch tab is visible, the sidebar asks for a refresh once the stored data is 60 seconds old (retrying every 15 seconds if that produces no new data), and again whenever the user switches back to the tab. Scheduling by the age of the data, not a fixed timer, keeps a thin progress bar above the groups honest: it fills over 60 seconds, restarts when fresh data arrives, and stays full while refreshes keep failing. Hidden tabs ask for nothing, so there is no network activity when nobody is looking at Twitch. This needs no new permission (the earlier idea of `chrome.alarms` is dropped: it would add a permission and wake the worker with no tab to show the result).
- The background skips any refresh if the snapshot is younger than 10 seconds, so several visible tabs (or tabs loading together) cause one fetch, not several.
- All fetches go through one deduplicated in-flight promise. Requests stay **sequential and paced** (concurrency 1). The existing `delay(250)` and 429 retry exist because rapid calls were rejected in practice; the reason was not recorded, so do not remove them on a hunch. Make the pacing header-driven: read `Ratelimit-Remaining` and `Ratelimit-Reset` from every response, wait until the reset time on a 429 (not a fixed second), and log each 429 with its endpoint so we learn what actually triggers them.

### Auth

- On a 401, the background tries one silent re-auth (`launchWebAuthFlow` with `interactive: false`), retries once, and otherwise sets `authState` to `needs_login`.
- Read the real `expires_in` from the redirect and store the expiry, instead of assuming 4 hours.
- Interactive login moves from `Authenticate.tsx` into a background handler; the popup button just sends `CONNECT`. `Popup.tsx` and `Authenticate.tsx` lose their duplicate `fetchTwitchUser`, and both read the user from the snapshot.
- Move `getValidTwitchToken` out of `content/` into `shared/twitch/`.

## Phases (each a reviewable commit, tests first)

1. **Pure layout function.** Extract `applyLayout` from `useSidebarGroups` into `shared/` (`layoutGroups(snapshot, groupNames, channelGroups)`). Node-only tests: ordering, empty groups, Ungrouped first, orphan groups, channels with no mapping. No behaviour change.
2. **Background Helix client + snapshot.** Add `shared/twitch/` and the `REFRESH` handler that writes `channelSnapshot`. Content's hook switches to reading the snapshot and sending `REFRESH`; its direct fetch code is deleted. Test: with the Helix stub, content-script frames make no `api.twitch.tv` requests (Playwright can tell service-worker requests from page requests); the sidebar still renders and group edits stay instant.
3. **Stale-while-revalidate.** Render from the stored snapshot immediately. Test: with a seeded snapshot and a slow stub, the sidebar shows channels before the stub responds.
4. **Live updates and progress bar.** The sidebar asks for a refresh when the stored data is 60 seconds old while its tab is visible, and when the user returns to the tab; a progress bar shows the data's age. Tests: the scheduling rules in node with a fake clock; returning to the tab updates viewer counts end to end; the bar's fill is measured on screen.
5. **Auth in the background.** `CONNECT`, `LOGOUT`, 401 recovery, real expiry, `authState`. Popup and `Authenticate.tsx` use messages. Tests: a 401 followed by a successful silent re-auth results in a retry that succeeds; a failed re-auth sets `needs_login` and the sidebar shows the logged-out view.
6. **Cleanup.** Remove `followedChannels`, the unused duplicates, and the content-script heartbeat if nothing needs it.

## Risks and open points

- **Service worker lifetime.** The worker is stopped when idle and restarted by alarms and messages. All state lives in storage, never in memory; the in-flight dedupe is only an optimisation.
- **Rate limits.** Measured on a real account (2026-10-09): `Ratelimit-Limit` was 800 per minute for the user token, each request costs 1, and 179 followed channels needed 6 calls (2 follow pages, 2 `users`, 2 `streams`), leaving the bucket almost untouched. That does not explain the 429s seen earlier with unpaced sequential calls: the docs say some 429s are endpoint-specific, so keep the pacing and learn from logged 429s. The calls in the page also each cost a CORS preflight; from the background there is none, so the same fetch takes about half the requests.
  Burst tests (2026-10-10, `users` endpoint, 100 logins per call, run from an extension page): 25 back-to-back sequential calls at about 8 per second all returned 200 and left the quota at 799; 20 truly simultaneous calls (distinct URLs, cache off) all returned 200, took 159 ms in total and dipped the quota to 780. (An earlier "parallel" run with identical URLs only looked sequential: Chrome's HTTP cache serializes identical concurrent requests.) So neither pattern is rejected today, `channels/followed` and `streams` were not burst-tested, and the original 429s could not be reproduced.
- **Silent re-auth** only works while the browser still has a Twitch session. If it does not, the user must click Connect again. Twitch's implicit flow gives no refresh token.
- **Token readable by content scripts.** It stays in `storage.local` (agreed: avoid repeated logins). Content scripts could read it, but they run in an isolated world the page cannot reach. After this change nothing in content needs it, so access could be tightened later.
- **Incognito.** The manifest uses `"incognito": "split"`; each profile keeps its own storage and snapshot, as today.

## Decisions (agreed)

1. **Refresh:** about every 60 seconds while a Twitch tab is visible; no network activity otherwise.
2. **Stale data:** show the last snapshot immediately on page load, then refresh quietly.
3. **Login:** the interactive Twitch login moves into the background in the first pass (phase 5), along with token refresh and 401 recovery.

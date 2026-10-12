# Plan: the extension follows the Twitch account signed in on twitch.tv

Status: agreed direction, not built. Follows `background-fetch.md` (phase 5, auth) and changes one earlier decision (see "What this replaces").

## Rule

The extension only works for the Twitch account that is signed in on twitch.tv in this browser. It does not offer a way to sign in to Twitch, and it does not connect a different account than the one the browser is signed in to.

## Why

- The extension's "Connect" is an authorization for the extension, not a Twitch login. Words like "Twitch login expired" confuse people about their real Twitch session, so the UI says "extension connection" instead.
- Groups, the follow list and the token belong to one account. Tying them to the signed-in Twitch account keeps one account's data from showing up for another on a shared browser.
- Supporting "log in to some other account through the extension" is extra surface (a sign-out redirect that is not documented, `force_verify` prompts, a window the user can cancel) for a case we do not want to support.

## How the extension knows who is signed in

Twitch's `twilight-user` cookie is readable from a twitch.tv page (checked in Chrome 154 with a real session: it holds the account's numeric `id`, `login` and `displayName`; it also holds a token, which the extension must never read or store). The content script reads `id` and `login` only. No new permission is needed. This is a page-side signal that Twitch could change, so it is read in one function with a test, and an unreadable cookie is treated as "unknown", never as "signed out".

The token's owner comes from Twitch's validate call (`user_id`), which the background already uses for expiry.

States, computed from (page account, connected account, token state):

| State | Meaning | Sidebar shows |
|---|---|---|
| signed_out | no Twitch account signed in on the page | one line: sign in to Twitch first; no groups, no Manage Groups button, no Connect |
| not_connected | signed in on Twitch, extension never connected (or disconnected) | not-logged-in style view with a Connect button |
| connected | page account equals connected account, token works | groups as today |
| expired | page account equals connected account, token rejected and quiet renewal failed | compact view: "Extension connection expired" and a Reconnect button; no groups, no Manage Groups button; stored groups are kept |
| switched | page account differs from connected account | previous account's data is cleared; then behaves as not_connected for the new account |

Unknown page account (cookie unreadable): behave as `connected` or `expired` according to the token alone; never wipe on unknown.

## Connect

- Plain authorize URL, no `force_verify`, no Twitch sign-out redirect. With a Twitch session in the browser, Twitch approves silently, so the token belongs to the signed-in account.
- After the redirect, validate the token and require `user_id` equal to the page account. A mismatch refuses the connection and stores nothing.
- Connect is only offered (and only accepted by the background) when a signed-in page account is known. The page sends the account id with the request; the background re-checks it against validate.
- Reconnect after expiry is the same flow and keeps the stored groups, because the account is the same.

## Logout

- Clears the extension's data for the account (groups, mappings, snapshot, token) and revokes the token, as today.
- Does not sign the user out of Twitch. The sign-out redirect added for account switching is removed.
- The logged-out flag still stops quiet re-login, so a logout is not undone by the browser's still-valid Twitch session until the user connects again.

## Account switch

When the page account differs from the connected one (the user switched accounts on Twitch), the extension clears the previous account's data and tokens (decision: clear, rather than keep the old data hidden). The new account must press Connect; nothing is connected automatically. This covers the privacy rule that one account's groups never appear for another.

## UI

The sidebar has limited room, so every non-connected state is one compact block in the style of the existing not-logged-in view (heading, one or two lines, at most one button) at Twitch's 14px text size. Groups and the Manage Groups button are not rendered in those states. The popup mirrors the state (Connect / Reconnect / Logout) and is the place for longer explanations.

## What this replaces

- `buildSwitchAccountUrl` and the "first Connect after logout signs out of Twitch" behaviour (backlog item 2 in `extension-overhaul.md`). The privacy goal of that item is now met by account matching instead.
- `force_verify=true` on Connect.
- The `twitch.tv/login` link in the not-logged-in view, which is Twitch's own login and not the extension's Connect.
- The uncommitted "reconnect row above the groups" draft from the phase 5 work.

## Phases (each a reviewable commit, tests first)

1. Read the page account from the cookie (one function, tested against fixture cookies including missing, malformed and logged-out); content script publishes it to the background.
2. Connect validates the token owner against the page account and refuses a mismatch; drop `force_verify` and the sign-out redirect; Logout stops signing out of Twitch.
3. Account switch: clear data when the page account differs from the connected one.
4. Sidebar states: one compact view per state, no groups or Manage Groups button unless connected; wording "extension connection".
5. Popup mirrors the states.

## Risks and open points

- The cookie is Twitch's internal format. If it changes, the extension sees "unknown" and falls back to the token alone, so the failure is a weaker check, not a wipe.
- A user who is signed in on Twitch in another browser profile or tab group is not detected; only twitch.tv pages in this profile count.
- Silent authorize depends on the browser's Twitch session. If it is gone, Connect cannot proceed and the view says to sign in to Twitch first.
- Incognito stays unsupported (`inIncognitoContext`).

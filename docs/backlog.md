# Backlog

## Verify the Streaks hide toggle

"Hide streaks" is wired (`#side-nav .side-nav-section[aria-label*='streak' i]` in `src/pages/content/index.tsx`) but the selector is a guess: no Streaks section was on the test account. Check it on an account that has one and fix the selector if needed.

## Group accent color picker

Add a color picker so each group can change its vertical purple bar to a different color.

## Shared-stream hover tooltip ("Live with")

Hovering a shared stream's row (name with "+N") should show Twitch's tooltip with the title and the "Live with:" list. It is built (the content is copied from Twitch's own tooltip for the hidden native row) but has only been verified against the e2e fixture, not a real shared stream. Check it on a live shared stream, and consider using the same copy for other extras Twitch shows (e.g. Hype Train level).

## Localization

Add support for other languages. All UI text (popup, dialog, sidebar, tooltips) is currently hard-coded English.

## Newly followed channels are slow to show up

After following a channel, Twitch's followed-channels API lags before it includes the new channel, so it takes a while to appear in the sidebar. Look for ways to shorten or hide that delay (for example: pick up the follow from the page as it happens, retry the follow list a few times after a follow is detected, or add the channel optimistically).

## Sync groups and channel assignments across the Chrome profile

Keep the groups, their order, the default group and which channel is in which group in sync across the user's devices, through their Chrome profile (`chrome.storage.sync`) instead of the local-only `chrome.storage.local`. Things to work out: `chrome.storage.sync` has small quotas (about 100 KB in total, 8 KB per item), and the channel-to-group map grows with the follow list, so it needs a compact format or splitting across items; what happens when two devices change groups at once; and the sign-in, the stored follows snapshot and other per-device data must stay local.

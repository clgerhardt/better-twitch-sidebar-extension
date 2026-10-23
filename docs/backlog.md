# Backlog

## Shared-stream hover tooltip ("Live with")

Hovering a shared stream's row (name with "+N") should show Twitch's tooltip with the title and the "Live with:" list. It is built (the content is copied from Twitch's own tooltip for the hidden native row) but has only been verified against the e2e fixture, not a real shared stream. Check it on a live shared stream, and consider using the same copy for other extras Twitch shows (e.g. Hype Train level).

## Localization

Add support for other languages. All UI text (popup, dialog, sidebar, tooltips) is currently hard-coded English.

## Sync groups and channel assignments across the Chrome profile

Keep the groups, their order, the default group and which channel is in which group in sync across the user's devices, through their Chrome profile (`chrome.storage.sync`) instead of the local-only `chrome.storage.local`. Things to work out: `chrome.storage.sync` has small quotas (about 100 KB in total, 8 KB per item), and the channel-to-group map grows with the follow list, so it needs a compact format or splitting across items; what happens when two devices change groups at once; and the sign-in, the stored follows snapshot and other per-device data must stay local.

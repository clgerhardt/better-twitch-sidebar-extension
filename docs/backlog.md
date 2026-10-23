# Backlog

## Shared-stream hover tooltip ("Live with")

Hovering a shared stream's row (name with "+N") should show Twitch's tooltip with the title and the "Live with:" list. It is built (the content is copied from Twitch's own tooltip for the hidden native row) but has only been verified against the e2e fixture, not a real shared stream. Check it on a live shared stream, and consider using the same copy for other extras Twitch shows (e.g. Hype Train level).

## Localization

Add support for other languages. All UI text (popup, dialog, sidebar, tooltips) is currently hard-coded English.

## Sync the hide toggles across devices

Groups sync across the Chrome profile; the popup's hide toggles (original followers list, stories, live channels, streaks, recommended categories, "viewers also watch") stay on each device. Consider syncing them through the same hash and merge machinery (`src/pages/shared/groupsSync`). Open question: whether some should stay per device (for example hiding sections on a small laptop screen only), which would need a per-toggle choice or a "sync settings" switch of its own.

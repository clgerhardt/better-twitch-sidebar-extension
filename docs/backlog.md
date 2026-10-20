# Backlog

## Verify the Streaks hide toggle

"Hide streaks" is wired (`#side-nav .side-nav-section[aria-label*='streak' i]` in `src/pages/content/index.tsx`) but the selector is a guess: no Streaks section was on the test account. Check it on an account that has one and fix the selector if needed.

## Group accent color picker

Add a color picker so each group can change its vertical purple bar to a different color.

## Shared-stream hover tooltip ("Live with")

Hovering a shared stream's row (name with "+N") should show Twitch's tooltip with the title and the "Live with:" list. It is built (the content is copied from Twitch's own tooltip for the hidden native row) but has only been verified against the e2e fixture, not a real shared stream. Check it on a live shared stream, and consider using the same copy for other extras Twitch shows (e.g. Hype Train level).

## Change and rename the default group

Let the user choose which group is the default (where new channels land) and rename it. The default group is currently the fixed "Ungrouped", which can't be renamed or deleted, and always sits first. Once it can be renamed and swapped, it has to be reorderable like any other group.

## Localization

Add support for other languages. All UI text (popup, dialog, sidebar, tooltips) is currently hard-coded English.

## Profanity check on group names

Add a profanity check to group name validation (`src/pages/utils/groupName.ts`), alongside the existing length and uniqueness rules.

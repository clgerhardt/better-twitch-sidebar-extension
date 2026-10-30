# Backlog

## Sync the hide toggles across devices

Groups sync across the Chrome profile; the popup's hide toggles (original followers list, stories, live channels, streaks, recommended categories, "viewers also watch") stay on each device. Consider syncing them through the same hash and merge machinery (`src/pages/shared/groupsSync`). Open question: whether some should stay per device (for example hiding sections on a small laptop screen only), which would need a per-toggle choice or a "sync settings" switch of its own.

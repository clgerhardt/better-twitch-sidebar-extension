# Backlog

## Translation follow-ups

The extension works with Twitch in any language and its own text is translated into every language Twitch offers (see `docs/design/localization.md`). Left for later:
- Have native speakers review the translations (all but English were drafted, not reviewed), in particular "Sin conexión" in Spanish, which was not checked against Twitch's own row.
- Game names: Twitch's API (Helix) has no locale support (checked `locale`, `language`, `Accept-Language`), so a live channel with no native Twitch row shows the English name. Rows copied from Twitch's own keep Twitch's localized name.
- Check the hover tooltip and the dialog with the longest languages on a live Twitch page (the tests check for overflow, not for looks).


## Sync the hide toggles across devices

Groups sync across the Chrome profile; the popup's hide toggles (original followers list, stories, live channels, streaks, recommended categories, "viewers also watch") stay on each device. Consider syncing them through the same hash and merge machinery (`src/pages/shared/groupsSync`). Open question: whether some should stay per device (for example hiding sections on a small laptop screen only), which would need a per-toggle choice or a "sync settings" switch of its own.

## Tell the user when Chrome sync is not signed in

The popup now says that group syncing goes through Chrome sync, but it can't tell whether the user is actually signed in, so someone who never signs in to Chrome sees an "on" switch that syncs nothing. Detecting it (`chrome.identity.getProfileUserInfo`) returns an empty account unless the `identity.email` permission is added, which shows a "read your email address" warning at install. Decide whether that trade-off is worth it, or find another signal.

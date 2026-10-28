# Localization

Status: built. Two separate things had to work for the extension to be usable outside English.

## 1. Finding Twitch's sidebar in any language

Twitch translates its labels ("Followed Channels" is "Canales que sigo" in Spanish). The extension used to find Twitch's sections by those labels, so with Twitch in another language it did not mount at all.

It now finds each section by what is inside it, which is the same in every language (`src/pages/content/twitchSections.ts`, the only place that knows this markup):

| Section | Marker |
| --- | --- |
| Followed channels | rows with `data-test-selector="followed-channel"` (or the `followed-side-nav-header` class when there are none) |
| Live channels | rows with `data-test-selector="recommended-channel"` |
| Recommended categories | links to `/directory/category/...` |
| Viewers also watch | rows with `data-test-selector="similarity-channel"` |
| Streaks | the `saveYourStreakSideNavRow` class |
| Collapsed sidebar | the collapsed sidebar is a different element (`data-a-target="side-nav-bar-collapsed"`, class `side-nav--collapsed`) |

The follow button's label ("Seguir a ...") is not parsed either: the channel comes from the page's address.

To see Twitch in another language without touching the account, set the `language` cookie on twitch.tv (for example `es-ES`) and reload. The tests do the equivalent with a fixture whose labels are swapped, for Spanish and for a made-up language, so nothing can depend on one language's text.

## 2. The extension's own text

`src/pages/shared/i18n/`:

- `languages.ts` lists the 30 languages the extension is shown in: every language Twitch's menu offers. Each has a code, its own name (what the popup lists), a direction, and Twitch's codes for it. `resolveLanguage` maps a language tag to a catalog (exact tag, then known aliases such as `pt` to `pt-BR` and `zh-Hant` to `zh-TW`, then the base language).
- `catalog.en.ts` is the source: every message, keyed (`"popup.logout"`). A message is a string or plural forms chosen by `count`; `{name}` is replaced by the value passed as `name`. Each language is `catalogs/<code>.ts`, typed against those keys, so a missing or extra key does not compile. A plural message has the categories its language needs (`Intl.PluralRules`): English `one, other`; Russian `one, few, many, other`; Arabic all six; Japanese just `other`.
- `i18n.ts` (pure) fills in a message. `store.ts` holds the current language for the browser side and loads its catalog on demand (one small chunk per language, so the script that runs on every Twitch page stays small): `useT()` in components, `t()` elsewhere.
- Which language: always Twitch's. A Twitch page uses its own `<html lang>` and follows it when Twitch changes it without a reload; the popup uses the last one a page was seen in. Chrome's language is the fallback, then English. There is no language setting in the popup.
- Right to left (Arabic): layouts use logical CSS (`ms-`, `me-`, `border-s`, `text-start`), `dir` is set on the extension's roots, and tooltips open on the side of the element that has room.
- The built-in default group is stored as "Ungrouped" (so synced devices agree) and shown as `group.default.name` in the user's language until someone gives it a name of their own (`groupLabel`). Names the user chooses are never translated.
- The profanity check for group names is English only.
- The extension's name and description (what Chrome and the Web Store show) are in `src/locales/<language>/messages.json` (Chrome's folder names: `zh_CN`, `pt_BR`, `en_GB`).

### Adding a language

1. Add it to `LANGUAGES` in `languages.ts` and create `catalogs/<code>.ts` (copy another and translate it; the compiler lists anything missing, and the tests check the plural forms).
2. Add `src/locales/<folder>/messages.json` (keep the description within the Web Store's 132 characters).
3. Run `yarn test:e2e`: the catalog tests check keys, placeholders and plural categories, and the browser tests check every language for overflow and direction.

All the translations except English were drafted, not reviewed by native speakers: have each reviewed before release.

### Testing

`qps` is the standard pseudo-locale (not offered to users): every message becomes accented look-alike letters in brackets. `e2e/i18nBrowser.spec.ts` switches to it and sweeps the sidebar, the dialog and the popup for any visible text or label that is not bracketed, which finds text that was never moved into the catalog. It also opens the dialog and the popup in every language and checks the text, the direction and that nothing overflows its box.

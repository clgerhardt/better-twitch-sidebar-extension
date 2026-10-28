// Twitch's own channel rows. Twitch renders the user's followed channels into a section that the
// extension usually hides, but the rows stay in the page, so they can be found and cloned.
// All selectors that depend on Twitch's markup are here, because that markup changes without notice.

// Twitch's rows for the channels the user follows (the data-a-id is removed from our copies)
export const NATIVE_ROW = "a[data-a-id^='followed-channel']";
// Stable, readable class names (not the generated ones)
export const OFFLINE_LINK_CLASSES = ["side-nav-card__link--offline", "side-nav-card__link--empty-category"];
export const OFFLINE_AVATAR_CLASS = "side-nav-card__avatar--offline";

const TITLE = "[data-a-target=side-nav-title]";
const METADATA = "[data-a-target=side-nav-card-metadata]";
const STATUS = "[data-a-target=side-nav-live-status]";
const LIVE_INDICATOR = ".tw-channel-status-indicator";

export const nativeRows = (): HTMLAnchorElement[] => Array.from(document.querySelectorAll<HTMLAnchorElement>(NATIVE_ROW));

// "/Some_Channel?x=1" -> "some_channel"
export const loginOfRow = (row: Element): string =>
  (row.getAttribute("href") || "").replace(/^\//, "").split(/[/?#]/)[0].toLowerCase();

export const isLiveRow = (row: Element): boolean => !!row.querySelector(LIVE_INDICATOR);

// A live row with none of the extras (a second avatar for shared streams, Watch Streak, Hype Train,
// "+N" in the name): the one to copy when building a row from a template
export const isPlainLiveRow = (row: Element): boolean =>
  isLiveRow(row) &&
  row.querySelectorAll("img").length === 1 &&
  // Streak and Hype Train badges are a second block beside the name and status, whatever language their text is in
  row.children[1]?.children.length === 1 &&
  !/\+\d+\s*$/.test(row.querySelector(TITLE)?.textContent || "");

// A shared stream: the row's name block has a paragraph with "+N" for the guests
export const isSharedRow = (row: Element): boolean =>
  Array.from(row.querySelectorAll("[data-a-target=side-nav-card-metadata] p")).some((p) => /^\+\d+$/.test(p.textContent?.trim() ?? ""));

export const nativeRowsByLogin = (): Map<string, HTMLAnchorElement> => {
  const rows = new Map<string, HTMLAnchorElement>();
  for (const row of nativeRows()) rows.set(loginOfRow(row), row);
  return rows;
};

// Changes when Twitch adds, removes or switches (live/offline) rows, so rows can be rebuilt
export const nativeRowsSignature = (): string => nativeRows().map((r) => `${loginOfRow(r)}:${isLiveRow(r) ? 1 : 0}`).join(",");

export const selectors = { TITLE, METADATA, STATUS, LIVE_INDICATOR };

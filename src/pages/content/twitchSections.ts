// Finds Twitch's sidebar sections by what is inside them, never by their label. Twitch translates the
// labels ("Followed Channels" is "Canales que sigo" in Spanish), while the markers used here are the same
// in every language. All selectors that depend on Twitch's markup for this are here, because that markup
// changes without notice.

// The sidebar: expanded and collapsed are different elements, with these data-a-target values
const SIDEBAR = '[data-a-target^="side-nav-bar"]';
const SECTION = "[role='group']";

const sectionOf = (marker: Element | null | undefined): HTMLElement | null => marker?.closest<HTMLElement>(SECTION) ?? null;
const within = (selector: string) => document.querySelector(`${SIDEBAR} ${selector}`);

// Twitch's own list of the channels the user follows (the rows, or its header when there are none)
export const findFollowedSection = () => sectionOf(within("[data-test-selector='followed-channel'], .followed-side-nav-header"));
// "Live channels": the recommended live channels
export const findLiveSection = () => sectionOf(within("[data-test-selector='recommended-channel']"));
export const findRecommendedCategoriesSection = () => sectionOf(within("a[href^='/directory/category/']"));
// "<channel> viewers also watch": only on channel pages
export const findViewersAlsoWatchSection = () => sectionOf(within("[data-test-selector='similarity-channel']"));
// "Watch Streaks at risk": a group holding the Save your Streak row
export const findStreaksSection = () => {
  const row = within("[class*='saveYourStreakSideNavRow']");
  return sectionOf(row) ?? (row as HTMLElement | null);
};
export const findStoriesSection = () => document.querySelector<HTMLElement>("[class*='storiesLeftNavSection']");

// Where the extension's groups go: in front of the live channels, or failing that the recommended categories
export const findMountAnchor = () => findLiveSection() ?? findRecommendedCategoriesSection();

// Twitch swaps the whole sidebar element when it collapses (the collapsed one is side-nav-bar-collapsed)
export const isSidebarCollapsed = () => !!document.querySelector(`.side-nav--collapsed, [data-a-target="side-nav-bar-collapsed"]`);

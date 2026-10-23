export type GlobalState = {
  loggedIn: boolean;
  lastUpdated: string;
  hideOriginalFollowersList: boolean;
  hideStories?: boolean;
  hideLiveChannels?: boolean;
  hideStreaks?: boolean;
  hideRecommendedCategories?: boolean;
  hideViewersAlsoWatch?: boolean;
  // Sync groups across the user's devices (on unless switched off)
  syncGroups?: boolean;
};
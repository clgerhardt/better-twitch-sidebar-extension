export type GlobalState = {
  loggedIn: boolean;
  followersListInitialized: boolean;
  initializationDate: string;
  lastUpdated: string;
  hideOriginalFollowersList: boolean;
  hideStories?: boolean;
  hideLiveChannels?: boolean;
};
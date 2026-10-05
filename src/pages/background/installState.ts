import { GlobalState } from "../models/GlobalState";

// Pure helpers for chrome.runtime.onInstalled so the decision can be tested without a browser.
// Only a genuine first install may reset storage; updates and reloads must keep user data.

export const shouldClearStorage = (reason: string): boolean => reason === "install";

export const resolveGlobalState = (
  reason: string,
  existing: Partial<GlobalState> | undefined,
  defaults: GlobalState
): GlobalState => {
  if (reason === "install" || !existing) return defaults;
  return { ...defaults, ...existing };
};

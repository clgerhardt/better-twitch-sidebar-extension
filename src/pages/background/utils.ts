import { GlobalState } from "../models/GlobalState";
import { constants, GLOBAL_STATE_KEY, SIDEBAR_STATE_KEY } from "../utils/constants";
import { messageLogger } from "../utils/logger";
import { getLocalStorage, setLocalStorage } from "./storage";

// utils.js
export async function getGlobalState() {
  return getLocalStorage(GLOBAL_STATE_KEY);
}

export async function setGlobalState(globalState: GlobalState) {
  return setLocalStorage(GLOBAL_STATE_KEY, globalState);
}

export async function updateSidebarState(tabId: number, state: any) {
  const data: any  = await getLocalStorage(SIDEBAR_STATE_KEY);
  const updatedData = {
    ...data,
    [tabId]: state,
  };
  return setLocalStorage(SIDEBAR_STATE_KEY, updatedData);
}

export async function isUserLoggedIn(): Promise<boolean> {
  const { BACKGROUND } = constants.location;
  messageLogger(BACKGROUND, "Checking for logged in user");

  try {
    // In MV3 this returns a Promise; if not, you can wrap the callback instead
    const cookie = await getLoginCookieForCurrentContext();

    const loggedIn = Boolean(cookie);
    messageLogger(
      BACKGROUND,
      loggedIn ? "User logged in" : "No login cookie found",
      cookie
    );
    return loggedIn;

  } catch (err) {
    messageLogger(BACKGROUND, "Error checking for logged in user", err);
    return false;
  }
}

////// INTERNAL FUNCTIONS //////

async function getLoginCookieForCurrentContext(): Promise<chrome.cookies.Cookie|null> {
  // 1) Figure out which tabs are incognito vs. non-incognito
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const stores = await chrome.cookies.getAllCookieStores();
  messageLogger(constants.location.BACKGROUND, "Current tab", tab);
  messageLogger(constants.location.BACKGROUND, "Cookie stores", stores);

  // 2) Find the store matching our tab
  const currentStore = stores.find(s => s.tabIds.includes(tab.id!));
  if (!currentStore) {
    console.warn("Couldn't find cookie store for tab", tab);
    return null;
  }

  // 3) Fetch the cookie from that specific store
  return chrome.cookies.get({
    url:     "https://twitch.tv",
    name:    "login",
    storeId: currentStore.id
  });
}
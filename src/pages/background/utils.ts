import { GlobalState } from "../models/GlobalState";
import { GLOBAL_STATE_KEY, SIDEBAR_STATE_KEY } from "../utils/constants";
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

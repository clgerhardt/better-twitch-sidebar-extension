import { constants } from "../utils/constants";
import { messageLogger } from "../utils/logger";

export const getSyncStorage = async (key: string) => {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([key], (result) => {
      messageLogger(constants.location.STORAGE, "getSyncStorage", result[key])
      resolve(result[key]);
    });
  });
}

export const setSyncStorage = async (key: string, value: any) => {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({[key]: value}, () => {
      messageLogger(constants.location.STORAGE, "setSyncStorage", value)
      resolve(value);
    });
  });
}

export const getLocalStorage = (key: string) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      messageLogger(constants.location.STORAGE, `getLocalStorage key ${key} result`, result[key])
      if(result[key])
        resolve(result[key]);
      else
        reject("cannot get value from local storage: " + key);
    });
  });
}

export const setLocalStorage = async (key: string, value: any) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({[key]: value}, () => {
      messageLogger(constants.location.STORAGE, "setLocalStorage", value)
      if(value)
        resolve(value);
      else
        reject("cannot set value in local storage");
    });
  });
}

export const clearAllStorage = (): Promise<boolean> => {
  messageLogger(constants.location.BACKGROUND, "Clearing all storage");
  return new Promise(resolve => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        console.error("Error clearing storage:", chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

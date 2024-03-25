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
      messageLogger(constants.location.STORAGE, "getLocalStorage", result[key])
      if(result[key])
        resolve(result[key]);
      else
        reject("cannot get value from local storage");
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

export const attachStorageListener = () => {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
      console.log(
        `Storage key "${key}" in namespace "${namespace}" changed.`,
        `Old value was "${oldValue}", new value is "${newValue}".`
      );
    }
  });
};
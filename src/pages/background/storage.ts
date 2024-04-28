import { constants } from "../utils/constants";
import { messageLogger } from "../utils/logger";
import { followerDataV1 } from "../mock/followers_data_v1";
import { followerDataV2 } from "../mock/followers_data_v2";
import { followerDataV3 } from "../mock/followers_data_v3";

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
      else {
        if(import.meta.env.VITE_USE_MOCK) {
          const mockValue = getMockStorage();
          setLocalStorage(key, mockValue);
          resolve(mockValue)
        } else {
          reject("cannot get value from local storage");
        }
      }
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

const getMockStorage = () => {
  let mockedValue;
  switch(import.meta.env.VITE_MOCK_FILE) {
    case "v3":
      mockedValue = followerDataV3;
      break;
    case "v2":
      mockedValue = followerDataV2;
      break;
    case "v1":
    default:
      mockedValue = followerDataV1;
      break;
  }
  messageLogger(constants.location.STORAGE, "getMockStorage", mockedValue);
  return mockedValue;
}
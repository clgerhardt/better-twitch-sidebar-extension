import { constants } from "../utils/constants";
import { messageLogger } from "../utils/logger";
import { attachStorageListener, setLocalStorage } from "./storage";

messageLogger(constants.location.BACKGROUND, "background script loaded");
attachStorageListener();

chrome.runtime.onInstalled.addListener(() => {
    messageLogger(constants.location.BACKGROUND, "I just installed my chrome extension");
})

const initFollowersData = (data: any) => {
    if(data) {
        return {default: { order: 0, items: [...data]}};
    } else {
       return {default: { order: 0, items: []}};
    }
};

chrome.runtime.onConnect.addListener((port) => {
    if(port.name === 'content-script') {
        port.onMessage.addListener((response) => {
            messageLogger(constants.location.BACKGROUND, "posted message", response);
            switch(response.message) {
                case "SYS:Followers:FOLLOWED_CHANNELS_LOADED":
                    port.postMessage({message: "SYS:Followers:PARSE_FOLLOWED_CHANNELS_HTML"});
                    break;
                case "SYS:Followers:FOLLOWED_CHANNELS_PARSED":
                    setLocalStorage(constants.storage.localStorageKey, initFollowersData(response.data))
                    port.postMessage({message: "SYS:Followers:RenderFollowersInSideBar"});
                    break;
                default:
                    messageLogger(constants.location.BACKGROUND, "no action found", response);
            }
        });
    }
});
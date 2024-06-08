import { Group } from "../models/Group";
import { constants } from "../utils/constants";
import { messageLogger } from "../utils/logger";
import { attachStorageListener, setLocalStorage } from "./storage";

messageLogger(constants.location.BACKGROUND, "background script loaded");
attachStorageListener();

chrome.runtime.onInstalled.addListener(() => {
    messageLogger(constants.location.BACKGROUND, "I just installed my chrome extension");
})

const initFollowersData = (data: any) => {
    const group: Group = {
        default: true,
        order: 0,
        groupName: "Default",
        numberOfChannels: 0,
        numberOfLiveChannels: 0,
        dialogOpen: false,
        dropdownVisible: false,
        followedChannels: []
    };
    if(data) {
        // return {default: { order: 0, items: [...data]}};
        group.followedChannels = data;
        return [
            group
        ] as Group[];
    } else {
        //    return {default: { order: 0, items: []}};
       return [
        group
        ] as Group[];
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
                    if(import.meta.env.VITE_USE_MOCK)
                        chrome.storage.local.remove(constants.storage.localStorageKey);
                    if(!import.meta.env.VITE_USE_MOCK)
                        setLocalStorage(constants.storage.localStorageKey, initFollowersData(response.data))
                    port.postMessage({message: "SYS:Followers:RenderFollowersInSideBar"});
                    break;
                case "SYS:Followers:EXPANDED_SIDEBAR":
                    setLocalStorage(constants.storage.prefix + constants.storage.sideBarState, {sidebarExpanded: true});
                    break;
                case "SYS:Followers:COLLAPSED_SIDEBAR":
                    setLocalStorage(constants.storage.prefix + constants.storage.sideBarState, {sidebarExpanded: false});
                    break;
                default:
                    messageLogger(constants.location.BACKGROUND, "no action found", response);
            }
        });
    }
});
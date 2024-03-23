import { getStorage, getStorageLocal } from "./storage";

console.log('background script loaded');

chrome.runtime.onInstalled.addListener(() => {
    console.log("I just installed my chrome extension");
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
            console.log("posted message", response);
            switch(response.message) {
                case "SYS:Followers:FOLLOWED_CHANNELS_LOADED":
                    port.postMessage({message: "SYS:Followers:PARSE_FOLLOWED_CHANNELS_HTML"});
                    break;
                case "SYS:Followers:FOLLOWED_CHANNELS_PARSED":
                    let data = initFollowersData(response.data);
                    // chrome.storage.local.set({followedChannels: JSON.stringify(response.data)});
                    chrome.storage.sync.set({followedChannels: response.data});
                    getStorage("followedChannels").then((data) => { console.log(data) });
                    port.postMessage({message: "SYS:Followers:STORE_IN_LOCAL", data: data});
                    break;
                case "SYS:Followers:STORED_IN_LOCAL":
                    port.postMessage({message: "SYS:UI:RenderFollowersInSideBar"});
                    break;
                case "SYS:UI:SIDEBAR_EXPAND_COLLAPSE_CTA_CLICKED":
                    port.postMessage({message: "SYS:UI:RenderFollowersInSideBar", isSideBarExpanded: response.sideBarIsExpanded})
                    break;
                default:
                    console.log("no action found");
            }
        });
    }
});

// chrome.tabs.onActivated.addListener((activeInfo) => {
//     chrome.tabs.get(activeInfo.tabId, function (tab) {
//         if(tab?.url?.includes("twitch.tv")) {
//             console.log("we are on a twitch site");
//         } else {
//             console.log("Would like to set different popup context if not on twitch")

//         }
//     });
// });

// chrome?.tabs?.query({active: true, currentWindow: true}, function(tabs){
//     console.log(tabs);
//     console.log("current url: ", tabs[0].url)
//     // chrome.tabs.sendMessage(tabs[0].id, {action: "open_dialog_box"}, function(response) {});
// });

// chrome.bookmarks.onCreated.addListener(() => {
//     console.log("I just installed my chrome extension");
// })
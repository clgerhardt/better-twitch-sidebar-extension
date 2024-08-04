import { Channel } from "../models/Channel";

export const followersListParser = (
  followedChannelsCards: NodeListOf<Element>
) => {
  const followerData: Channel[] = [];
  followedChannelsCards.forEach((item: Element) => {
    const imageNode = item.querySelector("img");
    const liveStatus = item.querySelectorAll(
      '[data-a-target="side-nav-live-status"] p'
    );
    followerData.push({
      channelName: imageNode?.alt ?? "",
      channelLink: `https://twitch.tv${item.getAttribute("href")}`,
      channelImage: imageNode?.src ?? "",
      isLive: liveStatus.length > 0,
      viewerCount: liveStatus.length > 0 ? liveStatus[1].innerHTML : "",
      streamingContent:
        (liveStatus.length > 0
          ? item?.querySelector('[data-a-target="side-nav-game-title"] p')
              ?.innerHTML
          : "") ?? "",
      expandedHTML: item.innerHTML,
    });
  });
  return followerData;
};

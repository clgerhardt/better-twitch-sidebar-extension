import { setLocalStorage } from "@src/pages/background/storage";
import { CHANNEL_GROUPS_KEY } from "@src/pages/utils/constants";


export const updateChannelGroupMap = (channelGroupMap: any, groups: any, groupName: string) => {
  groups.forEach((channel: any) => {
    channelGroupMap[channel.channelName] = groupName;
  });
  setLocalStorage(
    CHANNEL_GROUPS_KEY,
    channelGroupMap
  );
};
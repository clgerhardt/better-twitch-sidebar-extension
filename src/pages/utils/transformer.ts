import { Group } from "../models/Group";

export const initFollowersData = (data: any) => {
  const group: Group = {
    default: true,
    order: 0,
    groupName: "Default",
    numberOfChannels: 0,
    numberOfLiveChannels: 0,
    dialogOpen: false,
    dropdownVisible: false,
    followedChannels: [],
  };
  if (data) {
    const channelGroupMap: any = {};
    data.forEach((channel: any) => {
      channelGroupMap[channel.channelName] = "Default";
    });
    group.followedChannels = data;
    group.numberOfChannels = data.length;
    return { groupsList: [group] as Group[], channelGroupMap: channelGroupMap };
  } else {
    return { groupsList: [group] as Group[] };
  }
};
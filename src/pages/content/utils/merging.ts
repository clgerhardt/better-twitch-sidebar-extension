import { Channel } from "@src/pages/models/Channel";
import { Group } from "@src/pages/models/Group";

export const mergeChannels = (groups: Group[], channels: Channel[], target?: string, origin?: string) => {
  const newGroups = groups.map(group => {
    if ((target === undefined && group.default) || group.groupName.toLowerCase() === target?.toLowerCase()) {
      const newChannels = group.followedChannels.concat(channels);
      return {
        ...group,
        followedChannels: newChannels,
        numberOfChannels: newChannels.length
      };
    }
    if(origin && group.groupName.toLowerCase() === origin.toLowerCase()) {
      channels.forEach(channel => {
        group.followedChannels = group.followedChannels.filter(c => c.channelName !== channel.channelName);
      });
      return {
        ...group,
        numberOfChannels: group.followedChannels.length
      };
    }
    return group;
  });
  return newGroups;
};
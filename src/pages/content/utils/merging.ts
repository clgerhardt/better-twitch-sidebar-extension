import { Channel } from "@src/pages/models/Channel";
import { Group } from "@src/pages/models/Group";

export const mergeChannels = (groups: Group[], channels: Channel[], target?: string) => {
  const newGroups = groups.map(group => {
    if ((target === undefined && group.default) || group.groupName === target) {
      const newChannels = group.followedChannels.concat(channels);
      return {
        ...group,
        followedChannels: newChannels,
        numberOfChannels: newChannels.length
      };
    }
    return group;
  });
  return newGroups;
};
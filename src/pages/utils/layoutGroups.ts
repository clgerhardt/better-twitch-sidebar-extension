// Pure grouping logic, shared by anything that shows groups. No chrome.* or Vite imports, so it can
// be tested in plain node.

export type SidebarChannel = {
  login: string;
  channelImage: string;
  channelLink: string;
  channelName: string;
  isLive: boolean;
  // The number behind viewerCount, for sorting (0 when offline)
  viewers: number;
  streamingContent?: string;
  streamTitle?: string;
  viewerCount?: string;
};

export type SidebarGroup = {
  default: boolean;
  dialogOpen: boolean;
  dropdownVisible: boolean;
  followedChannels: SidebarChannel[];
  groupName: string;
  numberOfChannels: number;
  numberOfLiveChannels: number;
  order: number;
};

export type FetchedChannel = { login: string; channel: SidebarChannel };

export const UNGROUPED = "Ungrouped";

type LayoutInput = {
  fetched: FetchedChannel[];
  // User-created groups in their saved order (Ungrouped is implicit)
  groupNames: string[];
  // Channel login -> group name
  channelGroups: Record<string, string>;
};

type LayoutResult = {
  groups: SidebarGroup[];
  // channelGroups plus a mapping to Ungrouped for every channel that had none
  channelGroups: Record<string, string>;
  // True when channelGroups gained entries and should be saved
  addedMappings: boolean;
};

// Live channels first, most viewers first; offline channels follow. Array.sort is stable, so
// channels that tie (all offline ones, or equal viewer counts) keep the order Twitch gave them.
const byLiveThenViewers = (a: SidebarChannel, b: SidebarChannel) => {
  if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
  return a.isLive ? b.viewers - a.viewers : 0;
};

export const layoutGroups = ({ fetched, groupNames, channelGroups }: LayoutInput): LayoutResult => {
  const updatedChannelGroups: Record<string, string> = { ...channelGroups };
  const groupMap: Record<string, SidebarChannel[]> = {};
  let addedMappings = false;

  fetched.forEach(({ login, channel }) => {
    const groupName = updatedChannelGroups[login] || UNGROUPED;

    if (!updatedChannelGroups[login]) {
      updatedChannelGroups[login] = UNGROUPED;
      addedMappings = true;
    }

    if (!groupMap[groupName]) groupMap[groupName] = [];
    groupMap[groupName].push(channel);
  });

  // Ungrouped first, then user-created groups in order (including empty ones),
  // then any group that only exists in the channel map
  const savedNames = groupNames.filter((n, i) => n !== UNGROUPED && groupNames.indexOf(n) === i);
  const orderedNames = [
    UNGROUPED,
    ...savedNames,
    ...Object.keys(groupMap).filter((n) => n !== UNGROUPED && !savedNames.includes(n)),
  ];

  const groups = orderedNames.map((groupName, index): SidebarGroup => {
    const channels = [...(groupMap[groupName] ?? [])];
    return {
      default: groupName === UNGROUPED,
      dialogOpen: false,
      dropdownVisible: false,
      followedChannels: channels.sort(byLiveThenViewers),
      groupName,
      numberOfChannels: channels.length,
      numberOfLiveChannels: channels.filter((c) => c.isLive).length,
      order: index,
    };
  });

  return { groups, channelGroups: updatedChannelGroups, addedMappings };
};

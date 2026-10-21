// Pure grouping logic, shared by anything that shows groups. No chrome.* or Vite imports, so it can
// be tested in plain node.
import { normalizeGroupColor } from "./groupColor";

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
  // The accent color the user picked ('#rrggbb'); absent for the default purple
  color?: string;
  numberOfChannels: number;
  numberOfLiveChannels: number;
  order: number;
};

export type FetchedChannel = { login: string; channel: SidebarChannel };

export const UNGROUPED = "Ungrouped";

type LayoutInput = {
  fetched: FetchedChannel[];
  // The groups in their saved order. The default group may be left out (older data, or never
  // reordered): it is then shown first.
  groupNames: string[];
  // The group that channels without one land in; "Ungrouped" until the user picks another
  defaultGroup?: string;
  // Group name -> accent color
  groupColors?: Record<string, string>;
  // Channel login -> group name
  channelGroups: Record<string, string>;
};

type LayoutResult = {
  groups: SidebarGroup[];
  // channelGroups plus a mapping to the default group for every channel that had none
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

export const layoutGroups = ({ fetched, groupNames, channelGroups, defaultGroup = UNGROUPED, groupColors = {} }: LayoutInput): LayoutResult => {
  const updatedChannelGroups: Record<string, string> = { ...channelGroups };
  const groupMap: Record<string, SidebarChannel[]> = {};
  let addedMappings = false;

  fetched.forEach(({ login, channel }) => {
    const groupName = updatedChannelGroups[login] || defaultGroup;

    if (!updatedChannelGroups[login]) {
      updatedChannelGroups[login] = defaultGroup;
      addedMappings = true;
    }

    if (!groupMap[groupName]) groupMap[groupName] = [];
    groupMap[groupName].push(channel);
  });

  // The saved order (the default group first when it is not in it), then any group that only
  // exists in the channel map
  const savedNames = groupNames.filter((n, i) => groupNames.indexOf(n) === i);
  const orderedNames = [
    ...(savedNames.includes(defaultGroup) ? [] : [defaultGroup]),
    ...savedNames,
    ...Object.keys(groupMap).filter((n) => n !== defaultGroup && !savedNames.includes(n)),
  ];

  const groups = orderedNames.map((groupName, index): SidebarGroup => {
    const channels = [...(groupMap[groupName] ?? [])];
    return {
      default: groupName === defaultGroup,
      dialogOpen: false,
      dropdownVisible: false,
      followedChannels: channels.sort(byLiveThenViewers),
      groupName,
      color: normalizeGroupColor(groupColors[groupName]),
      numberOfChannels: channels.length,
      numberOfLiveChannels: channels.filter((c) => c.isLive).length,
      order: index,
    };
  });

  return { groups, channelGroups: updatedChannelGroups, addedMappings };
};

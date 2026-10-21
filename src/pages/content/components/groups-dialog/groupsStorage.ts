import { CHANNEL_GROUPS_KEY, DEFAULT_GROUP_KEY, GROUP_COLORS_KEY, GROUP_NAMES_KEY } from "@src/pages/utils/constants";
import { normalizeGroupColor } from "@src/pages/utils/groupColor";

// What the Manage Groups dialog changes in storage. The sidebar and the dialog both read from storage,
// so a write here updates both. The default group ("Ungrouped" until the user picks another) is where
// channels without a group land. It is an ordinary group in the name list, except that older data
// leaves it out and shows it first.
const UNGROUPED = "Ungrouped";

const read = async () => {
  const stored = await chrome.storage.local.get([GROUP_NAMES_KEY, CHANNEL_GROUPS_KEY, DEFAULT_GROUP_KEY, GROUP_COLORS_KEY]);
  return {
    groupColors: (stored[GROUP_COLORS_KEY] as Record<string, string> | undefined) ?? {},
    groupNames: (stored[GROUP_NAMES_KEY] as string[] | undefined) ?? [],
    channelGroups: (stored[CHANNEL_GROUPS_KEY] as Record<string, string> | undefined) ?? {},
    defaultGroup: (stored[DEFAULT_GROUP_KEY] as string | undefined) ?? UNGROUPED,
  };
};

export const addGroup = async (name: string) => {
  const { groupNames } = await read();
  await chrome.storage.local.set({ [GROUP_NAMES_KEY]: [...groupNames, name] });
};

// Moves a group one place up (-1) or down (1). order is every group as shown, default group included:
// saving it whole also keeps groups that were only shown because a channel uses them.
export const moveGroup = async (name: string, step: -1 | 1, order: string[]) => {
  const from = order.indexOf(name);
  const to = from + step;
  if (from === -1 || to < 0 || to >= order.length) return;
  const moved = [...order];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  await chrome.storage.local.set({ [GROUP_NAMES_KEY]: moved });
};

// Makes another group the default. order is every group as shown, so the old default stays in the list
// (it was only implied to be first) as a group like any other.
export const setDefaultGroup = async (name: string, order: string[]) => {
  await chrome.storage.local.set({ [DEFAULT_GROUP_KEY]: name, [GROUP_NAMES_KEY]: order });
};

// Sets a group's accent color; null puts it back to the default purple
export const setGroupColor = async (name: string, color: string | null) => {
  const { groupColors } = await read();
  const { [name]: _removed, ...rest } = groupColors;
  const valid = normalizeGroupColor(color);
  await chrome.storage.local.set({ [GROUP_COLORS_KEY]: valid ? { ...rest, [name]: valid } : rest });
};

export const renameGroup = async (from: string, to: string) => {
  const { groupNames, channelGroups, defaultGroup, groupColors } = await read();
  const { [from]: color, ...otherColors } = groupColors;
  await chrome.storage.local.set({
    [GROUP_COLORS_KEY]: color ? { ...otherColors, [to]: color } : otherColors,
    [GROUP_NAMES_KEY]: groupNames.map((n) => (n === from ? to : n)),
    [CHANNEL_GROUPS_KEY]: Object.fromEntries(Object.entries(channelGroups).map(([login, name]) => [login, name === from ? to : name])),
    [DEFAULT_GROUP_KEY]: defaultGroup === from ? to : defaultGroup,
  });
};

// A deleted group's channels go to the default group. The default group itself cannot be deleted.
export const deleteGroup = async (name: string) => {
  const { groupNames, channelGroups, defaultGroup, groupColors } = await read();
  if (name === defaultGroup) return;
  const { [name]: _removed, ...otherColors } = groupColors;
  await chrome.storage.local.set({
    [GROUP_COLORS_KEY]: otherColors,
    [GROUP_NAMES_KEY]: groupNames.filter((n) => n !== name),
    [CHANNEL_GROUPS_KEY]: Object.fromEntries(Object.entries(channelGroups).map(([login, group]) => [login, group === name ? defaultGroup : group])),
  });
};

export const setChannelGroup = async (login: string, group: string) => {
  const { channelGroups } = await read();
  await chrome.storage.local.set({ [CHANNEL_GROUPS_KEY]: { ...channelGroups, [login]: group } });
};

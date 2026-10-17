import { CHANNEL_GROUPS_KEY, GROUP_NAMES_KEY } from "@src/pages/utils/constants";

// What the Manage Groups dialog changes in storage. The sidebar and the dialog both read from storage,
// so a write here updates both. "Ungrouped" is the default group and is never stored in the name list.
const UNGROUPED = "Ungrouped";

const read = async () => {
  const stored = await chrome.storage.local.get([GROUP_NAMES_KEY, CHANNEL_GROUPS_KEY]);
  return {
    groupNames: (stored[GROUP_NAMES_KEY] as string[] | undefined) ?? [],
    channelGroups: (stored[CHANNEL_GROUPS_KEY] as Record<string, string> | undefined) ?? {},
  };
};

export const addGroup = async (name: string) => {
  const { groupNames } = await read();
  await chrome.storage.local.set({ [GROUP_NAMES_KEY]: [...groupNames, name] });
};

export const renameGroup = async (from: string, to: string) => {
  const { groupNames, channelGroups } = await read();
  await chrome.storage.local.set({
    [GROUP_NAMES_KEY]: groupNames.map((n) => (n === from ? to : n)),
    [CHANNEL_GROUPS_KEY]: Object.fromEntries(Object.entries(channelGroups).map(([login, name]) => [login, name === from ? to : name])),
  });
};

// A deleted group's channels go back to Ungrouped
export const deleteGroup = async (name: string) => {
  const { groupNames, channelGroups } = await read();
  await chrome.storage.local.set({
    [GROUP_NAMES_KEY]: groupNames.filter((n) => n !== name),
    [CHANNEL_GROUPS_KEY]: Object.fromEntries(Object.entries(channelGroups).map(([login, group]) => [login, group === name ? UNGROUPED : group])),
  });
};

export const setChannelGroup = async (login: string, group: string) => {
  const { channelGroups } = await read();
  await chrome.storage.local.set({ [CHANNEL_GROUPS_KEY]: { ...channelGroups, [login]: group } });
};

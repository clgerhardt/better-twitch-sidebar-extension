import { UNGROUPED, type SidebarGroup } from "@src/pages/utils/layoutGroups";
import type { Translator } from "@src/pages/shared/i18n/i18n";

// How a group's name is shown. The default group starts out named "Ungrouped": that is stored as is (so
// devices in different languages agree), and shown in the user's language for as long as nobody has given
// it a name of their own. A name the user chose is never translated.
export const groupLabel = (group: Pick<SidebarGroup, "groupName" | "default">, t: Translator): string =>
  group.default && group.groupName === UNGROUPED ? t("group.default.name") : group.groupName;

// The same for a group known only by its name, in a list of all groups
export const groupLabelByName = (name: string, groups: Pick<SidebarGroup, "groupName" | "default">[], t: Translator): string => {
  const group = groups.find((g) => g.groupName === name);
  return group ? groupLabel(group, t) : name;
};

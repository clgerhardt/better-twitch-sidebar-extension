import { useEffect, useState } from "react";
import { CheckIcon, PencilIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { SidebarGroup } from "@src/pages/utils/layoutGroups";
import { validateGroupName } from "@src/pages/utils/groupName";
import { DEFAULT_GROUP_COLOR, GROUP_COLOR_CHOICES } from "@src/pages/utils/groupColor";
import { deleteGroup, renameGroup, setChannelGroup, setDefaultGroup, setGroupColor } from "./groupsStorage";

// The right pane: the selected group (rename, delete) and the channels to tick in or out of it
export default function GroupDetail({
  group,
  groups,
  onSelect,
}: {
  group: SidebarGroup;
  groups: SidebarGroup[];
  onSelect: (name: string) => void;
}) {
  // Where a channel goes when it is taken out of a group
  const defaultName = groups.find((g) => g.default)?.groupName ?? group.groupName;
  const color = group.color ?? DEFAULT_GROUP_COLOR;
  // The color input reports every step of a drag; the choice is saved when it is let go
  const [dragColor, setDragColor] = useState(color);
  useEffect(() => setDragColor(color), [color]);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(group.groupName);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [search, setSearch] = useState("");
  // A ticked box shows at once; the stored value catches up a moment later and replaces this
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  useEffect(() => setOptimistic({}), [groups]);
  const tick = (login: string, to: string) => {
    setOptimistic((current) => ({ ...current, [login]: to }));
    void setChannelGroup(login, to);
  };

  // The group's own channels, as they were when it was opened. They are listed first; ticking one later does
  // not move its row, so the list holds still while you choose several.
  const [pinned] = useState(() => new Set(group.followedChannels.map((channel) => channel.login)));

  // Every channel with the group it is in now: this group's first, then the rest, each part alphabetical
  const all = groups
    .flatMap((g) => g.followedChannels.map((channel) => ({ channel, groupName: g.groupName })))
    .sort(
      (a, b) =>
        Number(pinned.has(b.channel.login)) - Number(pinned.has(a.channel.login)) ||
        a.channel.channelName.toLowerCase().localeCompare(b.channel.channelName.toLowerCase())
    );
  const candidates = all;
  const query = search.trim().toLowerCase();
  const shown = query ? candidates.filter(({ channel }) => channel.channelName.toLowerCase().includes(query) || channel.login.includes(query)) : candidates;

  // Renaming may change only the capitalisation of the group's own name
  const takenByOthers = groups.filter((g) => g.groupName !== group.groupName).map((g) => g.groupName.toLowerCase());
  const renameError = newName === group.groupName ? null : validateGroupName(newName, takenByOthers);
  const canSave = newName !== "" && renameError === null;

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    if (newName !== group.groupName) {
      await renameGroup(group.groupName, newName);
      onSelect(newName);
    }
    setRenaming(false);
  };

  const confirmedDelete = async () => {
    await deleteGroup(group.groupName);
    onSelect(defaultName);
  };

  return (
    <div className="flex min-h-0 flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        {renaming ? (
          <form onSubmit={saveName} className="flex flex-1 items-center gap-2">
            <input
              type="text"
              aria-label="New group name"
              placeholder="Updated Name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className={`min-w-0 flex-1 rounded border border-solid bg-[#0e0e10] px-3 py-2 text-[1.4rem] text-[#efeff1] focus:border-purple-500 focus:outline-none ${
                renameError ? "border-red-500" : "border-[#3a3a3d]"
              }`}
            />
            <button type="submit" aria-label="save-group-name" disabled={!canSave} className="rounded p-1 text-purple-300 enabled:cursor-pointer enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
              <CheckIcon className="h-7 w-7" />
            </button>
            <button
              type="button"
              aria-label="cancel-rename"
              onClick={() => {
                setRenaming(false);
                setNewName(group.groupName);
              }}
              className="cursor-pointer rounded p-1 text-[#adadb8] hover:bg-white/10"
            >
              <XMarkIcon className="h-7 w-7" />
            </button>
          </form>
        ) : (
          <>
            <h3 className="m-0 min-w-0 truncate text-[1.6rem] font-semibold text-[#efeff1]">{group.groupName}</h3>
            <div className="ml-auto flex items-center gap-1">
              {!group.default && (
                <button
                  type="button"
                  onClick={() => setDefaultGroup(group.groupName, groups.map((g) => g.groupName))}
                  className="mr-1 cursor-pointer rounded border border-solid border-[#3a3a3d] bg-transparent px-3 py-1 text-[1.3rem] text-[#efeff1] hover:bg-white/10"
                >
                  Make default
                </button>
              )}
              <button type="button" aria-label="edit-group-name" onClick={() => setRenaming(true)} className="cursor-pointer rounded p-1 text-[#adadb8] hover:bg-white/10 hover:text-[#efeff1]">
                <PencilIcon className="h-6 w-6" />
              </button>
              {!group.default && (
                <>
                  <button type="button" aria-label="delete-group" onClick={() => setConfirmDelete((open) => !open)} className="cursor-pointer rounded p-1 text-[#adadb8] hover:bg-white/10 hover:text-[#efeff1]">
                    <TrashIcon className="h-6 w-6" />
                  </button>
                  {confirmDelete && (
                    <button type="button" onClick={confirmedDelete} className="ml-1 cursor-pointer rounded bg-red-600 px-3 py-1 text-[1.3rem] font-medium text-white hover:bg-red-500">
                      Are you sure?
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
      {renaming && renameError && <p className="m-0 mb-2 text-[1.2rem] text-red-400">{renameError}</p>}

      <div role="group" aria-label="Group color" className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[1.3rem] text-[#adadb8]">Color</span>
        {GROUP_COLOR_CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-label={`${choice.name} color`}
            title={choice.name}
            aria-pressed={color === choice.value}
            onClick={() => setGroupColor(group.groupName, choice.value === DEFAULT_GROUP_COLOR ? null : choice.value)}
            style={{ background: choice.value }}
            className={`h-6 w-6 cursor-pointer rounded-full border-2 border-solid p-0 ${color === choice.value ? "border-white" : "border-transparent hover:border-white/50"}`}
          />
        ))}
        <input
          type="color"
          aria-label="Custom color"
          title="Custom color"
          value={dragColor}
          onChange={(event) => setDragColor(event.target.value)}
          onBlur={() => dragColor !== color && setGroupColor(group.groupName, dragColor === DEFAULT_GROUP_COLOR ? null : dragColor)}
          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
        />
      </div>

      {group.default ? (
        <p className="m-0 mb-3 text-[1.3rem] text-[#adadb8]">
          {group.groupName} is the default group: channels without a group land here, and it can't be deleted. Tick a channel to move it into {group.groupName}; a channel leaves it when you tick it into another group.
        </p>
      ) : (
        <p className="m-0 mb-3 text-[1.3rem] text-[#adadb8]">Tick the channels that belong in {group.groupName}.</p>
      )}

      <input
        type="text"
        aria-label="Search channels"
        placeholder="Search channels"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mb-3 w-full rounded border border-solid border-[#3a3a3d] bg-[#0e0e10] px-3 py-2 text-[1.4rem] text-[#efeff1] placeholder:text-[#adadb8] focus:border-purple-500 focus:outline-none"
      />

      <ul aria-label="Channels" className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
        {shown.map(({ channel, groupName }) => (
          <li key={channel.login} className="flex items-center gap-3 rounded px-2 py-1 hover:bg-white/[0.07]">
            <label
              className={`flex min-w-0 flex-1 items-center gap-3 ${group.default && (optimistic[channel.login] ?? groupName) === group.groupName ? "" : "cursor-pointer"}`}
              title={group.default && (optimistic[channel.login] ?? groupName) === group.groupName ? `To move it out of ${group.groupName}, tick it into another group` : undefined}
            >
              <input
                type="checkbox"
                checked={(optimistic[channel.login] ?? groupName) === group.groupName}
                // A channel is always in some group, so it leaves the default group only by being ticked into another
                disabled={group.default && (optimistic[channel.login] ?? groupName) === group.groupName}
                onChange={(event) => tick(channel.login, event.target.checked ? group.groupName : defaultName)}
                className="h-5 w-5 shrink-0 cursor-pointer accent-purple-500 disabled:cursor-default"
              />
              <img src={channel.channelImage} alt="" className="h-9 w-9 rounded-full bg-[#3a3a3d]" />
              <span data-testid="channel-name" className="min-w-0 flex-1 truncate">{channel.channelName}</span>
            </label>
            <span data-testid="channel-group" className="shrink-0 text-[1.2rem] text-[#adadb8]">{groupName}</span>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-4 text-[1.3rem] text-[#adadb8]">{query ? `No channels match "${search.trim()}"` : "No channels"}</li>}
      </ul>
    </div>
  );
}

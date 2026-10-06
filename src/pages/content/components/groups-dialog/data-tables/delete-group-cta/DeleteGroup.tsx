import { Group } from "@src/pages/models/Group";
import { CHANNEL_GROUPS_KEY, GROUP_NAMES_KEY } from "@src/pages/utils/constants";
import { useState } from "react";
import {
  TrashIcon,
} from "@heroicons/react/24/outline";

export default function DeleteGroup({
  group,
}: {
  group: Group;
}) {
  const [showAreYouSure, setShowAreYouSure] = useState(false);

  const deleteGroup = async () => {
    setShowAreYouSure(false);
    const stored = await chrome.storage.local.get([GROUP_NAMES_KEY, CHANNEL_GROUPS_KEY]);
    const groupNames: string[] = stored[GROUP_NAMES_KEY] || [];
    const channelGroups: Record<string, string> = stored[CHANNEL_GROUPS_KEY] || {};
    await chrome.storage.local.set({
      [GROUP_NAMES_KEY]: groupNames.filter((n) => n !== group.groupName),
      [CHANNEL_GROUPS_KEY]: Object.fromEntries(
        Object.entries(channelGroups).map(([login, name]) => [login, name === group.groupName ? "Ungrouped" : name])
      ),
    });
  };

  return group.default ? (
    <p>Cannot delete default group</p>
  ) : (
    <div className="flex items-center">
      <button
        key="delete"
        aria-label="delete-group"
        className="rounded hover:bg-slate-500"
        onClick={() => {
          setShowAreYouSure(!showAreYouSure);
        }}
      >
        <TrashIcon className="h-10 w-10 text-black"/>
      </button>
      {showAreYouSure && (
        <div className="pt-0.5 pl-1">
          <button onClick={() => deleteGroup()} className="relative inline-flex items-center justify-center p-0.5 mb-2 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800">
            <span className="relative px-5 py-2.5 transition-all ease-in duration-75 bg-white dark:bg-gray-900 rounded-md group-hover:bg-opacity-0">
              Are you sure?
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

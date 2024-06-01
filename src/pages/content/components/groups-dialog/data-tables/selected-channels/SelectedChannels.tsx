import { setLocalStorage } from "@src/pages/background/storage";
import { mergeChannels } from "@src/pages/content/utils/merging";
import { Channel } from "@src/pages/models/Channel";
import { Group } from "@src/pages/models/Group";
import { constants } from "@src/pages/utils/constants";
import React, { FormEvent } from "react";

interface Props {
  currentGroup: string;
  groups: Group[];
  groupNames: string[];
  selectedRows: Channel[];
  setToggleCleared: (value: boolean) => void;
  selectedCount?: string;
  setSelectedRows: (value: Channel[]) => void;
}

export const SelectedChannels = ({
  selectedCount,
  groupNames,
  selectedRows,
  groups,
  currentGroup,
  setToggleCleared,
  setSelectedRows,
}: Props): React.ReactNode => {
  const selectedChannelsText = `Selected Channels: ${selectedCount}`;
  const [selectedGroup, setSelectedGroup] = React.useState<string>("default");

  const handleMoveToGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalStorage(
      constants.storage.localStorageKey,
      mergeChannels(groups, selectedRows, selectedGroup, currentGroup)
    );
    setSelectedGroup("default");
    setToggleCleared(true);
    setSelectedRows([]);
  };

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGroup(event.target.value);
  };

  return (
    <div className="grid grid-cols-4 items-center">
      <p>{selectedChannelsText}</p>
      <form className="col-end-6 relative" onSubmit={handleMoveToGroup}>
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label
              htmlFor="groups-select"
              className="block mb-2 text-sm font-medium text-gray-900"
            >
              Select an option
            </label>
            <select
              onChange={handleSelectChange}
              id="groups-select"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              value={selectedGroup}
            >
              <option value={"default"}>Choose a group</option>
              {groupNames &&
                groupNames.map((groupName, index) => (
                  <option key={index} value={groupName}>
                    {groupName}
                  </option>
                ))}
            </select>
          </div>
          <div className="absolute bottom-0 right-0">
            <button
              disabled={
                selectedGroup === "default"
              }
              className="rounded relative inline-flex group items-center justify-center px-3.5 py-2 m-1 cursor-pointer border-b-4 border-l-2 active:border-purple-600 active:shadow-none shadow-lg bg-purple-500 border-purple-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed disabled:hover:bg-gray-500"
              type="submit"
              key="move"
              aria-label="move-channel"
            >
              <span className="absolute w-0 h-0 transition-all duration-300 ease-out bg-white rounded-full group-hover:w-52 group-hover:h-52 opacity-10"></span>
              <span className="relative">Move</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

import { Group } from "@src/pages/models/Group";
import { constants } from "@src/pages/utils/constants";
import { messageLogger } from "@src/pages/utils/logger";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { AddGroupProps, ErrorState } from "./AddGroupModels";
import { setLocalStorage } from "@src/pages/background/storage";
import { group } from "console";

const getGroupNames = (followedChannels: Array<Group>) => {
  return followedChannels.map((g: Group) => g.groupName.toLowerCase());
};

const AddGroup = ({ groups }: AddGroupProps) => {
  const [addGroupInput, setAddGroupInput] = useState("");
  const [errors, setErrors] = useState<ErrorState>({
    invalid: true,
    blank: true,
    overCharacterLimit: false,
    errorMessages: ["Group name cannot be blank"],
  });
  const [groupNames, setGroupNames] = useState(getGroupNames(groups) || []);

  useEffect(() => setGroupNames(getGroupNames(groups)), [groups])

  const addGroupToFollowedChannels = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    messageLogger(constants.location.UI_COMPONENT, "addGroupToFollowedChannels:addGroupInput", addGroupInput);
    const groupToAdd: Group = {
      groupName: addGroupInput,
      numberOfChannels: 0,
      followedChannels: [],
      order: groups.length,
      default: false,
      numberOfLiveChannels: 0,
      dialogOpen: false,
      dropdownVisible: false
    };
    groups.push(groupToAdd);
    setLocalStorage(constants.storage.localStorageKey, groups);
    setAddGroupInput("");
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    console.log("handleInputChange", groups, groupNames);
    const groupName = event.target.value;
    if (groupName.length === 0) {
      setErrors({
        ...errors,
        invalid: true,
        blank: true,
        errorMessages: ["Group name cannot be blank"],
      });
    } else if (groupName.length > 15) {
      setErrors({
        ...errors,
        invalid: true,
        blank: false,
        overCharacterLimit: true,
        errorMessages: ["Group name cannot be over 15 characters"],
      });
    } else if (groupNames.includes(groupName.toLowerCase())) {
      setErrors({
        ...errors,
        invalid: true,
        blank: false,
        errorMessages: ["Group name already exists"],
      });
    } else if (groupName.length < 3) {
      setErrors({
        ...errors,
        invalid: true,
        blank: false,
        errorMessages: ["Group name must be at least 3 characters"],
      });
    } else {
      setErrors({ ...errors, invalid: false, blank: false, errorMessages: []});
    }
    setAddGroupInput(groupName);
  };

  return (
    <div className="justify-self-end">
      <form
        className="w-full max-w-sm border-2 border-rose-500"
        onSubmit={addGroupToFollowedChannels}
      >
        <div className="flex items-center py-2 mr-2">
          <div className="items-start">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="add-group-input"
            >
              Group Name
            </label>
            <input
              id="add-group-input"
              className={
                "shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline " +
                (errors.invalid ? "border-red-500" : "")
              }
              type="text"
              placeholder="New Group"
              value={addGroupInput}
              onChange={handleInputChange}
            />
            {errors.errorMessages.map((error: string) => (
              <p key={error} className="text-red-500 text-sm italic">
                {error}
              </p>
            ))}
            {!errors.invalid && <p className="text-purple-500 text-sm italic">Add your group!</p>}
          </div>
          <button
            disabled={errors.invalid}
            className="rounded relative inline-flex group items-center justify-center px-3.5 py-2 m-1 cursor-pointer border-b-4 border-l-2 active:border-purple-600 active:shadow-none shadow-lg bg-purple-500 border-purple-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed disabled:hover:bg-gray-500"
            type="submit"
          >
            <span className="absolute w-0 h-0 transition-all duration-300 ease-out bg-white rounded-full group-hover:w-32 group-hover:h-32 opacity-10"></span>
            <span className="relative">Add</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddGroup;

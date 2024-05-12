import { Group } from "@src/pages/models/Group";
import { constants } from "@src/pages/utils/constants";
import { messageLogger } from "@src/pages/utils/logger";
import { AddGroupProps } from "./AddGroupModels";
import { setLocalStorage } from "@src/pages/background/storage";
import { GroupNameForm } from "../group-name-form/GroupNameForm";


export const AddGroup = ({ groups }: AddGroupProps) => {
  const addGroupToStorage = (groupName: string) => {
    messageLogger(constants.location.UI_COMPONENT, "addGroupToFollowedChannels:addGroupInput", groupName);
    const groupToAdd: Group = {
      groupName: groupName,
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
  };

  return (
    <GroupNameForm
      content={{
        placeholder: "Add group",
        ctaType: "Add",
        infoMessage: "Add a group"
      }}
      submit={addGroupToStorage}
      groupNames={groups.map((g) => g.groupName.toLowerCase())}
      action="add"
      initialErrorState={{
        invalid: true,
        blank: true,
        overCharacterLimit: false,
        errorMessages: ["Group name cannot be blank"]
      }}
    />
  );
};
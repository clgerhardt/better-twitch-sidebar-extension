import { constants, GROUP_NAMES_KEY } from "@src/pages/utils/constants";
import { messageLogger } from "@src/pages/utils/logger";
import { AddGroupProps } from "./AddGroupModels";
import { GroupNameForm } from "../group-name-form/GroupNameForm";


export const AddGroup = ({ groups }: AddGroupProps) => {
  const addGroupToStorage = async (groupName: string) => {
    messageLogger(constants.location.UI_COMPONENT, "addGroupToFollowedChannels:addGroupInput", groupName);
    const stored = await chrome.storage.local.get(GROUP_NAMES_KEY);
    const groupNames: string[] = stored[GROUP_NAMES_KEY] || [];
    await chrome.storage.local.set({ [GROUP_NAMES_KEY]: [...groupNames, groupName] });
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
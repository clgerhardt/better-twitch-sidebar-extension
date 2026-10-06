import { PencilIcon } from "@heroicons/react/24/outline";
import { Group } from "@src/pages/models/Group";
import { useState } from "react";
import { GroupNameForm } from "../../group-name-form/GroupNameForm";
import { CHANNEL_GROUPS_KEY, GROUP_NAMES_KEY } from "@src/pages/utils/constants";

export const EditGroupName = ({
  allGroups,
  group,
  channelGroupMap,
}: {
  allGroups: Group[];
  group: Group;
  channelGroupMap: any;
}) => {
  const [showForm, setShowForm] = useState(false);

  const submit = async (groupName: string) => {
    if (groupName === group.groupName) {
      setShowForm(false);
      return;
    }
    const stored = await chrome.storage.local.get([GROUP_NAMES_KEY, CHANNEL_GROUPS_KEY]);
    const groupNames: string[] = stored[GROUP_NAMES_KEY] || [];
    const channelGroups: Record<string, string> = stored[CHANNEL_GROUPS_KEY] || {};
    await chrome.storage.local.set({
      [GROUP_NAMES_KEY]: groupNames.map((n) => (n === group.groupName ? groupName : n)),
      [CHANNEL_GROUPS_KEY]: Object.fromEntries(
        Object.entries(channelGroups).map(([login, name]) => [login, name === group.groupName ? groupName : name])
      ),
    });
    setShowForm(false);
  };

  return (
    <div className="grid grid-cols-3 gap-1 items-center w-80">
      <div className="col-start-1 col-end-4">
        {!showForm && <div>{group.groupName}</div>}
        {showForm && (
          <GroupNameForm
            content={{
              placeholder: "Updated Name",
              ctaType: "Edit",
              infoMessage: "Update Group Name!",
            }}
            submit={submit}
            value={group.groupName}
            initialValue={group.groupName}
            groupNames={allGroups.filter((g) => g.groupName !== group.groupName).map((g) => g.groupName.toLowerCase())}
            action="edit"
            initialErrorState={{
              invalid: false,
              blank: false,
              overCharacterLimit: false,
              errorMessages: [],
            }}
          />
        )}
      </div>
      {!showForm && !group.default && (
        <div className="col-end-5">
          <button
            aria-label="edit-group-name"
            onClick={() => {
              setShowForm(!showForm);
            }}
            className="rounded hover:bg-slate-500"
          >
            <PencilIcon className="w-7 h-7 text-black"></PencilIcon>
          </button>
        </div>
      )}
    </div>
  );
};

import { PencilIcon } from "@heroicons/react/24/outline";
import { Group } from "@src/pages/models/Group";
import { useState } from "react";
import { GroupNameForm } from "../../group-name-form/GroupNameForm";
import { setLocalStorage } from "@src/pages/background/storage";
import { constants } from "@src/pages/utils/constants";

export const EditGroupName = ({
  allGroups,
  group,
}: {
  allGroups: Group[];
  group: Group;
}) => {
  const [showForm, setShowForm] = useState(false);

  const submit = (groupName: string) => {
    if (groupName === group.groupName) {
      setShowForm(false);
      return;
    }
    allGroups.map((g) => {
      if (g.groupName === group.groupName) {
        g.groupName = groupName;
      }
    });
    setLocalStorage(constants.storage.localStorageKey, allGroups);
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
            groupNames={allGroups.map((g) => g.groupName.toLowerCase())}
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
      {!showForm && (
        <div className="col-end-5">
          <button
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

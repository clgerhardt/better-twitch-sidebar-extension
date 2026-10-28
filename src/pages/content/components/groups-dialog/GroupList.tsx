import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon } from "@heroicons/react/24/outline";
import type { SidebarGroup } from "@src/pages/utils/layoutGroups";
import { validateGroupName } from "@src/pages/utils/groupName";
import { addGroup, moveGroup } from "./groupsStorage";
import { useT } from "@src/pages/shared/i18n/store";
import { groupLabel } from "../../utils/groupLabel";

// The left pane: a field to add a group, and the groups to pick from
export default function GroupList({
  groups,
  selectedName,
  onSelect,
}: {
  groups: SidebarGroup[];
  selectedName: string;
  onSelect: (name: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const error = name === "" ? null : validateGroupName(name, groups.map((g) => g.groupName.toLowerCase()), t);
  const canAdd = name !== "" && error === null;

  const order = groups.map((g) => g.groupName);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAdd) return;
    await addGroup(name);
    onSelect(name);
    setName("");
  };

  return (
    <div className="flex min-h-0 flex-col border-e border-solid border-[#2f2f35] p-4">
      <form onSubmit={submit} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            aria-label={t("dialog.groupName")}
            placeholder={t("dialog.addPlaceholder")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={`min-w-0 flex-1 rounded border border-solid bg-[#0e0e10] px-3 py-2 text-[1.4rem] text-[#efeff1] placeholder:text-[#adadb8] focus:border-purple-500 focus:outline-none ${
              error ? "border-red-500" : "border-[#3a3a3d]"
            }`}
          />
          <button
            type="submit"
            disabled={!canAdd}
            className="flex items-center gap-1 rounded bg-purple-500 px-3 py-2 text-[1.4rem] font-medium text-white enabled:cursor-pointer enabled:hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlusIcon aria-hidden="true" className="h-5 w-5" />
            {t("dialog.add")}
          </button>
        </div>
        {error && <p className="m-0 mt-2 text-[1.2rem] text-red-400">{error}</p>}
      </form>

      <ul aria-label={t("dialog.groups")} className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
        {groups.map((group) => {
          const isSelected = group.groupName === selectedName;
          const position = order.indexOf(group.groupName);
          return (
            <li key={group.groupName} className="my-1 flex items-stretch gap-1">
              <button
                type="button"
                aria-pressed={isSelected}
                style={group.color ? { borderInlineStartColor: group.color } : undefined}
                onClick={() => onSelect(group.groupName)}
                className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-e border-0 border-s-[3px] border-solid border-purple-500 px-3 py-2 text-left text-[1.4rem] font-medium text-[#efeff1] ${
                  isSelected ? "bg-purple-500/25" : "bg-white/[0.07] hover:bg-white/[0.12]"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{groupLabel(group, t)}</span>
                {group.default && <span className="text-[1.1rem] font-normal text-[#adadb8]">{t("dialog.default")}</span>}
                <span className="rounded-full bg-[#3a3a3d] px-2 text-[1.1rem] leading-[1.7rem]">{group.numberOfChannels}</span>
              </button>
              <div className="flex flex-col justify-center">
                {([-1, 1] as const).map((step) => {
                  const Icon = step === -1 ? ChevronUpIcon : ChevronDownIcon;
                  const edge = step === -1 ? position === 0 : position === order.length - 1;
                  const label = t(step === -1 ? "dialog.moveUp" : "dialog.moveDown", { name: groupLabel(group, t) });
                  return (
                    <button
                      key={step}
                      type="button"
                      aria-label={label}
                      title={label}
                      disabled={edge}
                      onClick={() => moveGroup(group.groupName, step, order)}
                      className="flex cursor-pointer items-center justify-center rounded border-0 bg-transparent px-1 py-0.5 text-[#adadb8] enabled:hover:bg-white/10 enabled:hover:text-[#efeff1] disabled:cursor-default disabled:opacity-30"
                    >
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

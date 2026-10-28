import { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { SidebarGroup } from "@src/pages/utils/layoutGroups";
import GroupList from "./GroupList";
import GroupDetail from "./GroupDetail";
import { useDirection, useT } from "@src/pages/shared/i18n/store";

export type ManageGroupsDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  followedChannels: SidebarGroup[];
};

// A dark panel in Twitch's colors: the groups on the left, and on the right the selected group with
// every channel to tick in or out of it.
export default function ManageFollowedChannelsDialog({ open, setOpen, followedChannels: groups }: ManageGroupsDialogProps) {
  const t = useT();
  const dir = useDirection();
  const [selectedName, setSelectedName] = useState("Ungrouped");
  // A group that is gone (deleted) or not stored yet (just added) falls back to the first group
  const selected = groups.find((g) => g.groupName === selectedName) ?? groups[0];

  // Twitch's own key handlers preventDefault() Esc before it reaches Headless UI, which then ignores it.
  // Listening in the capture phase gets there first.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, setOpen]);

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[9999]" onClose={setOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel
              data-testid="dialog-panel"
              dir={dir}
              className="flex h-[56rem] max-h-[85vh] w-[84rem] max-w-[95vw] flex-col overflow-hidden rounded-lg border border-solid border-[#2f2f35] bg-[#18181b] text-start text-[1.4rem] text-[#efeff1] shadow-xl"
            >
              <div className="flex items-center border-b border-solid border-[#2f2f35] px-6 py-4">
                <Dialog.Title as="h2" className="m-0 text-[1.8rem] font-semibold text-[#efeff1]">
                  {t("dialog.title")}
                </Dialog.Title>
                <button
                  type="button"
                  aria-label={t("dialog.close")}
                  onClick={() => setOpen(false)}
                  className="ms-auto cursor-pointer rounded p-1 text-[#adadb8] hover:bg-white/10 hover:text-[#efeff1]"
                >
                  <XMarkIcon className="h-7 w-7" />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[24rem_1fr]">
                <GroupList groups={groups} selectedName={selected?.groupName ?? ""} onSelect={setSelectedName} />
                {selected && <GroupDetail key={selected.groupName} group={selected} groups={groups} onSelect={setSelectedName} />}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

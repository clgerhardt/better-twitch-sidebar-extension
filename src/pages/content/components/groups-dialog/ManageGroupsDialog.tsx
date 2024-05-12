import { Fragment, useRef } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { AddGroup } from "./add-group-form/AddGroup";
import { ManageGroupsDialogProps } from "./GroupsDialogModels";
import GroupsDataTable from "./data-tables/Groups";

export default function ManageFollowedChannelsDialog({
  open,
  setOpen,
  followedChannels
}: ManageGroupsDialogProps) {
  const cancelButtonRef = useRef(null);

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-10"
        initialFocus={cancelButtonRef}
        onClose={setOpen}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-7xl max-h-[80vh] overflow-y-auto">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="grid grid-flow-row auto-rows-max">
                    <div className="mt-3 text-center h-12">
                      <Dialog.Title
                        as="h3"
                        className="text-xl font-semibold leading-6 text-gray-900"
                      >
                        Manage your groups
                      </Dialog.Title>
                    </div>
                    <AddGroup
                      groups={followedChannels}
                    />
                    <GroupsDataTable followedChannels={followedChannels}/>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

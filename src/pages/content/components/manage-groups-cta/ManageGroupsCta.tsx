import { useState } from "react";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import useFollowedChannels from "../../hooks/useFollowedChannels";
import useSidebarState from "../../hooks/useSidebarState";
import { usePageAccount } from "../../hooks/usePageAccount";
import { useNeedsReconnect } from "../../hooks/useNeedsReconnect";
import useGlobalState from "../../hooks/useGlobalState";
import useGroupsSyncWait from "../../hooks/useGroupsSyncWait";
import ManageFollowedChannelsDialog from "../groups-dialog/ManageGroupsDialog";

const ManageGroupsCTA = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const followedChannels = useFollowedChannels();
  const isSidebarExpanded = useSidebarState();
  const pageAccount = usePageAccount();
  const needsReconnect = useNeedsReconnect();
  const globalState = useGlobalState();
  const waitingForSync = useGroupsSyncWait();

  const handleToggleDialog = () => {
    setOpenDialog((prev) => !prev);
  };

  if (!isSidebarExpanded || pageAccount?.status === "signed_out" || needsReconnect || !globalState.loggedIn || waitingForSync !== false) return null;

  return (
    <div>
      <div data-testid="toggle-add-group-form">
        <button
          onClick={handleToggleDialog}
          className="mt-0.5 flex w-full cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-solid border-purple-500 px-3 py-1 text-[1.4rem] font-medium text-purple-300 transition-colors hover:bg-purple-500/20"
        >
          <Cog6ToothIcon aria-hidden="true" className="h-6 w-6 shrink-0" />
          <span>Manage Groups</span>
        </button>
      </div>
      <ManageFollowedChannelsDialog
        open={openDialog}
        setOpen={setOpenDialog}
        followedChannels={followedChannels}
      />
    </div>
  );
};

export default ManageGroupsCTA;

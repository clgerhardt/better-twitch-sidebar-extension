import { useState } from "react";
import useFollowedChannels from "../../hooks/useFollowedChannels";
import useSidebarState from "../../hooks/useSidebarState";
import useChannelGroupMap from "../../hooks/useChannelGroupMap";
import ManageFollowedChannelsDialog from "../groups-dialog/ManageGroupsDialog";

const ManageGroupsCTA = ({ tabId }: { tabId: string }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const channelGroupMap = useChannelGroupMap();
  const followedChannels = useFollowedChannels();
  const isSidebarExpanded = useSidebarState(tabId);

  const handleToggleDialog = () => {
    setOpenDialog((prev) => !prev);
  };

  if (!isSidebarExpanded) return null;

  return (
    <div className="m-1">
      <div
        data-testid="toggle-add-group-form"
        className="flex flex-col items-center"
      >
        <button
          onClick={handleToggleDialog}
          className="relative w-full inline-flex items-center justify-center p-4 px-6 py-3 overflow-hidden font-medium text-[#efeff1] bg-[#53535f] transition duration-300 ease-out border-2 border-purple-500 rounded-full shadow-md group"
        >
          <span className="absolute inset-0 flex items-center justify-center w-full h-full text-white duration-300 -translate-x-full bg-purple-500 group-hover:translate-x-0 ease">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-9 h-9"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
          </span>
          <span className="absolute flex items-center justify-center w-full h-full text-[#efeff1] transition-all duration-300 transform group-hover:translate-x-full ease">
            Manage Groups
          </span>
          <span className="relative invisible">Manage Groups</span>
        </button>
      </div>
      <ManageFollowedChannelsDialog
        open={openDialog}
        setOpen={setOpenDialog}
        followedChannels={followedChannels}
        channelGroupMap={channelGroupMap}
      />
    </div>
  );
};

export default ManageGroupsCTA;

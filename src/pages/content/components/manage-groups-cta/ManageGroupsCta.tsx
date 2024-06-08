import { getLocalStorage } from "@src/pages/background/storage";
import { constants } from "@src/pages/utils/constants";
import { messageLogger } from "@src/pages/utils/logger";
import { useEffect, useState } from "react";
import ManageGroupsDialog from "../groups-dialog/ManageGroupsDialog";

const getFollowedChannels = async () => {
  const followedChannels = await getLocalStorage(
    constants.storage.localStorageKey
  )
    .then((d: any) => {
      return d || [];
    })
    .catch((e: any) => {
      // messageLogger(constants.location.CONTENT_SCRIPT, "error", e);
      console.log("no nothing");
    });

  messageLogger(
    constants.location.UI_COMPONENT,
    "followedChannels",
    followedChannels
  );

  return followedChannels;
};

const ManageGroupsCTA = () => {
  const [followedChannels, setFollowedChannels] = useState([]);
  const [openDialog, setOpenDialog] = useState(false)
  const [expandedSidebarBtnState, setExpandedSidebarBtnState] = useState(false);

  useEffect(() => {
    let loading = true;
    const loadLoggedIn = async () => {
      const followedChannels = await getFollowedChannels();
      if (loading) {
        setFollowedChannels(followedChannels);
      }
    };

    loadLoggedIn();
    return () => {
      loading = false;
    };
  }, []);

  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      if(key === constants.storage.localStorageKey) {
        setFollowedChannels(newValue);
      }
      if(key === constants.storage.prefix + constants.storage.sideBarState) {
        setExpandedSidebarBtnState(newValue.sidebarExpanded);
      }
    }
  });

  return (
    <div className="m-1">
      {!expandedSidebarBtnState && <div data-testid="toggle-add-group-form" className="flex flex-col items-center">
        <button onClick={() => {setOpenDialog(!openDialog)}} className="relative w-full inline-flex items-center justify-center p-4 px-6 py-3 overflow-hidden font-medium text-[#efeff1] bg-[#53535f] transition duration-300 ease-out border-2 border-purple-500 rounded-full shadow-md group">
          <span className="absolute inset-0 flex items-center justify-center w-full h-full text-white duration-300 -translate-x-full bg-purple-500 group-hover:translate-x-0 ease">
            <svg className="w-6 h-6" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M24 10h-10v-10h-4v10h-10v4h10v10h4v-10h10z"></path></svg>
          </span>
          <span className="absolute flex items-center justify-center w-full h-full text-[#efeff1] transition-all duration-300 transform group-hover:translate-x-full ease">Manage Groups</span>
          <span className="relative invisible">Manage Groups</span>
        </button>
      </div>}
      <ManageGroupsDialog open={openDialog} setOpen={setOpenDialog} followedChannels={followedChannels} />
    </div>
  );
};

export default ManageGroupsCTA;

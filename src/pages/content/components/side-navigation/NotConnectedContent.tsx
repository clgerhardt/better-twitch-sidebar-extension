import ReconnectButton from "../shared/ReconnectButton";
import { usePageAccount } from "../../hooks/usePageAccount";

// Shown instead of the groups while the extension is not connected to the Twitch account that is
// signed in on the page. Only that account can be connected, so there is nothing else to offer.
const NotConnectedContent = ({ isSidebarExpanded }: { isSidebarExpanded: boolean }) => {
  const pageAccount = usePageAccount();
  if (!isSidebarExpanded) return null;

  return (
    <div data-testid="not-connected-view" className="flex flex-col items-center justify-center border-solid border-y-4 border-purple-500 my-4 pb-3">
      {pageAccount?.status === "signed_in" ? (
        <>
          <p className="text-center py-2 px-1 text-[1.4rem]">Connect to group your followed channels</p>
          <ReconnectButton
            label={`Connect for ${pageAccount.login}`}
            className="bg-purple-500 text-white text-[1.4rem] font-bold py-1 px-4 rounded disabled:opacity-60"
          />
        </>
      ) : (
        <p className="text-center py-2 px-1 text-[1.4rem]">Could not tell which Twitch account is signed in</p>
      )}
    </div>
  );
};

export default NotConnectedContent;

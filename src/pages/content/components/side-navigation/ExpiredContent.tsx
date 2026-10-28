import ReconnectButton from "../shared/ReconnectButton";
import { useT } from "@src/pages/shared/i18n/store";

// Shown instead of the groups while Twitch rejects the extension's connection. The groups are kept
// and come back after reconnecting.
const ExpiredContent = ({ isSidebarExpanded }: { isSidebarExpanded: boolean }) => {
  const t = useT();
  if (!isSidebarExpanded) return null;

  return (
    <div data-testid="expired-view" className="flex flex-col items-center justify-center border-solid border-y-4 border-purple-500 my-4 pb-3">
      <p className="text-center py-2 px-1 text-[1.4rem]">{t("sidebar.expired")}</p>
      <ReconnectButton className="bg-purple-500 text-white text-[1.4rem] font-bold py-1 px-4 rounded disabled:opacity-60" />
    </div>
  );
};

export default ExpiredContent;

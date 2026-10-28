import { usePageAccount } from "@src/pages/content/hooks/usePageAccount";
import { guestMessage } from "@src/pages/shared/twitch/guestMessage";
import Authenticate from "@src/pages/content/components/shared/Authenticate";
import { useT } from "@src/pages/shared/i18n/store";

const GuestGreeting = () => {
    const pageAccount = usePageAccount();
    const t = useT();
    return (
        <div className="flex flex-col items-center justify-center py-3 text-center">
            <p className="m-0 text-sm text-[#efeff1]">{guestMessage(pageAccount, t)}</p>
            <Authenticate isSidebarExpanded={false} />
        </div>
    )
};

export default GuestGreeting;

import { usePageAccount } from "@src/pages/content/hooks/usePageAccount";
import { guestMessage } from "@src/pages/shared/twitch/guestMessage";
import Authenticate from "@src/pages/content/components/shared/Authenticate";

const GuestGreeting = () => {
    const pageAccount = usePageAccount();
    return (
        <div className="flex flex-col items-center justify-center py-3 text-center">
            <p className="m-0 text-sm text-[#efeff1]">{guestMessage(pageAccount)}</p>
            <Authenticate isSidebarExpanded={false} />
        </div>
    )
};

export default GuestGreeting;

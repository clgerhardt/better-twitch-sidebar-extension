import coverImg from '@assets/img/cover.png';
import { usePageAccount } from "@src/pages/content/hooks/usePageAccount";
import { guestMessage } from "@src/pages/shared/twitch/guestMessage";
import Authenticate from "@src/pages/content/components/shared/Authenticate";

const GuestGreeting = () => {
    const pageAccount = usePageAccount();
    return (

        <div className="p-2 flex flex-col
        items-center justify-center">
            <img src={coverImg} style={{borderRadius: 20}} />
            <h1 className="font-mono pt-1 pl-1 text-white text-sm text-center">
                {guestMessage(pageAccount)}
            </h1>
            <Authenticate isSidebarExpanded={false} />
        </div>
    )
};

export default GuestGreeting;
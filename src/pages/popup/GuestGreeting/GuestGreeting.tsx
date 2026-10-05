import coverImg from '@assets/img/cover.png';
import Authenticate from "@src/pages/content/components/shared/Authenticate";

const GuestGreeting = () => {
    return (

        <div className="p-2 flex flex-col
        items-center justify-center">
            <img src={coverImg} style={{borderRadius: 20}} />
            <h1 className="font-mono pt-1 pl-1 text-white text-sm text-center">
                You need to login to twitch before you can use this extensions functionality.
            </h1>
            <Authenticate isSidebarExpanded={false} />
        </div>
    )
};

export default GuestGreeting;
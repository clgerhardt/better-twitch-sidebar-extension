import coverImg from '@assets/img/cover.png';
import ReconnectButton from "@src/pages/content/components/shared/ReconnectButton";

const ExpiredGreeting = () => (
    <div className="p-2 flex flex-col items-center justify-center">
        <img src={coverImg} style={{borderRadius: 20}} />
        <h1 className="font-mono pt-1 pl-1 text-white text-sm text-center">
            The extension's connection to Twitch has expired. Reconnect to see your groups; they are saved.
        </h1>
        <div className="mt-2">
            <ReconnectButton />
        </div>
    </div>
);

export default ExpiredGreeting;

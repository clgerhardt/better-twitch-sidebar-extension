import ReconnectButton from "@src/pages/content/components/shared/ReconnectButton";

const ExpiredGreeting = () => (
    <div className="flex flex-col items-center py-3 text-center">
        <p className="m-0 text-sm text-[#efeff1]">
            The extension's connection to Twitch has expired. Reconnect to see your groups; they are saved.
        </p>
        <div className="mt-3">
            <ReconnectButton />
        </div>
    </div>
);

export default ExpiredGreeting;

import { useState } from "react";
import { MESSAGES } from "@src/pages/shared/messages";

// Runs the extension's Twitch connection in the background (the same as the popup's Connect). The
// view around it goes away by itself once the next refresh succeeds.
const ReconnectButton = ({ className }: { className?: string }) => {
  const [connecting, setConnecting] = useState(false);
  const [failed, setFailed] = useState(false);

  const reconnect = async () => {
    setConnecting(true);
    setFailed(false);
    const result = await chrome.runtime.sendMessage({ type: MESSAGES.CONNECT_TWITCH }).catch(() => undefined);
    setConnecting(false);
    if (!result?.ok) setFailed(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={reconnect}
        disabled={connecting}
        className={className ?? "bg-purple-500 text-white font-bold py-2 px-4 rounded disabled:opacity-60"}
      >
        {connecting ? "Waiting for Twitch..." : "Reconnect"}
      </button>
      {failed && <p className="text-red-500 text-sm mt-2">Could not reconnect. Please try again.</p>}
    </>
  );
};

export default ReconnectButton;

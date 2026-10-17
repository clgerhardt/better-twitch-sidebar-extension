import { useState } from "react";
import { MESSAGES } from "@src/pages/shared/messages";
import { connectErrorMessage } from "@src/pages/shared/twitch/connectMessages";

// Runs the extension's Twitch connection in the background (the same as the popup's Connect). The
// view around it goes away by itself once the next refresh succeeds.
const ReconnectButton = ({ className, label = "Reconnect" }: { className?: string; label?: string }) => {
  const [connecting, setConnecting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const reconnect = async () => {
    setConnecting(true);
    setFailed(null);
    const result = await chrome.runtime.sendMessage({ type: MESSAGES.CONNECT_TWITCH }).catch(() => undefined);
    setConnecting(false);
    if (!result?.ok) setFailed(connectErrorMessage(result?.reason));
  };

  return (
    <>
      <button
        type="button"
        onClick={reconnect}
        disabled={connecting}
        className={className ?? "bg-purple-500 text-white font-bold py-2 px-4 rounded disabled:opacity-60"}
      >
        {connecting ? "Waiting for Twitch..." : label}
      </button>
      {failed && <p className="text-red-500 text-sm mt-2 text-center">{failed}</p>}
    </>
  );
};

export default ReconnectButton;

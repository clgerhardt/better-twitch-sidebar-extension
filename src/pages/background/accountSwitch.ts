import { PAGE_ACCOUNT_KEY } from "../utils/constants";
import { isAccountSwitch } from "../shared/twitch/pageAccount";
import { logoutTwitch } from "../content/utils/getValidTwitchToken";
import { messageLogger } from "../utils/logger";
import { constants } from "../utils/constants";

// When another Twitch account signs in on twitch.tv, the connected account's data goes (token revoked,
// groups, snapshot), so one account's groups are never shown to another. The new account then
// connects itself from the popup.
let running: Promise<void> = Promise.resolve();

const check = async () => {
  const stored = await chrome.storage.local.get([PAGE_ACCOUNT_KEY, "twitchUserId"]);
  if (!isAccountSwitch(stored[PAGE_ACCOUNT_KEY], stored.twitchUserId)) return;
  messageLogger(constants.location.BACKGROUND, "another Twitch account signed in: clearing the connected account");
  await logoutTwitch();
};

// Checks run one after another, so several storage events cause one clean-up, not several
const queueCheck = () => {
  running = running.then(check).catch((error) => console.error("account switch check failed", error));
};

export const watchAccountSwitch = () => {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes[PAGE_ACCOUNT_KEY] || changes.twitchUserId)) queueCheck();
  });
  queueCheck();
};

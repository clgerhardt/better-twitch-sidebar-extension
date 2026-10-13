import { readPageAccount, type PageAccount } from "../shared/twitch/pageAccount";
import { PAGE_ACCOUNT_KEY } from "../utils/constants";

// Tells the rest of the extension which Twitch account is signed in on the page. The account can
// change in another tab, so it is read again whenever this tab is shown or focused again.
export const startPageAccountReporting = () => {
  let last: PageAccount | null = null;

  const report = () => {
    const account = readPageAccount(document.cookie);
    if (last && JSON.stringify(last) === JSON.stringify(account)) return;
    last = account;
    if (!chrome.runtime?.id) return;
    chrome.storage.local.set({ [PAGE_ACCOUNT_KEY]: { ...account, seenAt: Date.now() } });
  };

  const reportIfVisible = () => {
    if (document.visibilityState === "visible") report();
  };

  report();
  document.addEventListener("visibilitychange", reportIfVisible);
  window.addEventListener("focus", reportIfVisible);
};

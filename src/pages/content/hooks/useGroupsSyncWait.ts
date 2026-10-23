import { useEffect, useState } from "react";
import { GLOBAL_STATE_KEY, GROUPS_SYNC_READY_KEY } from "@src/pages/utils/constants";
import { isWaitingForGroupsSync, SYNC_WAIT_MAX_MS } from "@src/pages/shared/groupsSync/waiting";

// True while this device is still getting the synced groups for the first time after a login (see
// shared/groupsSync/waiting). null until that is known, so nothing is shown in the meantime.
const useGroupsSyncWait = (): boolean | null => {
  const [waiting, setWaiting] = useState<boolean | null>(null);

  useEffect(() => {
    let waitingSince: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const evaluate = async () => {
      const stored = await chrome.storage.local.get(["twitchUserId", GLOBAL_STATE_KEY, GROUPS_SYNC_READY_KEY]);
      const needed = isWaitingForGroupsSync({
        userId: stored.twitchUserId,
        syncOn: stored[GLOBAL_STATE_KEY]?.syncGroups !== false,
        readyFor: stored[GROUPS_SYNC_READY_KEY],
        waitedMs: 0,
      });
      clearTimeout(timer);
      if (!needed) {
        waitingSince = null;
        setWaiting(false);
        return;
      }
      waitingSince ??= Date.now();
      const left = SYNC_WAIT_MAX_MS - (Date.now() - waitingSince);
      if (left <= 0) return setWaiting(false);
      setWaiting(true);
      timer = setTimeout(evaluate, left); // give up waiting
    };

    void evaluate();
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && (changes.twitchUserId || changes[GLOBAL_STATE_KEY] || changes[GROUPS_SYNC_READY_KEY])) void evaluate();
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      clearTimeout(timer);
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  return waiting;
};

export default useGroupsSyncWait;

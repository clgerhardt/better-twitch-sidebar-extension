import type { PageAccount } from "./pageAccount";

export type StoredPageAccount = PageAccount & { seenAt: number };

// What the logged-out popup says, depending on what is known about the account signed in to Twitch
export const guestMessage = (account: StoredPageAccount | undefined): string => {
  switch (account?.status) {
    case "signed_in":
      return `You're signed in to Twitch as ${account.login}. Connect the extension to use your groups.`;
    case "signed_out":
      return "Sign in to Twitch in a tab, then connect the extension to use your groups.";
    default:
      return "Connect the extension to Twitch to use your groups.";
  }
};

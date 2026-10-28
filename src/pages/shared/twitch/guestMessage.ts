import type { PageAccount } from "./pageAccount";
import { tEn, type Translator } from "../i18n/i18n";

export type StoredPageAccount = PageAccount & { seenAt: number };

// What the logged-out popup says, depending on what is known about the account signed in to Twitch
export const guestMessage = (account: StoredPageAccount | undefined, t: Translator = tEn): string => {
  switch (account?.status) {
    case "signed_in":
      return t("guest.signedIn", { login: account.login });
    case "signed_out":
      return t("guest.signedOut");
    default:
      return t("guest.default");
  }
};

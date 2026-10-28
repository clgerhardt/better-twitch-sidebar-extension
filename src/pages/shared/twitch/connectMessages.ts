import { tEn, type Translator } from "../i18n/i18n";

// What to tell the user when connecting the extension to their Twitch account did not work
export const connectErrorMessage = (reason?: string, t: Translator = tEn): string => {
  switch (reason) {
    case "wrong_account":
      return t("connect.wrongAccount");
    case "not_signed_in":
      return t("connect.notSignedIn");
    default:
      return t("connect.failed");
  }
};

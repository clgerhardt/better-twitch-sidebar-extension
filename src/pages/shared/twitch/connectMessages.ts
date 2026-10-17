// What to tell the user when connecting the extension to their Twitch account did not work
export const connectErrorMessage = (reason?: string): string => {
  switch (reason) {
    case "wrong_account":
      return "That is not the account signed in to Twitch. Sign in to Twitch as the account you want, then try again.";
    case "not_signed_in":
      return "Sign in to Twitch in a tab first.";
    default:
      return "Could not connect to Twitch. Please try again.";
  }
};

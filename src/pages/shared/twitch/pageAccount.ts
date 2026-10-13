// Which Twitch account is signed in on twitch.tv, read from the page's own cookies. Twitch's
// `twilight-user` cookie holds the account's id and login (and a token, which this never reads out).
// A cookie that cannot be understood is "unknown", never "signed out": Twitch may change the format,
// and a wrong "signed out" must not be able to lead to anything destructive.
export type PageAccount =
  | { status: "signed_in"; id: string; login: string }
  | { status: "signed_out" }
  | { status: "unknown" };

const COOKIE_NAME = "twilight-user";

export const readPageAccount = (cookieString: string): PageAccount => {
  const raw = cookieString
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const value = raw?.slice(COOKIE_NAME.length + 1);
  if (!value) return { status: "signed_out" };

  try {
    const user = JSON.parse(decodeURIComponent(value));
    const id = user?.id !== undefined && user?.id !== null ? String(user.id) : "";
    const login = typeof user?.login === "string" ? user.login : "";
    return id && login ? { status: "signed_in", id, login } : { status: "unknown" };
  } catch {
    return { status: "unknown" };
  }
};

// A different account is signed in on twitch.tv than the one the extension is connected as. Only a
// signed-in account counts: signed out, unknown or never seen is too weak a signal to delete anything.
export const isAccountSwitch = (page: PageAccount | undefined, connectedUserId: string | undefined): boolean =>
  page?.status === "signed_in" && !!connectedUserId && page.id !== connectedUserId;

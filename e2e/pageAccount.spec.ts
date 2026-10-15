import { test, expect } from "@playwright/test";
import { isAccountSwitch, readPageAccount } from "../src/pages/shared/twitch/pageAccount";

const twilight = (value: unknown) => `twilight-user=${encodeURIComponent(typeof value === "string" ? value : JSON.stringify(value))}`;
const user = { authToken: "secret-auth-token", displayName: "Fixture_Viewer", id: "999", login: "fixture_viewer", roles: {}, version: 2 };

test.describe("readPageAccount", () => {
  test("reads the signed-in account's id and login", () => {
    expect(readPageAccount(`unique_id=abc; ${twilight(user)}; login=fixture_viewer`)).toEqual({ status: "signed_in", id: "999", login: "fixture_viewer", displayName: "Fixture_Viewer" });
  });

  test("never returns the token or anything else from the cookie", () => {
    const account = readPageAccount(twilight(user));
    expect(Object.keys(account).sort()).toEqual(["displayName", "id", "login", "status"]);
    expect(JSON.stringify(account)).not.toContain("secret-auth-token");
  });

  test("the display name falls back to the login when the cookie has none", () => {
    const { displayName: _omit, ...withoutName } = user;
    expect(readPageAccount(twilight(withoutName))).toMatchObject({ status: "signed_in", login: "fixture_viewer", displayName: "fixture_viewer" });
  });

  test("a numeric id is returned as a string", () => {
    expect(readPageAccount(twilight({ ...user, id: 999 }))).toMatchObject({ status: "signed_in", id: "999" });
  });

  test("no twilight-user cookie, or an empty one, means signed out", () => {
    expect(readPageAccount("")).toEqual({ status: "signed_out" });
    expect(readPageAccount("unique_id=abc; login=x")).toEqual({ status: "signed_out" });
    expect(readPageAccount("twilight-user=")).toEqual({ status: "signed_out" });
  });

  test("a cookie that cannot be understood is unknown, never signed out", () => {
    expect(readPageAccount("twilight-user=%7Bnot-json")).toEqual({ status: "unknown" });
    expect(readPageAccount(twilight("plain text"))).toEqual({ status: "unknown" });
    expect(readPageAccount(twilight({ displayName: "x" }))).toEqual({ status: "unknown" });
    expect(readPageAccount(twilight({ id: "", login: "x" }))).toEqual({ status: "unknown" });
    expect(readPageAccount(twilight(null))).toEqual({ status: "unknown" });
  });

  test("a cookie name that only ends in twilight-user is not the right cookie", () => {
    expect(readPageAccount(`not-twilight-user=${encodeURIComponent(JSON.stringify(user))}`)).toEqual({ status: "signed_out" });
  });
});

test.describe("isAccountSwitch", () => {
  const signedIn = (id: string) => ({ status: "signed_in" as const, id, login: "x", seenAt: 1 });

  test("is true only when a different account is signed in", () => {
    expect(isAccountSwitch(signedIn("123"), "999")).toBe(true);
  });

  test("is false for the same account", () => {
    expect(isAccountSwitch(signedIn("999"), "999")).toBe(false);
  });

  test("is false when signed out, unknown or never seen: nothing is deleted on a weak signal", () => {
    expect(isAccountSwitch({ status: "signed_out", seenAt: 1 }, "999")).toBe(false);
    expect(isAccountSwitch({ status: "unknown", seenAt: 1 }, "999")).toBe(false);
    expect(isAccountSwitch(undefined, "999")).toBe(false);
  });

  test("is false when the extension is not connected to anyone", () => {
    expect(isAccountSwitch(signedIn("123"), undefined)).toBe(false);
  });
});

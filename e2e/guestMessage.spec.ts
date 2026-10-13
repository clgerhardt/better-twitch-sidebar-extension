import { test, expect } from "@playwright/test";
import { guestMessage } from "../src/pages/shared/twitch/guestMessage";

test.describe("guestMessage", () => {
  test("names the account that is signed in to Twitch", () => {
    expect(guestMessage({ status: "signed_in", id: "999", login: "fixture_viewer", seenAt: 1 })).toBe(
      "You're signed in to Twitch as fixture_viewer. Connect the extension to use your groups."
    );
  });

  test("asks to sign in to Twitch when nobody is", () => {
    expect(guestMessage({ status: "signed_out", seenAt: 1 })).toBe("Sign in to Twitch in a tab, then connect the extension to use your groups.");
  });

  test("asks to open Twitch when the account is unknown or has not been seen yet", () => {
    const neutral = "Open Twitch in a tab and sign in, then connect the extension to use your groups.";
    expect(guestMessage({ status: "unknown", seenAt: 1 })).toBe(neutral);
    expect(guestMessage(undefined)).toBe(neutral);
  });

  test("never says the user needs to log in to Twitch when they are signed in", () => {
    expect(guestMessage({ status: "signed_in", id: "1", login: "x", seenAt: 1 })).not.toMatch(/need to log ?in/i);
  });
});

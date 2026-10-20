import { test, expect } from "@playwright/test";
import { validateGroupName } from "../src/pages/utils/groupName";

test.describe("validateGroupName", () => {
  const taken = ["alpha", "beta"];

  test("accepts a new name of 3 to 15 characters", () => {
    expect(validateGroupName("Gamma", taken)).toBeNull();
    expect(validateGroupName("abc", taken)).toBeNull();
    expect(validateGroupName("a".repeat(15), taken)).toBeNull();
  });

  test("rejects a blank name", () => {
    expect(validateGroupName("", taken)).toBe("Group name cannot be blank");
  });

  test("rejects a name over 15 characters", () => {
    expect(validateGroupName("a".repeat(16), taken)).toBe("Group name cannot be over 15 characters");
  });

  test("rejects a name under 3 characters", () => {
    expect(validateGroupName("ab", taken)).toBe("Group name must be at least 3 characters");
  });

  test("rejects a name that is taken, whatever its capitalisation", () => {
    expect(validateGroupName("alpha", taken)).toBe("Group name already exists");
    expect(validateGroupName("ALPHA", taken)).toBe("Group name already exists");
    expect(validateGroupName("Beta", taken)).toBe("Group name already exists");
  });

  test("a name taken by someone else is also too short or too long, the clearer message wins", () => {
    expect(validateGroupName("a".repeat(16), ["a".repeat(16)])).toBe("Group name cannot be over 15 characters");
  });

  test("rejects profanity, including case and leetspeak disguises, without echoing the word", () => {
    const message = "Group name contains language that isn't allowed";
    expect(validateGroupName("shithead", taken)).toBe(message);
    expect(validateGroupName("SHITHEAD", taken)).toBe(message);
    expect(validateGroupName("sh1thead", taken)).toBe(message);
    expect(validateGroupName("sh!t", taken)).toBe(message);
  });

  test("does not flag innocent names that contain a bad word's letters", () => {
    expect(validateGroupName("Scunthorpe", taken)).toBeNull();
    expect(validateGroupName("Class", taken)).toBeNull();
    expect(validateGroupName("Assassins", taken)).toBeNull();
    expect(validateGroupName("Friends", taken)).toBeNull();
  });

  test("length and duplicate messages still come first", () => {
    expect(validateGroupName("ab", taken)).toBe("Group name must be at least 3 characters");
    expect(validateGroupName("shit", ["shit"])).toBe("Group name already exists");
  });
});

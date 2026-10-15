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
});

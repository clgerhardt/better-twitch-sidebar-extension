import { test, expect } from "@playwright/test";
import { DEFAULT_GROUP_COLOR, GROUP_COLOR_CHOICES, normalizeGroupColor, readableTextColor } from "../src/pages/utils/groupColor";

test.describe("group colors", () => {
  test("only #rrggbb counts as a color, and is stored in lower case", () => {
    expect(normalizeGroupColor("#A855F7")).toBe("#a855f7");
    for (const bad of ["red", "#fff", "#12345", "#1234567", "a855f7", "", undefined, null, 42]) expect(normalizeGroupColor(bad)).toBeUndefined();
  });

  test("text is white while it has enough contrast, and near-black on colors too light for that", () => {
    for (const white of ["#a855f7", "#ef4444", "#3b82f6", "#ec4899", "#000000"]) expect(readableTextColor(white)).toBe("#ffffff");
    for (const dark of ["#f97316", "#14b8a6", "#22c55e", "#eab308", "#ffffff"]) expect(readableTextColor(dark)).toBe("#0e0e10");
    expect(readableTextColor("not a color")).toBe(readableTextColor(DEFAULT_GROUP_COLOR));
  });

  test("the quick picks start with the default and are all valid, distinct colors", () => {
    expect(GROUP_COLOR_CHOICES[0].value).toBe(DEFAULT_GROUP_COLOR);
    const values = GROUP_COLOR_CHOICES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
    values.forEach((v) => expect(normalizeGroupColor(v)).toBe(v));
  });
});

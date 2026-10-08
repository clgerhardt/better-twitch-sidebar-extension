import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const manifest = JSON.parse(fs.readFileSync(path.resolve("manifest.json"), "utf8"));

test.describe("manifest.json", () => {
  test("has a real name and description", () => {
    expect(manifest.name).toBe("Better Twitch Sidebar");
    expect(manifest.description).not.toMatch(/in manifest\.json/);
    expect(manifest.description.length).toBeGreaterThan(20);
  });

  test("content scripts only run on Twitch", () => {
    for (const script of manifest.content_scripts) {
      expect(script.matches).toEqual(["https://*.twitch.tv/*"]);
    }
  });

  test("host permissions are limited to Twitch", () => {
    expect(manifest.host_permissions).toEqual(["https://*.twitch.tv/*"]);
  });

  test("only requests the permissions the code uses", () => {
    expect([...manifest.permissions].sort()).toEqual(["identity", "storage"]);
  });

  test("has no template leftovers", () => {
    expect(manifest.devtools_page).toBeUndefined();
    expect(manifest.oauth2).toBeUndefined();
  });
});

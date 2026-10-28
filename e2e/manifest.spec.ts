import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const manifest = JSON.parse(fs.readFileSync(path.resolve("manifest.json"), "utf8"));

test.describe("manifest.json", () => {
  test("has a real name and description", () => {
    expect(manifest.name).toBe("Better Sidebar");
    expect(manifest.description).toContain("Not affiliated with Twitch");
    expect(manifest.description).not.toMatch(/in manifest\.json/);
    expect(manifest.description.length).toBeGreaterThan(20);
  });

  test("the localized name and description the build ships match it", () => {
    const messages = JSON.parse(fs.readFileSync(path.resolve("src/locales/en/messages.json"), "utf8"));
    expect(messages.extName.message).toBe(manifest.name);
    expect(messages.extDescription.message).toBe(manifest.description);
  });

  test("every language has a name and a description, and the description fits the Store's 132 characters", () => {
    const languages = fs.readdirSync(path.resolve("src/locales"));
    expect(languages).toEqual(expect.arrayContaining(["en", "es", "de", "zh_CN", "pt_BR", "ar"]));
    for (const language of languages) {
      const messages = JSON.parse(fs.readFileSync(path.resolve(`src/locales/${language}/messages.json`), "utf8"));
      expect(Object.keys(messages).sort(), language).toEqual(["extDescription", "extName"]);
      expect(messages.extName.message, language).toBe("Better Sidebar"); // the product name is not translated
      expect(messages.extDescription.message.length, language).toBeLessThanOrEqual(132);
      expect(messages.extDescription.message, language).toContain("Twitch");
    }
  });

  test("the built extension takes its name and description from those messages, in every language", () => {
    const built = JSON.parse(fs.readFileSync(path.resolve("dist_chrome/manifest.json"), "utf8"));
    expect(built.name).toBe("__MSG_extName__");
    expect(built.description).toBe("__MSG_extDescription__");
    expect(built.default_locale).toBe("en");
    for (const language of fs.readdirSync(path.resolve("src/locales"))) {
      expect(fs.existsSync(path.resolve(`dist_chrome/_locales/${language}/messages.json`)), language).toBe(true);
    }
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

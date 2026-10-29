import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { en, type Catalog, type Message, type MessageKey } from "../src/pages/shared/i18n/catalog.en";
import { directionOf, isLanguageCode, LANGUAGES, PSEUDO, resolveLanguage } from "../src/pages/shared/i18n/languages";
import { formatCount, tEn, translate } from "../src/pages/shared/i18n/i18n";

const keys = Object.keys(en) as MessageKey[];
const forms = (message: Message) => (typeof message === "string" ? [message] : Object.values(message));
const placeholders = (message: Message) => new Set(forms(message).flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])));
const load = async (code: string): Promise<Catalog> => (await import(`../src/pages/shared/i18n/catalogs/${code}`)).default;
const others = LANGUAGES.filter((l) => l.code !== "en");
// Twitch's own language codes (<html lang> and the `language` cookie), read off its language menu
const TWITCH_CODES = [
  "en-US", "da-DK", "de-DE", "en-GB", "es-ES", "es-MX", "fr-FR", "it-IT", "hu-HU", "nl-NL", "no-NO", "pl-PL", "pt-PT", "pt-BR", "ro-RO",
  "sk-SK", "fi-FI", "sv-SE", "vi-VN", "tr-TR", "cs-CZ", "el-GR", "bg-BG", "ru-RU", "uk-UA", "th-TH", "ar-SA", "zh-CN", "zh-TW", "ja-JP", "ko-KR",
];

test.describe("choosing the language", () => {
  test("every language Twitch offers has a catalog of its own", () => {
    for (const tag of TWITCH_CODES) {
      const code = resolveLanguage([tag]);
      expect(LANGUAGES.find((l) => l.twitch.includes(tag))?.code, tag).toBe(code);
      expect(code === "en" && tag !== "en-US", tag).toBe(false); // none falls back to English
    }
  });

  test("takes the first language in the list that the extension has", () => {
    expect(resolveLanguage(["xx-XX", "es-ES", "en-US"])).toBe("es");
    expect(resolveLanguage([undefined, "", null, "de"])).toBe("de");
  });

  test("matches by the main part of the code, whatever the region or separator", () => {
    for (const tag of ["es", "es-ES", "es-419", "es_MX", "ES-ar"]) expect(resolveLanguage([tag])).toBe("es");
    expect(resolveLanguage(["ru-UA"])).toBe("ru");
  });

  test("tells the two Chinese scripts and the two Portuguese apart", () => {
    expect(resolveLanguage(["zh-CN"])).toBe("zh-CN");
    expect(resolveLanguage(["zh-Hans-CN"])).toBe("zh-CN");
    expect(resolveLanguage(["zh-TW"])).toBe("zh-TW");
    expect(resolveLanguage(["zh-Hant"])).toBe("zh-TW");
    expect(resolveLanguage(["zh-HK"])).toBe("zh-TW");
    expect(resolveLanguage(["zh"])).toBe("zh-CN");
    expect(resolveLanguage(["pt-PT"])).toBe("pt-PT");
    expect(resolveLanguage(["pt-BR"])).toBe("pt-BR");
    expect(resolveLanguage(["pt"])).toBe("pt-BR");
    expect(resolveLanguage(["en-GB"])).toBe("en-GB");
    expect(resolveLanguage(["en-AU"])).toBe("en");
    expect(resolveLanguage(["nb-NO"])).toBe("no");
  });

  test("is English when none of them is offered", () => {
    expect(resolveLanguage(["xx", "he-IL"])).toBe("en");
    expect(resolveLanguage([])).toBe("en");
  });

  test("knows the pseudo-locale, which is only for tests, and only the languages it lists", () => {
    expect(resolveLanguage(["qps-ploc"])).toBe(PSEUDO);
    expect(isLanguageCode(PSEUDO)).toBe(true);
    expect(isLanguageCode("auto")).toBe(false);
    expect(isLanguageCode("de")).toBe(true);
    expect(LANGUAGES.map((l) => l.code)).not.toContain(PSEUDO);
  });

  test("lists every language by its own name, once each", () => {
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(LANGUAGES.length);
    expect(new Set(LANGUAGES.map((l) => l.name)).size).toBe(LANGUAGES.length);
    expect(LANGUAGES.map((l) => l.name).slice(0, 3)).toEqual(["English", "Dansk", "Deutsch"]);
  });

  test("Arabic is the only language written right to left", () => {
    expect(LANGUAGES.filter((l) => l.dir === "rtl").map((l) => l.code)).toEqual(["ar"]);
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("de")).toBe("ltr");
    expect(directionOf(PSEUDO)).toBe("ltr");
  });
});

test.describe("turning a key into text", () => {
  test("fills in {placeholders}", async () => {
    expect(tEn("connect.button", { login: "ana" })).toBe("Connect for ana");
    expect(translate("es", await load("es"), "connect.button", { login: "ana" })).toBe("Conectar para ana");
    expect(tEn("sidebar.liveOf", { live: 2, total: 9 })).toBe("2 live of 9");
  });

  test("leaves a placeholder alone when it is given no value", () => {
    expect(tEn("connect.button")).toBe("Connect for {login}");
  });

  test("picks the plural form from count, and shows countText when there is one", async () => {
    expect(tEn("row.viewers", { count: 1 })).toBe("1 viewer");
    expect(tEn("row.viewers", { count: 7 })).toBe("7 viewers");
    expect(tEn("row.viewers", { count: 1500, countText: "1.5K" })).toBe("1.5K viewers");
    const es = await load("es");
    expect(translate("es", es, "row.viewers", { count: 1 })).toBe("1 espectador");
    expect(translate("es", es, "row.viewers", { count: 12 })).toBe("12 espectadores");
    expect(translate("es", es, "row.viewers", { count: 2000000, countText: "2 M" })).toBe("2 M de espectadores");
  });

  test("a count of switches is singular when it is one", async () => {
    expect(translate("es", await load("es"), "popup.hideSections.count", { count: 1 })).toBe("1 activada");
    expect(translate("es", await load("es"), "popup.hideSections.count", { count: 3 })).toBe("3 activadas");
    expect(tEn("popup.hideSections.count", { count: 1 })).toBe("1 on");
  });

  test("uses the plural forms each language has", async () => {
    const ru = await load("ru");
    const viewers = (n: number) => translate("ru", ru, "row.viewers", { count: n });
    expect([viewers(1), viewers(2), viewers(5), viewers(21), viewers(11)]).toEqual(["1 зритель", "2 зрителя", "5 зрителей", "21 зритель", "11 зрителей"]);
    const pl = await load("pl");
    const widzowie = (n: number) => translate("pl", pl, "row.viewers", { count: n });
    expect([widzowie(1), widzowie(3), widzowie(5), widzowie(22)]).toEqual(["1 widz", "3 widzów", "5 widzów", "22 widzów"]);
    const ar = await load("ar");
    const arabic = (n: number) => translate("ar", ar, "row.viewers", { count: n });
    expect([arabic(0), arabic(1), arabic(2), arabic(3), arabic(11), arabic(100)]).toEqual(["لا مشاهدين", "مشاهد واحد", "مشاهدان", "3 مشاهدين", "11 مشاهدًا", "100 مشاهد"]);
    const ja = await load("ja");
    expect(translate("ja", ja, "row.viewers", { count: 1 })).toBe("視聴者1人");
  });

  test("an English message keeps the exact wording the app has always shown", () => {
    expect(tEn("groupName.tooLong", { max: 15 })).toBe("Group name cannot be over 15 characters");
    expect(tEn("sidebar.loading")).toBe("Loading groups and channels...");
    expect(tEn("dialog.colorChoice", { name: "Red" })).toBe("Red color");
  });

  test("shows counts the way people read them in each language", () => {
    expect(formatCount("en", 2800)).toBe("2.8K");
    expect(formatCount("pt-BR", 2800)).toMatch(/2,8\s*mil/);
    // Twitch writes the number out in full in these
    expect(formatCount("es", 2800)).toBe("2800");
    expect(formatCount("de", 2800)).toBe("2.800");
    expect(formatCount("en", 40)).toBe("40");
    expect(formatCount("ar", 40)).toBeTruthy();
  });

  test("a message missing from a catalog is shown in English", async () => {
    const partial = { ...(await load("de")) };
    delete partial["popup.logout"];
    expect(translate("de", partial, "popup.logout")).toBe(en["popup.logout"]);
  });
});

test.describe("the pseudo-locale", () => {
  test("wraps a message in brackets, changes its letters, and keeps the placeholders working", () => {
    const text = translate(PSEUDO, undefined, "connect.button", { login: "ana" });
    expect(text).toMatch(/^\[.*\]$/);
    expect(text).toContain("ana"); // the value is filled in, not scrambled
    expect(text).not.toContain("Connect");
    expect(text).not.toContain("{");
  });

  test("every message in it is bracketed, so an untranslated string cannot hide", () => {
    for (const key of keys) expect(translate(PSEUDO, undefined, key, { count: 3, login: "x", name: "x", live: 1, total: 2, error: "x", query: "x", max: 1, min: 1 })).toMatch(/^\[.*\]$/);
  });
});

test.describe("the catalogs", () => {
  test("there is one catalog file for each language in the list, and no other", () => {
    const files = fs.readdirSync(path.resolve("src/pages/shared/i18n/catalogs")).map((f) => f.replace(/\.ts$/, ""));
    expect(files.sort()).toEqual(others.map((l) => l.code).sort());
  });

  for (const { code } of others) {
    test.describe(code, () => {
      test("has exactly the keys English has", async () => {
        expect(Object.keys(await load(code)).sort()).toEqual([...keys].sort());
      });

      test("uses the same placeholders as the English message, and no message is empty", async () => {
        const catalog = await load(code);
        for (const key of keys) {
          const found = placeholders(catalog[key]);
          // A plural form may leave {count} out ("one person", "no viewers"), but none may add a placeholder
          for (const name of found) expect(placeholders(en[key]).has(name), `${key}: {${name}}`).toBe(true);
          if (typeof en[key] === "string") expect([...found].sort(), key).toEqual([...placeholders(en[key])].sort());
          for (const text of forms(catalog[key])) expect(text.trim().length, key).toBeGreaterThan(0);
        }
      });

      test("has the plural forms the language needs, no more and no fewer", async () => {
        const catalog = await load(code);
        const categories = [...new Intl.PluralRules(code).resolvedOptions().pluralCategories].sort();
        for (const key of keys) {
          if (typeof en[key] === "string") expect(typeof catalog[key], key).toBe("string");
          else expect(Object.keys(catalog[key]).sort(), key).toEqual(categories);
        }
      });

      test("is not just the English text left in", async () => {
        const catalog = await load(code);
        // Words that are the same in some languages (a color's name, a loanword) are fine; a catalog that is mostly English is not
        const same = keys.filter((key) => JSON.stringify(catalog[key]) === JSON.stringify(en[key]));
        expect(same.length, same.join(", ")).toBeLessThanOrEqual(code === "en-GB" ? keys.length : 8);
      });

      test("keeps the product names as they are", async () => {
        const catalog = await load(code);
        expect(forms(catalog["popup.sync.onHint"]).join(" ")).toMatch(/Chrom/);
        expect(forms(catalog["popup.signedOut"]).join(" ")).toContain("Twitch");
      });
    });
  }
});

test.describe("the extension's name and description in the Chrome Web Store", () => {
  const chromeFolder = (code: string) => code.replace("-", "_");

  test("each language has a folder, and the folders are the languages", () => {
    const folders = fs.readdirSync(path.resolve("src/locales")).sort();
    expect(folders).toEqual(LANGUAGES.map((l) => chromeFolder(l.code)).sort());
  });
});

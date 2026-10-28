// Turning a message key into text. Pure (no chrome.* or React), so it is tested in plain node. Which language
// to use is in languages.ts; the browser side, which knows the current language and loads its catalog, is in
// store.ts.
import { en, type Catalog, type MessageKey } from "./catalog.en";
import { PSEUDO } from "./languages";

export type { MessageKey, Catalog } from "./catalog.en";

const PSEUDO_LETTERS: Record<string, string> = { a: "å", e: "é", i: "ï", o: "ø", u: "ü", n: "ñ", c: "ç", s: "š", t: "ţ", l: "ł", y: "ý" };
const pseudoLocalize = (text: string) =>
  "[" + text.split(/(\{\w+\})/).map((part) => (part.startsWith("{") ? part : part.replace(/[A-Za-z]/g, (c) => PSEUDO_LETTERS[c.toLowerCase()] ?? c))).join("") + "]";

export type Params = Record<string, string | number>;

// The language the number rules (plurals, counts) come from: the pseudo-locale reads like English
const intlLocale = (locale: string) => (locale === PSEUDO ? "en" : locale);

// locale is the language's code and catalog its messages (none for English and the pseudo-locale, which use
// the English ones). A message missing from a catalog falls back to English.
export const translate = (locale: string, catalog: Catalog | undefined, key: MessageKey, params?: Params): string => {
  const message = (locale === PSEUDO ? undefined : catalog?.[key]) ?? en[key];
  let text: string;
  if (typeof message === "string") text = message;
  else {
    // The plural categories the language has: Russian "few" and "many", Arabic "zero" and "two", and so on
    const category = new Intl.PluralRules(intlLocale(locale)).select(Number(params?.count)) as keyof typeof message;
    text = message[category] ?? message.other;
  }
  if (locale === PSEUDO) text = pseudoLocalize(text);
  // countText is how the count is shown ("2.8K") when the raw number (2800) picks the plural form
  return text.replace(/\{(\w+)\}/g, (placeholder, name) => {
    if (!params) return placeholder;
    if (name === "count" && "countText" in params) return String(params.countText);
    return name in params ? String(params[name]) : placeholder;
  });
};

// A translator for code that does not follow the user's language (and for tests): English
export type Translator = (key: MessageKey, params?: Params) => string;
export const tEn: Translator = (key, params) => translate("en", undefined, key, params);

// A count the way people read it in that language ("2.8K", "2,8 mil")
export const formatCount = (locale: string, count: number): string => new Intl.NumberFormat(intlLocale(locale), { notation: "compact" }).format(count);

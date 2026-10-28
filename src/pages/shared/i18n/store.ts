import { useSyncExternalStore } from "react";
import { TWITCH_LANGUAGE_KEY } from "../../utils/constants";
import { formatCount, translate, type Catalog, type MessageKey, type Params } from "./i18n";
import { directionOf, resolveLanguage, type Direction } from "./languages";

// The language the extension is showing now. A Twitch page follows Twitch's language (so the sidebar matches
// the page around it); the popup follows the last language a Twitch page was seen in. There is no setting
// of our own: Twitch's language decides, and Chrome's own language is the fallback before English.
//
// Only the catalog of the language in use is loaded (English is always there): the content script runs on
// every Twitch page, and thirty catalogs do not belong in it.
const loaders = import.meta.glob<{ default: Catalog }>("./catalogs/*.ts");

const loadCatalog = async (code: string): Promise<Catalog | undefined> => {
  const load = loaders[`./catalogs/${code}.ts`];
  return load ? (await load()).default : undefined;
};

type State = { code: string; catalog: Catalog | undefined; dir: Direction };
let state: State = { code: "en", catalog: undefined, dir: "ltr" };
const listeners = new Set<() => void>();
let latest = 0;

const apply = async (code: string) => {
  const mine = ++latest;
  const catalog = await loadCatalog(code);
  if (mine !== latest) return; // a newer choice arrived while this one loaded
  if (code === state.code && catalog === state.catalog) return;
  state = { code, catalog, dir: directionOf(code) };
  listeners.forEach((listener) => listener());
};

export const getLanguage = () => state.code;
export const getDirection = () => state.dir;
export const t = (key: MessageKey, params?: Params): string => translate(state.code, state.catalog, key, params);
export const count = (n: number): string => formatCount(state.code, n);

const subscribe = (listener: () => void) => (listeners.add(listener), () => listeners.delete(listener));

// For code outside React: called when the language changes
export const onLanguageChange = subscribe;

// For components: re-renders when the language changes, and gives back t
export const useT = () => {
  useSyncExternalStore(subscribe, () => state);
  return t;
};
// The direction the language is written in, for layout ("rtl" for Arabic)
export const useDirection = (): Direction => useSyncExternalStore(subscribe, () => state.dir);

type Source = "page" | "popup";

// Reads the language Twitch is in, sets the language, and keeps it up to date. Call it
// before showing anything, so the first thing on screen is already in the right language.
export const initI18n = async (source: Source): Promise<void> => {
  const compute = async () => {
    const stored = await chrome.storage.local.get(TWITCH_LANGUAGE_KEY);
    // Only a Twitch page knows what language Twitch is in right now; the popup uses what was last seen
    const twitch = source === "page" ? document.documentElement.lang : stored[TWITCH_LANGUAGE_KEY];
    await apply(resolveLanguage([twitch, navigator.language]));
    // The popup is our own page, so it takes the language's direction; a Twitch page keeps Twitch's, and our
    // own parts of it follow the language (see useDirection)
    if (source === "popup") {
      document.documentElement.lang = state.code;
      document.documentElement.dir = state.dir;
    }
    return stored;
  };

  const stored = await compute();
  if (source === "page") {
    const remember = () => {
      const lang = document.documentElement.lang;
      if (lang) void chrome.storage.local.set({ [TWITCH_LANGUAGE_KEY]: lang });
    };
    if (document.documentElement.lang && stored[TWITCH_LANGUAGE_KEY] !== document.documentElement.lang) remember();
    // Twitch changes the page's language without a reload when the user picks another
    new MutationObserver(() => {
      remember();
      void compute();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[TWITCH_LANGUAGE_KEY]) void compute();
  });
};

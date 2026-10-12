import { ROW_TEMPLATE_KEY } from "@src/pages/utils/constants";
import bundledLiveTemplate from "./templates/live.html?raw";
import { isPlainLiveRow, nativeRows } from "./nativeRows";

// Where the template for a plain live row comes from, in order:
//   1. a plain live row Twitch has rendered on this page (always current),
//   2. the last one captured from a page, kept in storage,
//   3. the row bundled with the extension.
// A captured template is blanked first, so it holds no account data.

const BLANK_AVATAR = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

let storedHtml: string | null = null;
let lastWrittenHtml: string | null = null;

const parse = (html: string): HTMLAnchorElement | null => {
  const holder = document.createElement("template");
  holder.innerHTML = html.trim();
  return holder.content.firstElementChild as HTMLAnchorElement | null;
};

// Everything that identifies a channel or changes over time is removed; the structure and classes stay
const blank = (row: HTMLAnchorElement): HTMLAnchorElement => {
  const copy = row.cloneNode(true) as HTMLAnchorElement;
  copy.removeAttribute("data-a-id");
  copy.setAttribute("href", "#");
  copy.querySelectorAll("img").forEach((img) => {
    img.setAttribute("src", BLANK_AVATAR);
    img.removeAttribute("srcset");
  });
  copy.querySelectorAll("[title]").forEach((el) => el.setAttribute("title", ""));
  copy.querySelectorAll("[data-a-target=side-nav-title], [data-a-target=side-nav-card-metadata] p, [data-a-target=side-nav-live-status] span, [data-a-target=side-nav-live-status] p").forEach((el) => {
    if (el.children.length === 0 && !/^Live$/i.test(el.textContent || "")) el.textContent = "";
  });
  return copy;
};

export const loadStoredTemplate = async () => {
  const result = await chrome.storage.local.get(ROW_TEMPLATE_KEY);
  storedHtml = result[ROW_TEMPLATE_KEY]?.html ?? null;
  lastWrittenHtml = storedHtml;
};

const remember = (html: string) => {
  if (html === lastWrittenHtml) return;
  lastWrittenHtml = html;
  storedHtml = html;
  chrome.storage.local.set({ [ROW_TEMPLATE_KEY]: { html, capturedAt: Date.now() } });
};

// Keep a copy of Twitch's current plain live row, so it is available on a page that has none
export const captureTemplateIfAvailable = () => {
  const native = nativeRows().find(isPlainLiveRow);
  if (native) remember(blank(native).outerHTML);
};

// A fresh copy of the plain live row to build rows from
export const liveRowTemplate = (): HTMLAnchorElement => {
  const native = nativeRows().find(isPlainLiveRow);
  if (native) return blank(native);
  return (storedHtml && parse(storedHtml)) || parse(bundledLiveTemplate)!;
};

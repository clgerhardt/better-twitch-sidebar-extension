// Twitch shows a tooltip beside a hovered row, and for a shared stream it lists who else is live with
// it. Our rows are copies without Twitch's handlers, so the content is taken from Twitch's own tooltip:
// hovering Twitch's (hidden) row makes Twitch render it, and we copy the content and close it again.
// All selectors that depend on Twitch's markup are here, because that markup changes without notice.

const OVERLAY = ".ReactModal__Overlay";
const DIALOG_BODY = "[role=dialog] [tabindex='0']";
const GIVE_UP_MS = 800;

const fire = (row: Element, types: string[]) => types.forEach((type) => row.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })));

// The content of Twitch's tooltip for this row, or null when Twitch shows none. Twitch's own tooltip
// is hidden while it is open, since it would appear at the top left of the page.
export const readNativeTooltip = (row: HTMLAnchorElement): Promise<HTMLElement | null> =>
  new Promise((resolve) => {
    let finished = false;
    const finish = (content: HTMLElement | null) => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      clearTimeout(timer);
      fire(row, ["mouseout", "mouseleave"]);
      resolve(content);
    };
    // Only the overlay this hover opens is ours to hide
    const existing = new Set(document.querySelectorAll(OVERLAY));
    const look = () => {
      document.querySelectorAll<HTMLElement>(OVERLAY).forEach((overlay) => {
        if (existing.has(overlay)) return;
        overlay.style.visibility = "hidden";
        const body = overlay.querySelector<HTMLElement>(DIALOG_BODY);
        if (body?.textContent?.trim()) finish(body.cloneNode(true) as HTMLElement);
      });
    };
    const observer = new MutationObserver(look);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => finish(null), GIVE_UP_MS);
    fire(row, ["mouseover", "mouseenter"]);
    look();
  });

// The product name, drawn here so it lives in the code (not baked into an image) and every popup screen
// shares it. "Better Sidebar" is the name: the extension is not affiliated with Twitch.
import { useT } from "@src/pages/shared/i18n/store";

export const PRODUCT_NAME = "Better Sidebar";

const Banner = () => {
  const t = useT();
  return (
  <div data-testid="popup-banner" className="flex items-center gap-3 rounded-xl bg-[#8266e8] px-4 py-3">
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <rect x="7" y="7" width="7" height="6" rx="1" />
      <rect x="10" y="10" width="7" height="6" rx="1" />
    </svg>
    <div className="leading-tight">
      <div className="text-[13px] font-semibold uppercase tracking-wider text-white">{PRODUCT_NAME}</div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-[#e4dcff]">{t("banner.tagline")}</div>
    </div>
  </div>
  );
};

export default Banner;

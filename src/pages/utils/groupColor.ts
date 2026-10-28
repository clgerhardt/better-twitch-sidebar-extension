// The accent color of a group: the bar down the left side of its header. No chrome.* imports, so it is
// tested in plain node.
import type { MessageKey } from "../shared/i18n/i18n";

// Tailwind's purple-500, which every group has until the user picks another
export const DEFAULT_GROUP_COLOR = "#a855f7";

// The colors offered as quick picks (the default first); any other color can be chosen with the color input
export const GROUP_COLOR_CHOICES: { nameKey: MessageKey; value: string }[] = [
  { nameKey: "color.purple", value: DEFAULT_GROUP_COLOR },
  { nameKey: "color.red", value: "#ef4444" },
  { nameKey: "color.orange", value: "#f97316" },
  { nameKey: "color.yellow", value: "#eab308" },
  { nameKey: "color.green", value: "#22c55e" },
  { nameKey: "color.teal", value: "#14b8a6" },
  { nameKey: "color.blue", value: "#3b82f6" },
  { nameKey: "color.pink", value: "#ec4899" },
];

// A stored color is a "#rrggbb" string. Anything else (hand-edited storage, an older version) is ignored.
export const normalizeGroupColor = (value: unknown): string | undefined =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : undefined;

const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#0e0e10";

// WCAG relative luminance, 0 (black) to 1 (white)
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// WCAG's minimum contrast for interface elements
const MIN_CONTRAST = 3;

// Text that reads on a background of this color: white as long as it has enough contrast (so the default
// purple keeps its white text), near-black on colors too light for that
export const readableTextColor = (background: string): string => {
  const l = luminance(normalizeGroupColor(background) ?? DEFAULT_GROUP_COLOR);
  return 1.05 / (l + 0.05) >= MIN_CONTRAST ? LIGHT_TEXT : DARK_TEXT;
};

// Tailwind config for the content script. The content CSS is injected into every twitch.tv page,
// so Tailwind's global reset (preflight) must stay off: it restyles Twitch's own elements.
// scoped-preflight.css re-applies the reset inside the extension's own containers only.
const base = require("./tailwind.config.cjs");

module.exports = {
  ...base,
  corePlugins: { ...(base.corePlugins || {}), preflight: false },
};

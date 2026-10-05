# Better Twitch Sidebar

Chrome MV3 extension (Vite, React, TypeScript, Tailwind) that adds channel groups to Twitch's sidebar. Design direction: `docs/design/extension-overhaul.md`.

## Build

- `yarn build:chrome` builds to `dist_chrome/`; `yarn build:firefox` is deferred
- `VITE_LOGGER_LEVEL=debug yarn build:chrome` enables `messageLogger` output. Rebuild without it when done

## Testing the extension in a browser (rules for Claude)

- Build first, then use a throwaway Chrome profile under the scratchpad directory. Never use the user's real profile
- Branded Chrome 137+ ignores `--load-extension`. Launch with `--user-data-dir=<scratchpad>/profile --remote-debugging-port=9222 --enable-unsafe-extension-debugging`, then call `Extensions.loadUnpacked` with the `dist_chrome` path on the browser-level CDP websocket (`/json/version`)
- To pick up a new build, `Extensions.uninstall` then `loadUnpacked` again
- Never log in or enter credentials. Ask the user to log in inside the test window, or use seeded fixtures
- Test the popup through the real toolbar action. Opening `popup/index.html` as a tab makes it the "active tab", which breaks the background (it uses `tabs.query({active: true})`)
- `chrome.runtime.reload()` and reinstall trigger `onInstalled`, which currently clears all storage (known bug). Expect a reset state
- Background tabs throttle CSS transitions, so screenshots can show half-faded UI. Call `Page.bringToFront` before capturing
- The service worker goes idle and disappears from `/json/list`. Read extension storage from an extension page instead
- Close the test browser and delete scratch scripts when finished

## Conventions

- Do not commit to `main`. Ask before committing. Stage files by name
- Storage keys live in `src/pages/utils/constants.ts`; do not add new ad hoc keys

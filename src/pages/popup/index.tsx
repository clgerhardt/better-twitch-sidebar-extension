import { createRoot } from "react-dom/client";
import "./index.css";
import Popup from "./Popup";
import { initI18n } from "../shared/i18n/store";

async function init() {
    // The language is known before anything is drawn, so the popup never flashes in the wrong one
    await initI18n("popup");
    const appContainer = document.createElement('div')
    document.body.appendChild(appContainer)
    if (!appContainer) {
        throw new Error("Can not find AppContainer");
    }
    const root = createRoot(appContainer)
    root.render(<Popup />);
}

void init();

import { createRoot } from "react-dom/client";
import "./index.css";
import Popup from "./Popup";

function init() {
    const appContainer = document.createElement('div')
    document.body.appendChild(appContainer)
    if (!appContainer) {
        throw new Error("Can not find AppContainer");
    }
    const root = createRoot(appContainer)
    root.render(<Popup />);
}

init();
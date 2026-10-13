import { useState, useEffect } from 'react';

// Twitch's own collapse button says which state the side nav is in: its label offers the action
// that is not the current state. The sidebar is expanded unless the button says "Expand Side Nav"
// (also when the button cannot be found).
const SIDE_NAV_ARROW = '[data-a-target="side-nav-arrow"]';
const SIDE_NAV_BAR = '[data-a-target="side-nav-bar"]';

const readExpanded = () => document.querySelector(SIDE_NAV_ARROW)?.getAttribute("aria-label") !== "Expand Side Nav";

const useSidebarState = () => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(readExpanded);

  useEffect(() => {
    const apply = () => {
      const expanded = readExpanded();
      setIsSidebarExpanded(expanded);
      const manageGroupRoot = document.getElementById("__manage-groups-root");
      if (manageGroupRoot) manageGroupRoot.style.maxHeight = expanded ? "3.5rem" : "0rem";
    };

    apply();
    // The button can be replaced when Twitch re-renders, so watch its container, not the button
    const observer = new MutationObserver(apply);
    observer.observe(document.querySelector(SIDE_NAV_BAR) ?? document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-label"],
    });
    return () => observer.disconnect();
  }, []);

  return isSidebarExpanded;
};

export default useSidebarState;

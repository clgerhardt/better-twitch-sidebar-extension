import { useState, useEffect } from 'react';
import { isSidebarCollapsed } from '../twitchSections';

// Twitch swaps its whole sidebar element when it collapses, and the collapsed one is marked as such
// (see twitchSections). The sidebar counts as expanded unless that mark is found, also while the page
// is still loading.
const readExpanded = () => !isSidebarCollapsed();

// The sidebar's container, which stays when Twitch swaps the sidebar inside it
const sidebarContainer = () => document.querySelector('[data-a-target^="side-nav-bar"]')?.parentElement ?? document.body;

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
    const observer = new MutationObserver(apply);
    observer.observe(sidebarContainer(), {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "data-a-target"],
    });
    return () => observer.disconnect();
  }, []);

  return isSidebarExpanded;
};

export default useSidebarState;

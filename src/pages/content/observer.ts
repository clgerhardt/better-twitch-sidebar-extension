// Observer and related functions

export const createMutationObserver = (port: chrome.runtime.Port) => {
  return new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "attributes" && mutation.attributeName === "aria-label") {
        const expandedSidebarBtn = mutation.target as HTMLElement;
        if (expandedSidebarBtn.ariaLabel === "Expand Side Nav") {
          port.postMessage({ message: "SYS:Followers:EXPANDED_SIDEBAR" });
        } else if (expandedSidebarBtn.ariaLabel === "Collapse Side Nav") {
          port.postMessage({ message: "SYS:Followers:COLLAPSED_SIDEBAR" });
        }
      }
    }
  });
};

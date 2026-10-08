// Observer and related functions

export const createMutationObserver = (post: (message: { message: string }) => void) => {
  return new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "attributes" && mutation.attributeName === "aria-label") {
        const expandedSidebarBtn = mutation.target as HTMLElement;
        if (expandedSidebarBtn.ariaLabel === "Expand Side Nav") {
          post({ message: "SYS:Followers:EXPANDED_SIDEBAR" });
        } else if (expandedSidebarBtn.ariaLabel === "Collapse Side Nav") {
          post({ message: "SYS:Followers:COLLAPSED_SIDEBAR" });
        }
      }
    }
  });
};

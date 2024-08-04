// Observer and related functions

export const createMutationObserver = (port: any, setFollowersDOMNode: any) => {
  return new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes.length === 1) {
        const addedNode = mutation.addedNodes[0] as HTMLElement;
        if (addedNode.ariaLabel === "Followed Channels") {
          setFollowersDOMNode(addedNode);
          hideFollowedChannelsSideNav(addedNode);
          port.postMessage({ message: "SYS:Followers:FOLLOWED_CHANNELS_LOADED" });
        }
      }
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

const hideFollowedChannelsSideNav = (node: any) => {
  node.classList.remove("dcyYPL");
  node.style.display = "none";
};

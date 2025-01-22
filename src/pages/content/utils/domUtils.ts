// Utility functions for DOM manipulation

import { constants } from "@src/pages/utils/constants";
import { messageLogger } from "@src/pages/utils/logger";

export const getElementBySelector = (selector: any) => document.querySelector(selector);

export const createElement = (id: any, styles = {}) => {
  const element = document.createElement('div');
  element.id = id;
  Object.assign(element.style, styles);
  return element;
};

export const insertBefore = (newElement: any, referenceElement: any) => {
  const parent = referenceElement.parentNode;
  if (parent) {
    parent.insertBefore(newElement, referenceElement);
  }
};

export const waitUntilNoMoreShowMoreButton = async () => {
  messageLogger(constants.location.UTIL, "Entering waitUntilNoMoreShowMoreButton function");
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const showMoreBtn = getElementBySelector('[data-a-target="side-nav-show-more-button"]');
      if (showMoreBtn) {
        showMoreBtn.click();
      } else {
        messageLogger(constants.location.UTIL, "Show more button not found, resolving waitUntilNoMoreShowMoreButton");
        resolve(true);
        clearInterval(interval);
      }
    }, 10);
  });
};

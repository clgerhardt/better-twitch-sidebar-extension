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
  messageLogger(constants.location.UTIL, "Entering insertBefore function");
  console.log("ref ele: ", referenceElement);
  const parent = referenceElement?.parentNode;
  if (parent) {
    parent.insertBefore(newElement, referenceElement);
  }
};

// Utility functions for DOM manipulation

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

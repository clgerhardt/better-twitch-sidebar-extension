import { useEffect, useState } from "react";
import { nativeRowsSignature } from "../rows/nativeRows";
import { captureTemplateIfAvailable, loadStoredTemplate } from "../rows/rowTemplates";

// A number that changes whenever Twitch's own rows change (they load a little after the page does,
// and switch between live and offline), so rows built from them can be rebuilt. It also changes once
// the stored template has been read.
export const useNativeRowsVersion = (): number => {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let last = nativeRowsSignature();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = () => {
      const signature = nativeRowsSignature();
      if (signature !== last) {
        last = signature;
        captureTemplateIfAvailable();
        setVersion((v) => v + 1);
      }
    };
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(check, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Read what was stored on an earlier page first, then keep it up to date from this one
    loadStoredTemplate()
      .then(() => {
        captureTemplateIfAvailable();
        setVersion((v) => v + 1);
      })
      .catch(() => {});

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return version;
};

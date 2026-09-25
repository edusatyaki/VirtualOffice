import { useCallback, useEffect, useState, type RefObject } from 'react';

type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

/**
 * Puts one element (here, the whole app) into full screen with the Fullscreen API,
 * including Safari's webkit prefix. `supported` is false where the browser has no
 * element full screen (e.g. iPhone Safari), so the button can be hidden there.
 */
export function useFullscreen(ref: RefObject<HTMLElement>) {
  const doc = document as FsDocument;
  const supported = !!(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => {
      const el = doc.fullscreenElement ?? doc.webkitFullscreenElement;
      setActive(!!el && el === ref.current);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [doc, ref]);

  const enter = useCallback(async () => {
    const el = ref.current as FsElement | null;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else await el.webkitRequestFullscreen?.();
    } catch {
      // The browser refused (no user gesture, or a sandboxed frame); stay as we are.
    }
  }, [ref]);

  const exit = useCallback(async () => {
    if (doc.fullscreenElement) await doc.exitFullscreen().catch(() => {});
    else if (doc.webkitFullscreenElement) await doc.webkitExitFullscreen?.();
  }, [doc]);

  const toggle = useCallback(() => (active ? exit() : enter()), [active, enter, exit]);

  return { supported, active, toggle };
}

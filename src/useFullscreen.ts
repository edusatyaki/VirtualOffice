import { useCallback, useEffect, useState, type RefObject } from 'react';

type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

/**
 * Puts one element into full screen. Uses the Fullscreen API (with Safari's
 * webkit prefix); where that isn't available, such as iPhone Safari, falls back
 * to filling the browser window with CSS (the `fallback` flag).
 */
export function useFullscreen(ref: RefObject<HTMLElement>) {
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const doc = document as FsDocument;
    const sync = () => setNative(!!(doc.fullscreenElement ?? doc.webkitFullscreenElement) && (doc.fullscreenElement ?? doc.webkitFullscreenElement) === ref.current);
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [ref]);

  const enter = useCallback(async () => {
    const el = ref.current as FsElement | null;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else setFallback(true);
    } catch {
      setFallback(true);
    }
  }, [ref]);

  const exit = useCallback(async () => {
    setFallback(false);
    const doc = document as FsDocument;
    if (doc.fullscreenElement) await doc.exitFullscreen().catch(() => {});
    else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
  }, []);

  const active = native || fallback;
  const toggle = useCallback(() => (active ? exit() : enter()), [active, enter, exit]);

  // Esc already leaves native full screen; make it leave the CSS fallback too.
  useEffect(() => {
    if (!fallback) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFallback(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fallback]);

  return { active, fallback, enter, exit, toggle };
}

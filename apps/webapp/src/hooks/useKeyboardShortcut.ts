import { useEffect } from "react";

export type ShortcutBinding = {
  key: string; // e.g. "Enter", "Escape", "k", "/"
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (e: KeyboardEvent) => void;
  preventDefault?: boolean;
  stopPropagation?: boolean;
};

export function useKeyboardShortcut(
  bindings: ShortcutBinding[],
  options?: { enabled?: boolean; target?: Document | HTMLElement }
) {
  const enabled = options?.enabled ?? true;
  useEffect(() => {
    if (!enabled) return;
    const target: any = options?.target || window;

    const onKeyDown = (e: KeyboardEvent) => {
      for (const b of bindings) {
        if (
          e.key === b.key &&
          (!!b.ctrl === (e.ctrlKey || false)) &&
          (!!b.meta === (e.metaKey || false)) &&
          (!!b.shift === (e.shiftKey || false)) &&
          (!!b.alt === (e.altKey || false))
        ) {
          if (b.preventDefault) e.preventDefault();
          if (b.stopPropagation) e.stopPropagation();
          b.handler(e);
          break;
        }
      }
    };

    target.addEventListener("keydown", onKeyDown as any);
    return () => target.removeEventListener("keydown", onKeyDown as any);
  }, [enabled, options?.target, ...bindings.map((b) => b.key + String(b.ctrl) + String(b.meta) + String(b.shift) + String(b.alt))]);
}

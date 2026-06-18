"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a ref callback for a list row that scrolls it into view (minimally,
 * `block: "nearest"`) when it enters the list, so the enter animation is visible
 * even when the new row lands outside the scroll viewport — e.g. a chapter
 * appended to the end of a long, scrolled list, or a top-inserted entity row when
 * the list is scrolled down. It is a no-op when the row is already visible.
 *
 * The scroll only fires while `isEntering` is true. Rows present at initial load
 * never enter (FR-005), and under `prefers-reduced-motion` rows never enter
 * either, so neither triggers an automatic scroll.
 */
export function useScrollIntoViewOnEnter(isEntering: boolean): (node: HTMLElement | null) => void {
  const nodeRef = useRef<HTMLElement | null>(null);

  const setRef = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  useEffect(() => {
    if (isEntering) {
      nodeRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isEntering]);

  return setRef;
}

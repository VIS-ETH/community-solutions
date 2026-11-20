import { useLayoutEffect, useState, type RefObject } from "react";

export function useWidth(
  target: RefObject<HTMLElement | null>,
  initialWidth: number,
): number {
  const [width, setWidth] = useState(initialWidth);

  useLayoutEffect(() => {
    const element = target.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      setWidth(element.clientWidth);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [target]);

  return width;
}

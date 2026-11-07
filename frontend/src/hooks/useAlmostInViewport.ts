// Modified version of https://github.com/umijs/hooks/blob/master/packages/hooks/src/useInViewport/index.ts
/*
MIT License

Copyright (c) 2019 umijs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { useRef, useLayoutEffect, useState, type RefObject } from "react";

const radius = 500;

type InViewport = boolean | undefined;

function useAlmostInViewport<T extends HTMLElement = HTMLElement>(): [
  InViewport,
  RefObject<T | null>,
];
function useAlmostInViewport<T extends HTMLElement = HTMLElement>(): [
  InViewport,
  RefObject<T | null>?,
] {
  const elementRef = useRef<T>(null);
  const [inViewport, setInViewport] = useState<InViewport>(false);

  useLayoutEffect(() => {
    const targetElement = elementRef.current;

    if (!targetElement) {
      return () => {
        /* no-op */
      };
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInViewport(true);
          } else {
            setInViewport(false);
          }
        }
      },
      { rootMargin: `${radius}px ${radius}px ${radius}px ${radius}px` },
    );

    observer.observe(targetElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  return [inViewport, elementRef];
}

export default useAlmostInViewport;

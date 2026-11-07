import type {
  TextContent,
  TextItem,
  TextMarkedContent,
  TextStyle,
} from "pdfjs-dist/types/src/display/api";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PDF from "../pdf/pdf-renderer";

const MAX_ITEMS = 1_000;

function isPdfTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  // `str` is hopefully stable
  return Object.hasOwn(item, "str");
}

const useTextLayer = (
  shouldRender: boolean,
  renderer: PDF,
  pageNumber: number,
  view: PdfViewTuple,
  start: number,
  end: number,
): TextContent | null => {
  const [textContent, setTextContent] = useState<TextContent | null>(null);
  const runningRef = useRef(false);
  useEffect(() => {
    runningRef.current = true;
    if (shouldRender) {
      void (async () => {
        const text = await renderer.renderText(pageNumber);
        if (!runningRef.current) return;
        setTextContent(text);
      })();
    }
    return () => {
      runningRef.current = false;
    };
  }, [shouldRender, pageNumber, renderer]);
  const filteredItems = useMemo(() => {
    if (textContent === null) return;
    if (textContent.items.length > MAX_ITEMS) return;
    return textContent.items.filter(item => {
      if (!isPdfTextItem(item)) return false;

      const [, , , offsetY, , y] = item.transform as TextTransformTuple;
      const [, , , yMax] = view;
      const top = yMax - (y + offsetY);
      const bottom = top + item.height;
      return !(top / yMax > end || bottom / yMax < start);
    });
  }, [textContent, start, end, view]);
  const result = useMemo(
    () =>
      filteredItems && textContent
        ? { items: filteredItems, styles: textContent.styles, lang: null }
        : null,
    [textContent, filteredItems],
  );
  return result;
};

type TextTransformTuple = [
  fontHeightPx: number,
  skewX: number,
  skewY: number,
  offsetY: number,
  x: number,
  y: number,
];
export type PdfViewTuple = [
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number,
];

interface TextElementProps {
  item: TextItem;
  // Style currently isn't used. Setting the font family breaks alignment
  styles: Record<string, TextStyle>;
  view: PdfViewTuple;
  scale: number;
}
const PdfTextElement: React.FC<TextElementProps> = ({ item, view, scale }) => {
  const [fontHeightPx, , , offsetY, x, y] =
    item.transform as TextTransformTuple;
  const [xMin, , , yMax] = view;
  const top = yMax - (y + offsetY);
  const left = x - xMin;
  const divRef = useCallback(
    (ref: HTMLDivElement | null) => {
      if (ref === null) return;
      const width = ref.clientWidth;
      const height = fontHeightPx;

      const targetWidth = item.width * scale;
      const targetHeight = item.height * scale;
      const xScale = targetWidth / width;
      const yScale = targetHeight / height;
      ref.style.transform = `scaleX(${xScale}) scaleY(${yScale})`;
    },
    [item, fontHeightPx, scale],
  );
  return (
    <div
      style={{
        position: "absolute",
        top: `${top * scale}px`,
        left: `${left * scale}px`,
        height: `${item.height * scale}px`,
        width: `${item.width * scale}px`,
        fontSize: `${fontHeightPx * scale}px`,
        overflow: "visible",
      }}
    >
      <p
        style={{
          transformOrigin: "left bottom",
          whiteSpace: "pre",
          margin: "0",
          display: "inline-block",
        }}
        ref={divRef}
      >
        {item.str}
      </p>
      <span> </span>
    </div>
  );
};
const defaultView: PdfViewTuple = [0, 0, 0, 0];
interface Props {
  page: number;
  start: number;
  end: number;
  renderer: PDF;
  view?: PdfViewTuple;
  scale: number;
  translateY: number;
}
const PdfSectionText: React.FC<Props> = React.memo(
  // eslint-disable-next-line prefer-arrow-callback
  function PdfSectionText({
    page,
    start,
    end,
    renderer,
    view,
    scale,
    translateY,
  }) {
    const textContent = useTextLayer(
      true,
      renderer,
      page,
      view ?? defaultView,
      start,
      end,
    );
    return (
      <div
        style={{
          transform: `translateY(-${translateY}px) scale(${scale})`,
          transformOrigin: "top left",
          display: view ? "block" : "none",
          color: "transparent",
          opacity: "0.7",
          position: "absolute",
          top: "0",
        }}
      >
        {textContent?.items.map((item, index) =>
          isPdfTextItem(item) ? (
            <PdfTextElement
              key={index}
              item={item}
              styles={textContent.styles}
              view={view ?? defaultView}
              scale={1.0}
            />
          ) : null,
        )}
      </div>
    );
  },
);
export default PdfSectionText;

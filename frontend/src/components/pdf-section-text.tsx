import { PdfSection } from "../interfaces";

import SVGRenderer from "../svg-render";
import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { TextContentItem, TextContent } from "pdfjs-dist";

const useTextLayer = (
  shouldRender: boolean,
  renderer: SVGRenderer,
  pageNumber: number,
  start: number,
  end: number,
): [boolean, TextContent | null] => {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [textContent, setTextContent] = useState<TextContent | null>(null);
  const render = useCallback(async () => {
    setLoading(true);
    const text = await renderer.renderText(pageNumber);
    setTextContent(text);
    setLoaded(true);
    setLoading(false);
  }, [renderer, pageNumber]);
  useEffect(() => {
    if (shouldRender && !loaded && !loading) {
      render();
    }
  }, [shouldRender, loaded, loading, render]);
  return [loading, textContent];
};

interface TextElementProps {
  item: TextContentItem;
  // tslint:disable-next-line: no-any
  styles: any;
  view: number[];
  scale: number;
}
const PdfTextElement: React.FC<TextElementProps> = ({
  item,
  styles,
  view,
  scale,
}) => {
  const [fontHeightPx, , , offsetY, x, y] = item.transform;
  const [xMin, , , yMax] = view;
  const top = yMax - (y + offsetY);
  const left = x - xMin;
  const style = styles[item.fontName] || {};
  const fontName = style.fontFamily || "";
  const fontFamily = `${fontName}, sans-serif`;
  const divRef = (ref: HTMLDivElement | null) => {
    if (ref === null) return;
    const [width, height] = [ref.clientWidth, ref.clientHeight];
    const targetWidth = item.width * scale;
    const targetHeight = item.height * scale;
    const xScale = targetWidth / width;
    const yScale = targetHeight / height;
    ref.style.transform = `scaleX(${xScale}) scaleY(${yScale})`;
  };
  return (
    <div
      style={{
        position: "absolute",
        top: `${top * scale}px`,
        left: `${left * scale}px`,
        fontSize: `${fontHeightPx * scale}px`,
        whiteSpace: "pre",
        fontFamily,
        color: "transparent",
        transformOrigin: "left bottom",
      }}
      ref={divRef}
    >
      {item.str}
    </div>
  );
};

interface Props {
  section: PdfSection;
  renderer: SVGRenderer;
  view?: number[];
  scale: number;
  translateY: number;
}
const PdfSectionText: React.FC<Props> = ({
  section,
  renderer,
  view,
  scale,
  translateY,
}) => {
  const pageNumber = section.start.page;
  const start = section.start.position;
  const end = section.end.position;
  const [, textContent] = useTextLayer(true, renderer, pageNumber, start, end);
  return (
    <div
      style={{
        position: "absolute",
        top: "0",
        left: "0",
        transform: `translateY(-${translateY}px) scale(${scale})`,
        transformOrigin: "top left",
        display: view ? "block" : "none",
      }}
    >
      {textContent &&
        textContent.items.map((item, index) => (
          <PdfTextElement
            key={index}
            item={item}
            styles={textContent.styles}
            view={view || [0, 0, 0, 0]}
            scale={1.0}
          />
        ))}
    </div>
  );
};
export default PdfSectionText;

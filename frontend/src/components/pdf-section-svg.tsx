import { PdfSection } from "../interfaces";
import SVGRenderer from "../svg-render";
import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { css } from "glamor";
import Colors from "../colors";
import { useInViewport } from "@umijs/hooks";

const styles = {
  pdfContainer: css({
    overflow: "hidden",
    background: "white",
    boxShadow: Colors.cardShadow,
  }),
  lastSection: css({
    marginBottom: "40px",
  }),
};

const usePdf = (
  shouldRender: boolean,
  renderer: SVGRenderer,
  pageNumber: number,
): [boolean, SVGElement | null, number, number] => {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [svgElement, setSvgElement] = useState<SVGElement | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const render = useCallback(async () => {
    setLoading(true);
    const page = await renderer.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    setWidth(viewport.width);
    setHeight(viewport.height);
    const pageSvg = await renderer.renderSvg(pageNumber, viewport);
    setLoading(false);
    setLoaded(true);
    setSvgElement(pageSvg);
  }, [renderer, pageNumber]);
  useEffect(() => {
    if (shouldRender && !loaded && !loading) {
      render();
    }
  }, [shouldRender, loaded, loading, render]);
  return [loading, svgElement, width, height];
};

interface Props {
  section: PdfSection;
  renderer: SVGRenderer;
  targetWidth: number;
}
const PdfSectionSvg: React.FC<Props> = ({ section, renderer, targetWidth }) => {
  const start = section.start.position;
  const end = section.end.position;
  const relativeHeight = end - start;
  const pageNumber = section.start.page;

  const [visible, containerElement] = useInViewport<HTMLDivElement>();
  const [containerHeight, setContainerHeight] = useState(
    targetWidth * relativeHeight * 1.414,
  );
  const [loading, svgElement, width, height] = usePdf(
    visible || false,
    renderer,
    pageNumber,
  );

  const svgMountingPoint = useCallback<(element: HTMLDivElement) => void>(
    element => {
      if (element === null) return;
      if (svgElement === null) return;
      while (element.firstChild) element.removeChild(element.firstChild);
      element.appendChild(svgElement);
    },
    [svgElement],
  );

  useEffect(() => {
    const scaling = targetWidth / width;
    const newWidth = width * scaling;
    const newHeight = height * scaling;
    setContainerHeight(relativeHeight * newHeight);
    if (svgElement === null) return;
    svgElement.setAttribute("width", `${newWidth}px`);
    svgElement.setAttribute("height", `${newHeight}px`);
    svgElement.style.transform = `translateY(-${start * newHeight}px)`;
  }, [targetWidth, svgElement, width, height]);

  let content: React.ReactNode;
  if (visible && svgElement) {
    content = <div ref={svgMountingPoint} />;
  } else if (loading) {
    content = <div></div>;
  } else {
    content = <div></div>;
  }

  return (
    <div
      style={{
        width: `${targetWidth}px`,
        height: `${containerHeight}px`,
      }}
      {...styles.pdfContainer}
      {...(end === 1 ? styles.lastSection : undefined)}
      ref={containerElement}
    >
      {content}
    </div>
  );
};
export default PdfSectionSvg;

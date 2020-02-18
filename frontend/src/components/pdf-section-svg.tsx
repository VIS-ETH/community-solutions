import { PdfSection } from "../interfaces";
import SVGRenderer from "../svg-render";
import * as React from "react";
import { useRef, useState, useCallback, useEffect } from "react";
import { css } from "glamor";
import Colors from "../colors";

interface Props {
  section: PdfSection;
  renderer: SVGRenderer;
  width: number;
}
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

const PdfSectionSvg: React.FC<Props> = ({ section, renderer, width }) => {
  const start = section.start.position;
  const end = section.end.position;
  const relativeHeight = end - start;
  const pageNumber = section.start.page;

  const svg = useRef<SVGElement | null>(null);
  const [rendered, setRendered] = useState(false);
  const rendering = useRef(false);
  const [containerHeight, setContainerHeight] = useState(100);

  const fixScale = useCallback(() => {
    if (svg.current === null) return;
    const svgWidth = parseInt(svg.current.getAttribute("width") || "0");
    const svgHeight = parseInt(svg.current.getAttribute("height") || "0");
    const scaling = width / svgWidth;
    const height = svgHeight * scaling;
    svg.current.setAttribute("width", `${width}px`);
    svg.current.setAttribute("height", `${height}px`);
    svg.current.style.transform = `translateY(-${start * height}px)`;
    setContainerHeight(relativeHeight * height);
  }, [width, section]);

  const svgMountingPoint = useCallback(
    element => {
      if (rendered) return;
      if (rendering.current) return;
      const render = async () => {
        rendering.current = true;
        const page = await renderer.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.0 });
        const pageSvg = await renderer.renderSvg(pageNumber, viewport);
        element.appendChild(pageSvg);
        svg.current = pageSvg;
        rendering.current = false;
        setRendered(true);
        fixScale();
      };
      render();
    },
    [section, renderer],
  );

  useEffect(() => {
    fixScale();
  }, [width]);
  return (
    <div
      style={{ width, height: `${containerHeight}px` }}
      {...styles.pdfContainer}
      {...(end === 1 ? styles.lastSection : undefined)}
    >
      <div ref={svgMountingPoint}></div>
    </div>
  );
};
export default PdfSectionSvg;

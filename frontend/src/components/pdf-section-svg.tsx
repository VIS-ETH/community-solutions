import React from "react";
import { ExamSVG } from "../pages/exam-page";
import { css } from "emotion";
import { useMemo, useState, useCallback } from "react";
import { Card } from "@vseth/components";

interface Props {
  name: string;
  examSVG: ExamSVG;
  page: number;
  start: number;
  end: number;
  onVisibleChange?: (newVisible: boolean) => void;
}
const lastSection = css`
  margin-bottom: 2rem;
`;
const PdfSectionSvg: React.FC<Props> = React.memo(
  ({ name, examSVG, page, start, end }) => {
    const width = examSVG.attributes.getNamedItem("width")!.value;
    const height = examSVG.attributes.getNamedItem("height")!.value;
    const viewBox = examSVG.attributes.getNamedItem("viewBox")!.value;
    const aspectRatio = parseInt(height) / parseInt(width);

    return (
      <Card
        style={{
          paddingTop: `${aspectRatio * (end - start) * 100}%`,
          width: "100%",
          overflow: "hidden",
        }}
        className={end === 1 ? lastSection : undefined}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            width: "100%",
            transform: `translateY(-${start * 100}%)`,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={width}
            height={height}
            style={{ width: "100%", height: "auto" }}
            viewBox={viewBox}
          >
            <use
              href={`#${name}-page${page - 1}`}
              x="0"
              y="0"
              width={width}
              height={height}
            />
          </svg>
        </div>
      </Card>
    );
  },
);
export default PdfSectionSvg;

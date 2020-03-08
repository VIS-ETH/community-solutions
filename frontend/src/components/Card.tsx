import * as React from "react";
import { css } from "glamor";
import { variable } from "./ThemeProvider";
const cardStyle = css({
  background: variable.cardBg.get,
  color: variable.textColor.get,
  borderRadius: "3px",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  boxShadow: "0 0.4rem 1.2rem rgba(0, 0, 0, 0.15)",
});
interface CardProps extends React.HTMLProps<HTMLDivElement> {
  onClick?: () => void;
}
export const Card: React.FC<CardProps> = ({ children, onClick, ...rest }) => {
  return (
    <div {...cardStyle} onClick={onClick} {...rest}>
      {children}
    </div>
  );
};

const cardHeaderStyle = css({
  padding: "0.9rem 1.25rem",
});
const cardHeadingStyle = css({
  fontSize: "1.125rem",
  marginBlockStart: "0.5em",
  marginBlockEnd: "0.3em",
});
interface CardHeaderProps {}
export const CardHeader: React.FC<CardHeaderProps> = ({ children }) => {
  return (
    <div {...cardHeaderStyle}>
      <h5 {...cardHeadingStyle}>{children}</h5>
    </div>
  );
};

const cardContentStyle = css({
  padding: "0.9rem 1.25rem",
});
interface CardContentProps {}
export const CardContent: React.FC<CardContentProps> = ({ children }) => {
  return <div {...cardContentStyle}>{children}</div>;
};

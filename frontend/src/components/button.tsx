import * as React from "react";
import { css } from "glamor";
import { variable } from "./ThemeProvider";
const secondaryButtonStyles = css({
  boxShadow: "0 0.125rem 0.376rem rgba(0, 0, 0, 0.2)",
  backgroundColor: variable.buttonBg.get,
  borderColor: variable.buttonBg.get,
  borderWidth: "2px",
  color: "#212529",
  lineHeight: 1.5,
  padding: "0.375rem 0.75rem",
  fontSize: "1.05rem",
  fontWeight: "500",
  "&:hover": {
    backgroundColor: variable.buttonBgHover.get,
    borderColor: variable.buttonBgHover.get,
  },
});
const blockButtonStyle = css({
  display: "block",
  width: "100%",
});
interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  block?: boolean;
}
const Button: React.FC<Props> = ({ children, block, ...rest }) => {
  return (
    <button
      {...secondaryButtonStyles}
      {...(block ? blockButtonStyle : {})}
      {...rest}
    >
      {children}
    </button>
  );
};
export default Button;

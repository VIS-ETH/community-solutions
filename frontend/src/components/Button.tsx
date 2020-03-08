import * as React from "react";
import { css } from "glamor";
const secondaryButtonStyles = css({
  boxShadow: "0 0.125rem 0.376rem rgba(0, 0, 0, 0.2)",
  backgroundColor: "#cbcbbb",
  borderColor: "#c0c0ac",
  color: "#212529",
  lineHeight: 1.5,
  padding: "0.375rem 0.75rem",
  fontSize: "1.05rem",
  fontWeight: "500",
});
interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {}
const Button: React.FC<Props> = ({ children, ...rest }) => {
  return (
    <button {...secondaryButtonStyles} {...rest}>
      {children}
    </button>
  );
};
export default Button;

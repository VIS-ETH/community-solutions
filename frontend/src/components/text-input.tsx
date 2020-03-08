import * as React from "react";
import { css } from "glamor";
const textInputStyles = css({
  boxShadow: "0 0.125rem 0.376rem rgba(0, 0, 0, 0.2)",
  backgroundColor: "rgba(28, 31, 33, 0.85)",
  borderColor: "#3f464a",
  borderWidth: "2px",
  color: "#d6dad1",
  lineHeight: 1.5,
  padding: "0.375rem 0.75rem",
  fontSize: "1.05rem",
  fontWeight: "500",
});
const blockTextInputStyle = css({
  display: "block",
  width: "100%",
});
interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  block?: boolean;
}
const TextInput: React.FC<Props> = ({ children, block, ...rest }) => {
  return (
    <input
      type="text"
      {...textInputStyles}
      {...(block ? blockTextInputStyle : {})}
      {...rest}
    />
  );
};
export default TextInput;

import * as React from "react";
import { css } from "glamor";
const style = css({
  padding: "0.5rem",
});
const PaddingWrapper: React.FC<{}> = ({ children }) => {
  return <div {...style}>{children}</div>;
};
export default PaddingWrapper;

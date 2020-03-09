import { css } from "glamor";
import * as React from "react";

const style = css({
  width: "100%",
  maxWidth: "900px",
  margin: "auto",
});
interface Props {
  maxWidth?: string;
}
const Container: React.FC<Props> = ({ children, maxWidth }) => {
  return (
    <div {...style} style={{ maxWidth }}>
      {children}
    </div>
  );
};
export default Container;

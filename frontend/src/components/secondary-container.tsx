import React from "react";
import { css } from "@emotion/css";
interface Props {
  className?: string;
}
const contentContainerBg = css`
  background-color: #fafafa;
`;
const ContentContainer: React.FC<React.PropsWithChildren<Props>> = ({ children, className }) => {
  return (
    <div
      className={`border-gray-300 border-top border-bottom py-5 px-0 ${contentContainerBg}${
        className ? ` ${className}` : ""
      }`}
    >
      {children}
    </div>
  );
};
export default ContentContainer;

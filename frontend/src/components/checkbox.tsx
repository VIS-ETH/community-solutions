import * as React from "react";
interface Props {
  value: boolean;
  indeterminate: boolean;
}
const Checkbox: React.FC<Props> = ({ value, indeterminate }) => {
  return (
    <input
      type="checkbox"
      checked={value}
      ref={el => el && (el.indeterminate = indeterminate)}
    />
  );
};
export default Checkbox;

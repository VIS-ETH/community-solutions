import { useState } from "react";

const useInitialState = <T>(prop: T) => {
  const [oldProp, setOldProp] = useState(prop);
  const [value, setValue] = useState(prop);

  if (!Object.is(oldProp, prop)) {
    setOldProp(prop);
    setValue(prop);
  }

  return [value, setValue] as const;
};
export default useInitialState;

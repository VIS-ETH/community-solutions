import { useEffect, useState } from "react";
const mql = window.matchMedia("(prefers-color-scheme: dark)");
const usePrefersDarkMode = () => {
  const [prefersDarkMode, setPrefersDarkMode] = useState(
    window.matchMedia && mql.matches,
  );
  useEffect(() => {
    const listener = () => {
      const darkMode = window.matchMedia && mql.matches;
      setPrefersDarkMode(darkMode);
    };
    mql.addListener(listener);
    return () => mql.removeListener(listener);
  }, []);
  return prefersDarkMode;
};
export default usePrefersDarkMode;

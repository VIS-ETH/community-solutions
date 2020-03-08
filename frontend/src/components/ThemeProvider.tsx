import React, { useState, useEffect } from "react";
import { css } from "glamor";
import usePrefersDarkMode from "../hooks/usePrefersDarkMode";
type Theme = "light" | "dark";

const v = (s: string) => ({
  name: s,
  get: `var(${s})`,
});

export const variable = {
  textColor: v("--text-color"),
  pageBg: v("--page-bg"),
  cardBg: v("--card-bg"),
  pdfFilter: v("--pdf-filter"),
  inputBg: v("--input-bg"),
  inputBorder: v("--input-border-color"),
};

const getStyle = (light: boolean) => ({
  [variable.textColor.name]: light ? "#000000" : "#d6dad1",
  [variable.pageBg.name]: light ? "#ffffff" : "#1c1f21",
  [variable.cardBg.name]: light ? "#ffffff" : "#282c2f",
  [variable.pdfFilter.name]: light ? "" : "invert(0.9)",
  [variable.inputBg.name]: light ? "#ffffff" : "rgba(28, 31, 33, 0.85)",
  [variable.inputBorder.name]: light ? "#cdd2d5" : "#3f464a",

  color: variable.textColor.get,
  backgroundColor: variable.pageBg.get,
});

const lightTheme = css(getStyle(true));
const darkTheme = css(getStyle(false));

const ThemeContext = React.createContext([
  "light" as Theme,
  ((_newTheme: Theme) => undefined) as (newTheme: Theme) => void,
]);
interface Props {}
export const ThemeProvider: React.FC<Props> = ({ children }) => {
  const prefersDarkMode = usePrefersDarkMode();
  const [theme, setTheme] = useState<Theme>(prefersDarkMode ? "dark" : "light");
  useEffect(() => {
    setTheme(prefersDarkMode ? "dark" : "light");
  }, [prefersDarkMode]);

  useEffect(() => {
    document.body.style.backgroundColor = getStyle(theme === "light")[
      variable.pageBg.name
    ];
  }, [theme]);
  return (
    <div {...(theme === "light" ? lightTheme : darkTheme)}>
      <ThemeContext.Provider value={[theme, setTheme]}>
        {children}
      </ThemeContext.Provider>
    </div>
  );
};

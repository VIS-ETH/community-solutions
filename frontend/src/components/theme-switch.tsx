import { useContext } from "react";
import { ThemeContext } from "./ThemeProvider";
import { Moon, Sun } from "react-feather";
import React from "react";

const ThemeSwitch: React.FC<{}> = () => {
  const [theme, setTheme] = useContext(ThemeContext);
  if (theme === "light") {
    return (
      <span onClick={_e => setTheme("dark")}>
        <Moon size={24} />
      </span>
    );
  } else {
    return (
      <span onClick={_e => setTheme("light")}>
        <Sun size={24} />
      </span>
    );
  }
};
export default ThemeSwitch;

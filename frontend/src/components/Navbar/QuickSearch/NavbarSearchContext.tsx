import { createContext, useContext } from "react";

export const NavbarSearchContext = createContext<{
  inlineQuery: string;
  setInlineQuery: (updater: string | ((prev: string) => string)) => void;
  clearInlineQuery: () => void;
}>({
  inlineQuery: "",
  setInlineQuery: () => {},
  clearInlineQuery: () => {},
});

export const useNavbarSearch = () => useContext(NavbarSearchContext);

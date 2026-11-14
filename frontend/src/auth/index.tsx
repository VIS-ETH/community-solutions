import { createContext, useContext } from "react";
import type { User } from "../api/model";

export const notLoggedIn: User = {
  loggedin: false,
  isAdmin: false,
  isCategoryAdmin: false,
  user: null,
};

// Dynamically add `isExpert` depending on source
type UserEnriched = User & {
  isExpert?: boolean;
};

export const UserContext = createContext<UserEnriched | undefined>(undefined);
export const useUser = () => useContext(UserContext);
export const SetUserContext = createContext<(user: User | undefined) => void>(
  () => {},
);
export const useSetUser = () => useContext(SetUserContext);

import React from "react";
import { IndexRouteProps, LayoutRouteProps, PathRouteProps, Route, RouteProps, Routes } from "react-router-dom";
import { useUser } from ".";
import LoadingOverlay from "../components/loading-overlay";
import LoginOverlay from "../pages/login-page";

export const UserContentWrapper = <T extends React.FC<{}>>({
  children,
  loginProps = {isHome: false},
}: React.PropsWithChildren<{
  loginProps?: Parameters<typeof LoginOverlay>[0];
}>) => {
  const user = useUser();

  if (user !== undefined && !user.loggedin) {
    return <LoginOverlay {...loginProps} />;
  } else {
    return (
      <>
        <LoadingOverlay loading={user === undefined} />
        {user !== undefined && children}
      </>
    );
  }
};

export default UserContentWrapper;

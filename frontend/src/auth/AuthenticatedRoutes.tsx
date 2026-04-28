import { useLocation, Outlet } from "react-router-dom";
import { useUser } from ".";
import LoadingOverlay from "../components/loading-overlay";
import { lazy, Suspense } from "react";
import { Loader } from "@mantine/core";

const LoginOverlay = lazy(() => import("../pages/login-page"));

export const AuthenticatedRoutes = () => {
  const user = useUser();
  const { pathname } = useLocation();

  if (user !== undefined && !user.loggedin) {
    return (
      <Suspense fallback={<Loader />}>
        <LoginOverlay isHome={pathname === "/"} />
      </Suspense>
    );
  } else {
    return (
      <>
        <LoadingOverlay visible={user === undefined} />
        {user !== undefined && <Outlet />}
      </>
    );
  }
};
export default AuthenticatedRoutes;

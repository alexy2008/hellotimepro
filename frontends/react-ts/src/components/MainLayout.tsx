import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";

export function MainLayout() {
  return (
    <>
      <AppHeader />
      <Outlet />
      <AppFooter />
    </>
  );
}

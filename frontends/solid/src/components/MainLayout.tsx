import type { JSX } from "solid-js";
import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";

export function MainLayout(props: { children?: JSX.Element }) {
  return (
    <>
      <AppHeader />
      {props.children}
      <AppFooter />
    </>
  );
}

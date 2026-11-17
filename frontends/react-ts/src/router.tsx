import type { ReactElement } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "@/app/Layout";
import { AuthGate } from "@/components/AuthGate";

import { PlazaPage } from "@/pages/PlazaPage";
import { OpenPage } from "@/pages/OpenPage";
import { AboutPage } from "@/pages/AboutPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { CreatePage } from "@/pages/CreatePage";
import { CapsuleByCodePage } from "@/pages/CapsuleByCodePage";
import { MeCreatedPage } from "@/pages/MeCreatedPage";
import { MeFavoritesPage } from "@/pages/MeFavoritesPage";
import { MeProfilePage } from "@/pages/MeProfilePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// 路由表与 docs/01-requirements.md §4.9 一致；详情页统一按胶囊码打开
const gated = (el: ReactElement) => <AuthGate>{el}</AuthGate>;

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <PlazaPage /> },
      { path: "/open", element: <OpenPage /> },
      { path: "/about", element: <AboutPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/create", element: gated(<CreatePage />) },
      { path: "/capsules/:code", element: <CapsuleByCodePage /> },
      { path: "/me", element: <Navigate to="/me/created" replace /> },
      { path: "/me/created", element: gated(<MeCreatedPage />) },
      { path: "/me/favorites", element: gated(<MeFavoritesPage />) },
      { path: "/me/profile", element: gated(<MeProfilePage />) },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

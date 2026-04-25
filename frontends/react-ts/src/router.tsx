import { createBrowserRouter, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { MeLayout } from "@/components/MeLayout";
import { AuthGate } from "@/components/AuthGate";

import { PlazaPage } from "@/pages/PlazaPage";
import { OpenPage } from "@/pages/OpenPage";
import { AboutPage } from "@/pages/AboutPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { CreatePage } from "@/pages/CreatePage";
import { CapsuleByCodePage } from "@/pages/CapsuleByCodePage";
import { CapsuleByIdPage } from "@/pages/CapsuleByIdPage";
import { MeCreatedPage } from "@/pages/MeCreatedPage";
import { MeFavoritesPage } from "@/pages/MeFavoritesPage";
import { MeProfilePage } from "@/pages/MeProfilePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: "/", element: <PlazaPage /> },
      { path: "/open", element: <OpenPage /> },
      { path: "/about", element: <AboutPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      {
        path: "/create",
        element: (
          <AuthGate>
            <CreatePage />
          </AuthGate>
        ),
      },
      { path: "/c/:code", element: <CapsuleByCodePage /> },
      { path: "/p/:id", element: <CapsuleByIdPage /> },
    ],
  },
  {
    element: (
      <AuthGate>
        <MeLayout />
      </AuthGate>
    ),
    children: [
      { path: "/me", element: <Navigate to="/me/created" replace /> },
      { path: "/me/created", element: <MeCreatedPage /> },
      { path: "/me/favorites", element: <MeFavoritesPage /> },
      { path: "/me/profile", element: <MeProfilePage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

import { type Routes } from '@angular/router';
import { authGuard } from '@/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@/components/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@/pages/plaza/plaza.component').then((m) => m.PlazaComponent),
      },
      {
        path: 'open',
        loadComponent: () =>
          import('@/pages/open/open.component').then((m) => m.OpenComponent),
      },
      {
        path: 'about',
        loadComponent: () =>
          import('@/pages/about/about.component').then((m) => m.AboutComponent),
      },
      {
        path: 'login',
        loadComponent: () =>
          import('@/pages/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('@/pages/register/register.component').then((m) => m.RegisterComponent),
      },
      {
        path: 'create',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@/pages/create/create.component').then((m) => m.CreateComponent),
      },
      {
        path: 'c/:code',
        loadComponent: () =>
          import('@/pages/capsule-by-code/capsule-by-code.component').then(
            (m) => m.CapsuleByCodeComponent,
          ),
      },
    ],
  },
  {
    path: 'me',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@/components/me-layout/me-layout.component').then((m) => m.MeLayoutComponent),
    children: [
      { path: '', redirectTo: 'created', pathMatch: 'full' },
      {
        path: 'created',
        loadComponent: () =>
          import('@/pages/me-created/me-created.component').then((m) => m.MeCreatedComponent),
      },
      {
        path: 'favorites',
        loadComponent: () =>
          import('@/pages/me-favorites/me-favorites.component').then(
            (m) => m.MeFavoritesComponent,
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('@/pages/me-profile/me-profile.component').then((m) => m.MeProfileComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('@/pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];

import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  if (!auth.hydrated()) return true; // 水合前放行，组件内自行等待

  if (auth.user() || auth.refreshToken()) return true;

  void router.navigate(['/login'], { state: { from: state.url } });
  return false;
};

// ============================================================
// 鉴权 Store（NgRx Signal Store）
// ============================================================

import { inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { ApiService } from '@/api/api.service';
import type { AuthTokens, User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
}

const STORAGE_KEY = 'hellotime.auth';

interface PersistShape {
  user: User | null;
  refreshToken: string | null;
}

function loadPersisted(): PersistShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistShape;
  } catch {
    return null;
  }
}

function persist(s: PersistShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* noop */ }
}

function clearPersisted() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    hydrated: false,
  }),
  withMethods((store) => {
    const api = inject(ApiService);
    return {
      hydrate() {
        const persisted = loadPersisted();
        patchState(store, {
          user: persisted?.user ?? null,
          refreshToken: persisted?.refreshToken ?? null,
          hydrated: true,
        });
      },
      setTokens(tokens: AuthTokens) {
        patchState(store, {
          user: tokens.user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });
        persist({ user: tokens.user, refreshToken: tokens.refreshToken });
      },
      patchTokens(accessToken: string, refreshToken: string) {
        patchState(store, { accessToken, refreshToken });
        persist({ user: store.user(), refreshToken });
      },
      async logout(callServer = true) {
        const rt = store.refreshToken();
        patchState(store, { user: null, accessToken: null, refreshToken: null });
        clearPersisted();
        if (callServer && rt) {
          try { await api.logout(rt); } catch { /* 静默 */ }
        }
      },
      async refreshMe() {
        try {
          const me = await api.me();
          patchState(store, { user: me });
          persist({ user: me, refreshToken: store.refreshToken() });
        } catch { /* token 失效由 401 路径接管 */ }
      },
    };
  }),
  withHooks((store) => {
    const api = inject(ApiService);
    return {
      onInit() {
        api.configure({
          getAccessToken: () => store.accessToken(),
          getRefreshToken: () => store.refreshToken(),
          onTokensRefreshed: (a, r) => {
            patchState(store, { accessToken: a, refreshToken: r });
            persist({ user: store.user(), refreshToken: r });
          },
          onAuthLost: () => {
            patchState(store, { user: null, accessToken: null, refreshToken: null });
            clearPersisted();
          },
        });
        store.hydrate();
      },
    };
  }),
);

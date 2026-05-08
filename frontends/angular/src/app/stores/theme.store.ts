import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

export type Theme = 'dark' | 'light';
const KEY = 'hellotime.theme';

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch { /* noop */ }
  return 'dark';
}

function apply(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(KEY, t); } catch { /* noop */ }
}

export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withState({ theme: 'dark' as Theme }),
  withMethods((store) => ({
    hydrate() {
      const t = read();
      apply(t);
      patchState(store, { theme: t });
    },
    toggle() {
      const next: Theme = store.theme() === 'dark' ? 'light' : 'dark';
      apply(next);
      patchState(store, { theme: next });
    },
    set(t: Theme) {
      apply(t);
      patchState(store, { theme: t });
    },
  })),
);

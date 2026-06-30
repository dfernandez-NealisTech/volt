import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
const KEY = 'volt-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.initial());

  private initial(): Theme {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch {
      /* ignore */
    }
    // Noir-first: dark unless the user has explicitly chosen light.
    return 'dark';
  }

  constructor() {
    this.apply(this.theme());
  }

  private apply(theme: Theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0a0b0d' : '#f3f4f1');
  }

  private commit(theme: Theme) {
    this.theme.set(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
    this.apply(theme);
  }

  /** Toggle with an electric-surge view transition originating at the click. */
  toggle(event?: MouseEvent) {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const startVT = (document as any).startViewTransition?.bind(document);
    if (!startVT || reduce) {
      this.commit(next);
      return;
    }

    if (event) {
      root.style.setProperty('--vt-x', `${(event.clientX / window.innerWidth) * 100}%`);
      root.style.setProperty('--vt-y', `${(event.clientY / window.innerHeight) * 100}%`);
    } else {
      root.style.setProperty('--vt-x', '50%');
      root.style.setProperty('--vt-y', '50%');
    }

    root.classList.add('theme-vt');
    const vt = startVT(() => this.commit(next));
    vt.finished.finally(() => root.classList.remove('theme-vt'));
  }
}

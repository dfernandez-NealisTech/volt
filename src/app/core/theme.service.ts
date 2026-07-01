import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
export type Palette = 'volt' | 'blue' | 'pastel' | 'fire';

const THEME_KEY = 'volt-theme';
const PALETTE_KEY = 'volt-palette';
const PALETTES: Palette[] = ['volt', 'blue', 'pastel', 'fire'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.initialTheme());
  readonly palette = signal<Palette>(this.initialPalette());

  private initialTheme(): Theme {
    try {
      const s = localStorage.getItem(THEME_KEY);
      if (s === 'dark' || s === 'light') return s;
    } catch {
      /* ignore */
    }
    // Noir-first: dark unless the user has explicitly chosen light.
    return 'dark';
  }

  private initialPalette(): Palette {
    try {
      const s = localStorage.getItem(PALETTE_KEY) as Palette;
      if (PALETTES.includes(s)) return s;
    } catch {
      /* ignore */
    }
    return 'volt';
  }

  constructor() {
    this.apply();
  }

  private apply() {
    const root = document.documentElement;
    root.setAttribute('data-theme', this.theme());
    root.setAttribute('data-palette', this.palette());
    // theme-color follows the resolved background of the active palette/mode
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  }

  /** Run a state change inside an electric-surge view transition (from click). */
  private surge(commit: () => void, event?: MouseEvent) {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startVT = (document as any).startViewTransition?.bind(document);
    if (!startVT || reduce) {
      commit();
      return;
    }
    root.style.setProperty('--vt-x', event ? `${(event.clientX / window.innerWidth) * 100}%` : '50%');
    root.style.setProperty('--vt-y', event ? `${(event.clientY / window.innerHeight) * 100}%` : '50%');
    root.classList.add('theme-vt');
    const vt = startVT(commit);
    vt.finished.finally(() => root.classList.remove('theme-vt'));
  }

  /** Toggle dark/light. */
  toggle(event?: MouseEvent) {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.surge(() => {
      this.theme.set(next);
      this.persist(THEME_KEY, next);
      this.apply();
    }, event);
  }

  /** Switch colour palette (volt / blue / pastel). */
  setPalette(p: Palette, event?: MouseEvent) {
    if (p === this.palette()) return;
    this.surge(() => {
      this.palette.set(p);
      this.persist(PALETTE_KEY, p);
      this.apply();
    }, event);
  }

  private persist(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }
}

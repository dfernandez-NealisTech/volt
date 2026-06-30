import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="toggle"
      [attr.aria-label]="theme.theme() === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'"
      (click)="theme.toggle($event)"
    >
      @if (theme.theme() === 'dark') {
        <!-- sun -->
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <g stroke-width="1.6" stroke-linecap="round">
            <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" />
          </g>
        </svg>
      } @else {
        <!-- moon -->
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z" />
        </svg>
      }
    </button>
  `,
  styles: [
    `
      .toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.3rem;
        height: 2.3rem;
        border: 1px solid var(--line-strong);
        background: transparent;
        color: var(--text-dim);
        cursor: pointer;
        transition: color 0.2s ease, border-color 0.2s ease, transform 0.12s ease;
      }
      .toggle:hover {
        color: var(--volt-ink);
        border-color: var(--volt);
      }
      .toggle:active {
        transform: scale(0.92);
      }
      svg circle,
      svg path {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.7;
      }
      svg circle {
        fill: currentColor;
        stroke: none;
      }
    `,
  ],
})
export class ThemeToggle {
  protected theme = inject(ThemeService);
}

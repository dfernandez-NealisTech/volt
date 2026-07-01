import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Palette, ThemeService } from '../core/theme.service';

/**
 * Palette selector as a row of per-theme icons (volt = bolt, blue = grid,
 * pastel = droplet). Only the active icon is coloured; hovering a non-active
 * one tints it with a variation of the current primary.
 */
@Component({
  selector: 'palette-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pp" role="group" aria-label="Tema de color">
      @for (p of palettes; track p.id) {
        <button
          type="button"
          class="pi"
          [class.on]="theme.palette() === p.id"
          [attr.aria-pressed]="theme.palette() === p.id"
          [title]="p.name"
          (click)="theme.setPalette(p.id, $event)"
        >
          @switch (p.id) {
            @case ('volt') {
              <svg viewBox="0 0 24 24" width="17" height="17"><path d="M13 2 L4 14 h6 l-1 8 9-12 h-6 z" /></svg>
            }
            @case ('blue') {
              <svg viewBox="0 0 24 24" width="17" height="17">
                <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1" />
                <rect x="13" y="3.5" width="7.5" height="7.5" rx="1" />
                <rect x="3.5" y="13" width="7.5" height="7.5" rx="1" />
                <rect x="13" y="13" width="7.5" height="7.5" rx="1" />
              </svg>
            }
            @case ('pastel') {
              <svg viewBox="0 0 24 24" width="17" height="17">
                <path d="M12 3.5 C12 3.5 5.5 11 5.5 15.5 A6.5 6.5 0 0 0 18.5 15.5 C18.5 11 12 3.5 12 3.5 Z" />
              </svg>
            }
            @case ('fire') {
              <svg viewBox="0 0 24 24" width="17" height="17">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.07-1.43-.22-3.08 1-4 .5 1.5 1.5 2 2.5 3 1.5 1.5 2 3 2 4.5a4.5 4.5 0 1 1-9 0c0-1.5.5-2.5 1.5-3.5z" />
              </svg>
            }
          }
        </button>
      }
    </div>
  `,
  styles: [
    `
      .pp {
        display: inline-flex;
        align-items: center;
        gap: 0.1rem;
      }
      .pi {
        width: 1.95rem;
        height: 2.3rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        color: var(--text-faint);
        border-radius: var(--radius);
        transition: color 0.18s ease, background 0.18s ease, transform 0.12s ease;
      }
      .pi:hover:not(.on) {
        color: var(--volt-ink);
        background: color-mix(in srgb, var(--volt) 10%, transparent);
      }
      .pi:active {
        transform: scale(0.88);
      }
      .pi.on {
        color: var(--volt);
      }
      .pi.on svg {
        filter: drop-shadow(0 0 5px var(--volt-glow));
      }
      .pi svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    `,
  ],
})
export class PalettePicker {
  protected theme = inject(ThemeService);
  protected palettes: { id: Palette; name: string }[] = [
    { id: 'volt', name: 'Volt' },
    { id: 'blue', name: 'Azul' },
    { id: 'pastel', name: 'Pastel' },
    { id: 'fire', name: 'Fuego' },
  ];
}

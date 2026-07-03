import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MultiDayClock } from './multi-day-clock';
import { AutoFill } from './auto-fill';

/**
 * Bulk clock-in page. Single-marcaje and full-day actions live in the week view
 * (dashboard) now, so this page is dedicated to filling empty days in bulk: a
 * manual day picker and a weekly-pattern auto-fill.
 */
@Component({
  selector: 'volt-fichar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MultiDayClock, AutoFill],
  template: `
    <header class="pagehead rise">
      <div>
        <p class="label">// Fichaje en bloque</p>
        <h1 class="title">Bulk</h1>
      </div>
    </header>

    <volt-multi-day-clock class="stack" />
    <volt-auto-fill class="stack" />
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .pagehead {
        margin-bottom: 1.8rem;
      }
      .title {
        font-size: clamp(1.8rem, 5vw, 2.6rem);
        font-weight: 600;
        letter-spacing: -0.02em;
        margin: 0.2rem 0 0;
        line-height: 1;
      }
      .stack {
        display: block;
      }
      .stack + .stack {
        margin-top: 1.4rem;
      }
    `,
  ],
})
export class FicharPage {}

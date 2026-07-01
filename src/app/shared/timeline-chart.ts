import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  input,
  signal,
} from '@angular/core';
import { Marcaje } from '../core/models';
import { formatDuration } from '../core/date-utils';
import {
  AXIS_END_H,
  AXIS_START_H,
  axisHours,
  buildWeekModel,
} from '../core/week-data';

/** Bespoke noir/volt weekly timeline. Bars "charge up" on render. */
@Component({
  selector: 'volt-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" [class.is-loading]="loading()">
      <!-- hour axis -->
      <div class="grid-row axis label">
        <span></span>
        <div class="track">
          @for (h of hours; track h) {
            <span class="tick" [style.left.%]="hourPct(h)">{{ pad(h) }}</span>
          }
        </div>
        <span></span>
      </div>

      <!-- day rows -->
      @for (day of model().days; track day.short; let i = $index) {
        <div class="grid-row day" [class.today]="day.isToday">
          <div class="daylabel">
            <span class="dn">{{ day.short }}</span>
            <span class="dd">{{ day.date.getDate() }}</span>
          </div>

          <div class="track">
            <!-- gridlines -->
            @for (h of hours; track h) {
              <span class="gl" [style.left.%]="hourPct(h)"></span>
            }

            @if (day.isToday && nowPct() !== null) {
              <span class="nowline" [style.left.%]="nowPct()"></span>
            }

            @for (iv of day.intervals; track $index; let j = $index) {
              <div
                class="bar"
                [class.open]="iv.open"
                [style.left.%]="iv.leftPct"
                [style.width.%]="iv.widthPct"
                [style.animation-delay.ms]="120 + i * 40 + j * 80"
                [title]="iv.label"
              >
                <span class="bartext">{{ iv.label }}</span>
              </div>
            }
          </div>

          <div class="total" [class.zero]="day.totalMs === 0">
            {{ day.totalMs > 0 ? fmt(day.totalMs) : '—' }}
          </div>
        </div>
      }

      @if (loading()) {
        <div class="loader"><span class="charging"></span></div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .chart {
        position: relative;
        transition: opacity 0.25s ease, filter 0.25s ease;
      }
      .chart.is-loading {
        opacity: 0.4;
        filter: saturate(0.4);
      }
      .grid-row {
        display: grid;
        grid-template-columns: 3.1rem 1fr 4.3rem;
        align-items: center;
        gap: 0.4rem;
      }
      .axis {
        height: 1.4rem;
        margin-bottom: 0.2rem;
      }
      .axis .track {
        position: relative;
        height: 100%;
      }
      .tick {
        position: absolute;
        top: 0;
        transform: translateX(-50%);
        font-family: var(--font-mono);
        font-size: 0.6rem;
        color: var(--text-faint);
        letter-spacing: 0.04em;
      }
      .day {
        height: 2.5rem;
        border-top: 1px solid var(--line);
      }
      .day:last-child {
        border-bottom: 1px solid var(--line);
      }
      .day.today {
        background: color-mix(in srgb, var(--volt) 5%, transparent);
      }
      .daylabel {
        display: flex;
        align-items: baseline;
        gap: 0.35rem;
        font-family: var(--font-mono);
      }
      .dn {
        font-size: 0.64rem;
        letter-spacing: 0.1em;
        color: var(--text-dim);
      }
      .today .dn {
        color: var(--volt-ink);
      }
      .dd {
        font-size: 0.78rem;
        color: var(--text-faint);
      }
      .track {
        position: relative;
        height: 100%;
      }
      .gl {
        position: absolute;
        top: 18%;
        bottom: 18%;
        width: 1px;
        background: var(--line);
        opacity: 0.5;
      }
      .nowline {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1px;
        background: var(--volt);
        box-shadow: 0 0 8px var(--volt-glow);
        z-index: 3;
      }
      .nowline::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        width: 5px;
        height: 5px;
        background: var(--volt);
        border-radius: 50%;
      }
      .bar {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        height: 1rem;
        min-width: 2px;
        background: var(--volt);
        z-index: 2;
        overflow: visible;
        border-radius: var(--radius);
        animation: charge 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        transform-origin: left center;
      }
      .bar.open {
        background: repeating-linear-gradient(
          90deg,
          var(--cyan) 0 7px,
          transparent 7px 12px
        );
        border-right: 2px solid var(--cyan);
        animation: charge 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both,
          breathe 1.8s ease-in-out 0.6s infinite;
      }
      .bartext {
        position: absolute;
        left: calc(100% + 0.4rem);
        top: 50%;
        transform: translateY(-50%);
        white-space: nowrap;
        font-family: var(--font-mono);
        font-size: 0.6rem;
        color: var(--text-faint);
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
      }
      .bar:hover .bartext {
        opacity: 1;
        color: var(--volt-ink);
      }
      .total {
        text-align: right;
        font-family: var(--font-mono);
        font-size: 0.74rem;
        color: var(--text);
      }
      .total.zero {
        color: var(--text-faint);
      }
      .loader {
        position: absolute;
        left: 3.1rem;
        right: 4.3rem;
        top: 1.6rem;
        height: 2px;
        overflow: hidden;
      }
      .loader .charging {
        display: block;
        height: 100%;
      }
      @keyframes charge {
        from {
          width: 0;
          opacity: 0;
        }
      }
      @keyframes breathe {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.55;
        }
      }

      /* ---- FIRE theme: bars glow like heated embers ---- */
      :host-context([data-palette='fire']) .bar {
        background: linear-gradient(
          90deg,
          #c2340a 0%,
          var(--volt) 55%,
          var(--cyan) 100%
        );
        box-shadow: 0 0 10px -2px var(--volt-glow),
          inset 0 0 4px rgba(255, 220, 150, 0.28);
      }
      :host-context([data-palette='fire']) .bar.open {
        background: repeating-linear-gradient(
          90deg,
          var(--cyan) 0 7px,
          transparent 7px 12px
        );
        box-shadow: 0 0 12px -1px var(--volt-glow);
      }
    `,
  ],
})
export class VoltTimeline implements OnDestroy {
  readonly data = input<Marcaje[]>([]);
  readonly baseDate = input<Date>(new Date());
  readonly loading = input(false);

  protected hours = axisHours();
  private nowTick = signal(Date.now());
  private timer = setInterval(() => this.nowTick.set(Date.now()), 30_000);

  protected model = computed(() =>
    buildWeekModel(this.data(), this.baseDate(), new Date(this.nowTick())),
  );

  /** % position of `now` within the axis if today falls in view, else null. */
  protected nowPct = computed(() => {
    const now = new Date(this.nowTick());
    const ms = now.getHours() * 3600e3 + now.getMinutes() * 60e3;
    const start = AXIS_START_H * 3600e3;
    const span = (AXIS_END_H - AXIS_START_H) * 3600e3;
    const p = ((ms - start) / span) * 100;
    return p >= 0 && p <= 100 ? p : null;
  });

  protected hourPct(h: number): number {
    return ((h - AXIS_START_H) / (AXIS_END_H - AXIS_START_H)) * 100;
  }
  protected pad(h: number): string {
    return h.toString().padStart(2, '0');
  }
  protected fmt(ms: number): string {
    return formatDuration(ms);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}

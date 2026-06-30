import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { localDateString } from '../core/date-utils';

interface Cell {
  i: number;
  day: number;
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const pad2 = (n: number) => n.toString().padStart(2, '0');

/**
 * Custom noir/volt date (or date+time) picker. Two-way bind via `value`:
 *   - mode date:     "YYYY-MM-DD"
 *   - withTime=true: "YYYY-MM-DDTHH:mm"
 * so it drops into the same spots as a native <input type="date|datetime-local">.
 * Closes on outside click or Escape.
 */
@Component({
  selector: 'volt-datepicker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dp">
      <button
        type="button"
        class="trigger"
        [class.active]="open()"
        [class.empty]="!value()"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
      >
        <span class="val mono">{{ display() }}</span>
        <span class="cal" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <rect x="3.5" y="5" width="17" height="16" rx="1" />
            <path d="M3.5 9.5h17M8 3v4M16 3v4" />
          </svg>
        </span>
      </button>

      @if (open()) {
        <div class="pop" [class.up]="dropUp()" role="dialog" aria-label="Calendario">
          <div class="pop-head">
            <button type="button" class="nav" (click)="shiftMonth(-1)" aria-label="Mes anterior">‹</button>
            <span class="my">{{ monthLabel() }}</span>
            <button type="button" class="nav" (click)="shiftMonth(1)" aria-label="Mes siguiente">›</button>
          </div>
          <div class="divider"></div>

          <div class="dow">
            @for (d of dows; track $index) {
              <span>{{ d }}</span>
            }
          </div>

          <div class="grid">
            @for (c of cells(); track c.key) {
              <button
                type="button"
                class="cell"
                [class.out]="!c.inMonth"
                [class.today]="c.isToday"
                [class.sel]="c.isSelected"
                [style.animation-delay.ms]="c.i * 7"
                (click)="pick(c.date)"
              >
                {{ c.day }}
              </button>
            }
          </div>

          @if (withTime()) {
            <div class="time-row">
              <span class="time-lbl label">Hora</span>
              <div class="clock">
                <div class="stepper">
                  <button type="button" (click)="bumpHour(1)" aria-label="Hora +">▲</button>
                  <span class="tv mono">{{ pad(timeH()) }}</span>
                  <button type="button" (click)="bumpHour(-1)" aria-label="Hora −">▼</button>
                </div>
                <span class="colon mono">:</span>
                <div class="stepper">
                  <button type="button" (click)="bumpMin(1)" aria-label="Minuto +">▲</button>
                  <span class="tv mono">{{ pad(timeM()) }}</span>
                  <button type="button" (click)="bumpMin(-1)" aria-label="Minuto −">▼</button>
                </div>
              </div>
            </div>
          }

          <div class="pop-foot">
            <button type="button" class="today-btn" (click)="pickToday()">Ahora</button>
            @if (withTime()) {
              <button type="button" class="done-btn" (click)="close()">Listo</button>
            } @else {
              <span class="sel-label mono">{{ display() }}</span>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .dp {
        position: relative;
      }

      /* trigger */
      .trigger {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
        background: var(--bg);
        border: 1px solid var(--line-strong);
        color: var(--text);
        padding: 0.7rem 0.85rem;
        cursor: pointer;
        transition: border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
      }
      .trigger:hover {
        border-color: var(--volt);
      }
      .trigger.active {
        border-color: var(--volt);
        box-shadow: 0 0 0 1px var(--volt), 0 0 22px -6px var(--volt-glow);
      }
      .trigger.empty .val {
        color: var(--text-faint);
      }
      .val {
        font-family: var(--font-mono);
        font-size: 0.86rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cal {
        display: inline-flex;
        color: var(--text-dim);
        flex-shrink: 0;
      }
      .trigger:hover .cal,
      .trigger.active .cal {
        color: var(--volt-ink);
      }
      .cal svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      /* popover */
      .pop {
        position: absolute;
        z-index: 1001;
        top: calc(100% + 8px);
        right: 0;
        width: 17.5rem;
        max-width: 86vw;
        padding: 0.9rem;
        background: var(--bg-3);
        border: 1px solid var(--line-strong);
        box-shadow: 0 20px 50px -18px rgba(0, 0, 0, 0.7), 0 0 0 1px var(--line);
        transform-origin: top right;
        animation: dp-in 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .pop.up {
        top: auto;
        bottom: calc(100% + 8px);
        transform-origin: bottom right;
        animation: dp-in-up 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .pop::before {
        content: '';
        position: absolute;
        top: -1px;
        left: -1px;
        width: 11px;
        height: 11px;
        border-top: 1px solid var(--volt);
        border-left: 1px solid var(--volt);
      }
      .pop.up::before {
        top: auto;
        bottom: -1px;
        border-top: none;
        border-bottom: 1px solid var(--volt);
      }
      .pop-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
      }
      .my {
        font-family: var(--font-mono);
        font-size: 0.74rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text);
      }
      .nav {
        width: 1.9rem;
        height: 1.9rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 1px solid var(--line-strong);
        color: var(--text-dim);
        font-size: 1rem;
        cursor: pointer;
        transition: color 0.16s ease, border-color 0.16s ease;
      }
      .nav:hover {
        color: var(--volt-ink);
        border-color: var(--volt);
      }
      .divider {
        margin: 0.7rem 0 0.6rem;
      }
      .dow {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
        margin-bottom: 0.3rem;
      }
      .dow span {
        text-align: center;
        font-family: var(--font-mono);
        font-size: 0.58rem;
        letter-spacing: 0.05em;
        color: var(--text-faint);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
      }
      .cell {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 1px solid transparent;
        color: var(--text);
        font-family: var(--font-mono);
        font-size: 0.78rem;
        cursor: pointer;
        transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease;
        animation: cell-in 0.22s ease both;
      }
      .cell:hover {
        background: color-mix(in srgb, var(--volt) 14%, transparent);
        color: var(--volt-ink);
      }
      .cell.out {
        color: var(--text-faint);
        opacity: 0.45;
      }
      .cell.today {
        border-color: var(--line-strong);
        color: var(--volt-ink);
      }
      .cell.sel {
        background: var(--volt);
        color: var(--on-volt);
        border-color: var(--volt);
        box-shadow: 0 0 16px -2px var(--volt-glow);
      }
      .cell.sel:hover {
        color: var(--on-volt);
      }

      /* time stepper */
      .time-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 0.9rem;
        padding-top: 0.8rem;
        border-top: 1px solid var(--line);
      }
      .time-lbl {
        margin: 0;
      }
      .clock {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .stepper {
        display: flex;
        flex-direction: column;
        align-items: center;
        border: 1px solid var(--line-strong);
      }
      .stepper button {
        width: 2.6rem;
        height: 1.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: var(--text-faint);
        font-size: 0.55rem;
        cursor: pointer;
        transition: color 0.14s ease, background 0.14s ease;
      }
      .stepper button:hover {
        color: var(--on-volt);
        background: var(--volt);
      }
      .tv {
        font-size: 1.05rem;
        color: var(--volt-ink);
        padding: 0.15rem 0;
        border-block: 1px solid var(--line);
        width: 100%;
        text-align: center;
      }
      .colon {
        font-size: 1.05rem;
        color: var(--text-dim);
      }

      /* footer */
      .pop-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 0.8rem;
        padding-top: 0.7rem;
        border-top: 1px solid var(--line);
      }
      .today-btn,
      .done-btn {
        background: transparent;
        border: 1px solid var(--line-strong);
        color: var(--text-dim);
        font-family: var(--font-mono);
        font-size: 0.62rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        padding: 0.4rem 0.8rem;
        cursor: pointer;
        transition: color 0.16s ease, border-color 0.16s ease, background 0.16s ease;
      }
      .today-btn:hover {
        color: var(--volt-ink);
        border-color: var(--volt);
      }
      .done-btn {
        background: var(--volt);
        border-color: var(--volt);
        color: var(--on-volt);
      }
      .done-btn:hover {
        box-shadow: 0 0 18px -4px var(--volt-glow);
      }
      .sel-label {
        font-family: var(--font-mono);
        font-size: 0.62rem;
        color: var(--text-faint);
      }

      @keyframes dp-in {
        from {
          opacity: 0;
          transform: translateY(-6px) scale(0.97);
        }
      }
      @keyframes dp-in-up {
        from {
          opacity: 0;
          transform: translateY(6px) scale(0.97);
        }
      }
      @keyframes cell-in {
        from {
          opacity: 0;
          transform: scale(0.85);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .pop,
        .cell {
          animation: none;
        }
      }
    `,
  ],
})
export class VoltDatepicker {
  readonly value = model<string>(''); // "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm"
  readonly withTime = input(false);
  readonly placeholder = input('Selecciona fecha');

  private host = inject(ElementRef<HTMLElement>);

  protected open = signal(false);
  protected dropUp = signal(false);
  protected dows = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  protected viewDate = signal<Date>(this.startOfMonth(new Date()));
  protected timeH = signal(new Date().getHours());
  protected timeM = signal(new Date().getMinutes());

  private startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  protected selectedDate = computed(() => {
    const v = this.value();
    if (!v) return null;
    const [y, m, d] = v.split('T')[0].split('-').map(Number);
    return y ? new Date(y, m - 1, d) : null;
  });

  protected display = computed(() => {
    const v = this.value();
    const d = this.selectedDate();
    if (!d) return this.placeholder();
    let s = d.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (this.withTime()) {
      const t = v.split('T')[1]?.slice(0, 5);
      if (t) s += ` · ${t}`;
    }
    return s;
  });

  protected monthLabel = computed(() => {
    const v = this.viewDate();
    const m = MONTHS[v.getMonth()];
    return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${v.getFullYear()}`;
  });

  protected cells = computed<Cell[]>(() => {
    const view = this.viewDate();
    const year = view.getFullYear();
    const month = view.getMonth();
    const startDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
    const start = new Date(year, month, 1 - startDow);

    const sel = this.selectedDate();
    const today = new Date();

    const out: Cell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      out.push({
        i,
        day: date.getDate(),
        date,
        key: localDateString(date),
        inMonth: date.getMonth() === month,
        isToday: this.sameDay(date, today),
        isSelected: sel ? this.sameDay(date, sel) : false,
      });
    }
    return out;
  });

  private sameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private compose(date: Date): string {
    const ds = localDateString(date);
    return this.withTime() ? `${ds}T${pad2(this.timeH())}:${pad2(this.timeM())}` : ds;
  }

  protected toggle() {
    if (this.open()) {
      this.close();
      return;
    }
    const sel = this.selectedDate();
    this.viewDate.set(this.startOfMonth(sel ?? new Date()));
    // sync time steppers from the current value
    const v = this.value();
    if (this.withTime() && v.includes('T')) {
      const [h, m] = v.split('T')[1].split(':').map(Number);
      this.timeH.set(Number.isFinite(h) ? h : 0);
      this.timeM.set(Number.isFinite(m) ? m : 0);
    }
    // open upward if there isn't room below for the calendar
    const needed = this.withTime() ? 430 : 360;
    const rect = this.host.nativeElement.getBoundingClientRect();
    this.dropUp.set(window.innerHeight - rect.bottom < needed && rect.top > needed);
    this.open.set(true);
  }
  protected close() {
    this.open.set(false);
  }

  protected shiftMonth(dir: number) {
    this.viewDate.update((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  }

  protected pick(date: Date) {
    this.value.set(this.compose(date));
    if (!this.withTime()) this.close(); // date-only: commit & close
  }
  protected pickToday() {
    const now = new Date();
    if (this.withTime()) {
      this.timeH.set(now.getHours());
      this.timeM.set(now.getMinutes());
    }
    this.value.set(this.compose(now));
    this.viewDate.set(this.startOfMonth(now));
    if (!this.withTime()) this.close();
  }

  private commitTime() {
    this.value.set(this.compose(this.selectedDate() ?? new Date()));
  }
  protected bumpHour(d: number) {
    this.timeH.update((h) => (h + d + 24) % 24);
    this.commitTime();
  }
  protected bumpMin(d: number) {
    this.timeM.update((m) => (m + d + 60) % 60);
    this.commitTime();
  }

  protected pad(n: number) {
    return pad2(n);
  }

  @HostListener('document:click', ['$event'])
  protected onDocClick(e: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  protected onEsc() {
    if (this.open()) this.close();
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarcajesService } from '../../core/marcajes.service';
import { ToastService } from '../../core/toast.service';
import { SettingsService } from '../../core/settings.service';
import { BulkClockService } from '../../core/bulk-clock.service';
import { localDateString } from '../../core/date-utils';

type Group = 'weekday' | 'friday' | 'weekend';
type Pattern = Record<Group, string>; // '' => skip that group

interface Target {
  day: string;
  scheduleKey: string;
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Fill a whole month at once from a weekly pattern: pick which schedule each
 * kind of day uses (Mon–Thu / Friday / weekend), and every empty workday of the
 * chosen month up to today is clocked accordingly. Skips days that already have
 * marcajes and future days.
 */
@Component({
  selector: 'volt-auto-fill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="panel ticked card rise" style="animation-delay:.12s">
      <div class="cardhead">
        <span class="num">02</span>
        <div>
          <h2>Auto-rellenar</h2>
          <p class="label">El mes entero según un patrón semanal</p>
        </div>
      </div>
      <div class="divider"></div>

      @if (schedules().length === 0) {
        <p class="noned">No hay horarios. <a routerLink="/ajustes">Crea uno en Ajustes</a>.</p>
      } @else {
        <div class="monthnav">
          <button type="button" class="nav" (click)="shiftMonth(-1)" aria-label="Mes anterior">‹</button>
          <span class="my">{{ monthLabel() }}</span>
          <button type="button" class="nav" [disabled]="!canNext()" (click)="shiftMonth(1)" aria-label="Mes siguiente">›</button>
        </div>

        <div class="pattern">
          @for (g of groups; track g.key) {
            <div class="prow">
              <span class="pd">{{ g.label }}</span>
              <select
                class="field"
                [value]="pattern()[g.key]"
                (change)="setGroup(g.key, $any($event.target).value)"
              >
                <option value="">— Ninguno —</option>
                @for (h of schedules(); track h.key) {
                  <option [value]="h.key">{{ h.label }}</option>
                }
              </select>
            </div>
          }
        </div>

        <p class="preview">
          @if (targets().length) {
            Rellenará <b>{{ targets().length }}</b>
            {{ targets().length === 1 ? 'día vacío' : 'días vacíos' }} de {{ monthLabel() }}
            · ≈ {{ marcajeCount() }} marcajes
          } @else {
            No hay días vacíos que rellenar en {{ monthLabel() }} con este patrón
          }
        </p>

        <button
          type="button"
          class="btn btn-volt fill"
          [disabled]="busy() || targets().length === 0"
          (click)="fill()"
        >
          @if (busy()) {
            <span class="dots"><i></i><i></i><i></i></span><span>{{ progress() }}</span>
          } @else {
            <span>Auto-rellenar {{ monthLabel() }}</span>
          }
        </button>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .card {
        padding: 1.6rem 1.6rem 1.7rem;
      }
      .cardhead {
        display: flex;
        align-items: center;
        gap: 0.9rem;
      }
      .num {
        font-family: var(--font-mono);
        font-size: 1.05rem;
        color: var(--volt-ink);
        border: 1px solid var(--line-strong);
        padding: 0.35rem 0.55rem;
        line-height: 1;
      }
      h2 {
        font-size: 1.15rem;
        font-weight: 600;
        margin: 0;
      }
      .cardhead .label {
        margin: 0.2rem 0 0;
      }
      .divider {
        margin: 1.2rem 0 1.4rem;
      }
      .noned {
        font-family: var(--font-mono);
        font-size: 0.72rem;
        color: var(--text-faint);
        margin: 0;
      }
      .noned a {
        color: var(--volt-ink);
        text-decoration: none;
      }

      .monthnav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.2rem;
      }
      .my {
        font-family: var(--font-mono);
        font-size: 0.82rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text);
      }
      .nav {
        width: 2rem;
        height: 2rem;
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
      .nav:hover:not(:disabled) {
        color: var(--volt-ink);
        border-color: var(--volt);
      }
      .nav:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }

      .pattern {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }
      .prow {
        display: grid;
        grid-template-columns: 6.5rem 1fr;
        align-items: center;
        gap: 0.8rem;
      }
      .pd {
        font-family: var(--font-mono);
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-dim);
      }
      .field {
        font-size: 0.82rem;
        padding: 0.55rem 0.75rem;
      }

      .preview {
        margin: 1.2rem 0 0;
        font-family: var(--font-mono);
        font-size: 0.68rem;
        line-height: 1.5;
        color: var(--text-faint);
      }
      .preview b {
        color: var(--volt-ink);
        font-weight: 600;
      }
      .fill {
        width: 100%;
        margin-top: 1rem;
      }
      .dots {
        display: inline-flex;
        gap: 3px;
      }
      .dots i {
        width: 4px;
        height: 4px;
        background: currentColor;
        border-radius: 50%;
        animation: blink 1s infinite;
      }
      .dots i:nth-child(2) { animation-delay: 0.15s; }
      .dots i:nth-child(3) { animation-delay: 0.3s; }
      @keyframes blink {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
      }
    `,
  ],
})
export class AutoFill {
  private api = inject(MarcajesService);
  private toasts = inject(ToastService);
  private settings = inject(SettingsService);
  private bulk = inject(BulkClockService);

  protected schedules = this.settings.schedules;

  protected groups: { key: Group; label: string }[] = [
    { key: 'weekday', label: 'Lun – Jue' },
    { key: 'friday', label: 'Viernes' },
    { key: 'weekend', label: 'Sáb / Dom' },
  ];

  protected viewDate = signal<Date>(this.startOfMonth(new Date()));
  protected busy = signal(false);
  protected progress = signal('');

  private patternOverride = signal<Partial<Pattern>>({});

  constructor() {
    this.bulk.ensureLoaded();
  }

  /** Effective pattern: user choice when valid, else sensible defaults. */
  protected pattern = computed<Pattern>(() => {
    const list = this.schedules();
    const has = (k: string) => !!k && list.some((h) => h.key === k);
    const first = list[0]?.key ?? '';
    const viernes = list.find((h) => /vier|verano/i.test(h.key + h.label))?.key ?? first;
    const ov = this.patternOverride();

    const resolve = (g: Group, fallback: string) =>
      g in ov ? (has(ov[g] as string) || ov[g] === '' ? (ov[g] as string) : fallback) : fallback;

    return {
      weekday: resolve('weekday', first),
      friday: resolve('friday', viernes),
      weekend: resolve('weekend', ''),
    };
  });

  protected monthLabel = computed(() => {
    const v = this.viewDate();
    const m = MONTHS[v.getMonth()];
    return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${v.getFullYear()}`;
  });

  /** Can't step forward past the current month (no clocking the future). */
  protected canNext = computed(() => {
    const v = this.viewDate();
    const now = this.startOfMonth(new Date());
    return v.getFullYear() < now.getFullYear() ||
      (v.getFullYear() === now.getFullYear() && v.getMonth() < now.getMonth());
  });

  /** Empty, past-or-today days of the viewed month matched to their schedule. */
  protected targets = computed<Target[]>(() => {
    const pattern = this.pattern();
    const marked = this.bulk.markedDays();
    const view = this.viewDate();
    const year = view.getFullYear();
    const month = view.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const out: Target[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      if (date.getTime() > today.getTime()) break;
      const key = localDateString(date);
      if (marked.has(key)) continue;
      const scheduleKey = this.scheduleForDay(date.getDay(), pattern);
      if (!scheduleKey) continue;
      out.push({ day: key, scheduleKey });
    }
    return out;
  });

  /** Approx marcajes to be posted (sum of each target schedule's marcaje count). */
  protected marcajeCount = computed(() =>
    this.targets().reduce((sum, t) => {
      const sched = this.settings.getSchedule(t.scheduleKey);
      return sum + (sched?.marcajes.length ?? 0);
    }, 0),
  );

  private scheduleForDay(jsDay: number, pattern: Pattern): string {
    if (jsDay === 0 || jsDay === 6) return pattern.weekend;
    if (jsDay === 5) return pattern.friday;
    return pattern.weekday;
  }

  private startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  protected shiftMonth(dir: number) {
    if (dir > 0 && !this.canNext()) return;
    this.viewDate.update((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  }

  protected setGroup(g: Group, value: string) {
    this.patternOverride.update((p) => ({ ...p, [g]: value }));
  }

  protected async fill() {
    if (this.busy()) return;
    const items = this.targets();
    if (!items.length) {
      this.toasts.error('No hay días vacíos que rellenar con este patrón');
      return;
    }

    this.busy.set(true);
    let doneDays = 0;
    let totalMarcajes = 0;
    try {
      for (const { day, scheduleKey } of items) {
        this.progress.set(`Día ${doneDays + 1} / ${items.length}`);
        const list = this.api.buildDay(day, scheduleKey);
        await this.api.postSequential(list);
        doneDays++;
        totalMarcajes += list.length;
      }
      this.toasts.success(
        `${doneDays} ${doneDays === 1 ? 'día fichado' : 'días fichados'} · ${totalMarcajes} marcajes`,
      );
    } catch (err) {
      this.toasts.error(`${(err as Error).message} · ${doneDays}/${items.length} días completados`);
    } finally {
      this.busy.set(false);
      this.progress.set('');
      await this.bulk.reload();
    }
  }
}

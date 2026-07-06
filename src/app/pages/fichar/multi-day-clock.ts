import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarcajesService } from '../../core/marcajes.service';
import { ToastService } from '../../core/toast.service';
import { SettingsService } from '../../core/settings.service';
import { BulkClockService } from '../../core/bulk-clock.service';
import { Horario } from '../../core/config';
import { totalRange } from '../../core/schedule-math';
import { formatDuration, localDateString } from '../../core/date-utils';

interface DayCell {
  i: number;
  day: number;
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
  hasMarcajes: boolean;
  isFuture: boolean;
  selected: boolean;
  disabled: boolean;
  title: string;
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * "Option 3" of the Fichar page: clock several days at once. A month calendar
 * shows which days already have marcajes (disabled) versus which are free
 * (selectable). The user multi-selects free days, picks a schedule, and every
 * selected day is filled with that schedule's marcajes on submit.
 */
@Component({
  selector: 'volt-multi-day-clock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="panel ticked card rise mday" style="animation-delay:.05s">
      <div class="cardhead">
        <span class="num">01</span>
        <div>
          <h2>Varios días</h2>
          <p class="label">Ficha en bloque los días sin marcajes</p>
        </div>
      </div>
      <div class="divider"></div>

      <div class="mgrid">
        <!-- ===== calendar (left) ===== -->
        <div class="cal">
          <div class="cal-head">
            <button id="multi-day-prev-month" type="button" class="nav" (click)="shiftMonth(-1)" aria-label="Mes anterior">‹</button>
            <span class="my">{{ monthLabel() }}</span>
            <button id="multi-day-next-month" type="button" class="nav" (click)="shiftMonth(1)" aria-label="Mes siguiente">›</button>
          </div>

          <div class="dow">
            @for (d of dows; track $index) { <span>{{ d }}</span> }
          </div>

          <div class="grid" [class.busy]="loading()">
            @for (c of cells(); track c.key) {
              <button
                [id]="'multi-day-cell-' + c.key"
                type="button"
                class="cell"
                [class.out]="!c.inMonth"
                [class.today]="c.isToday"
                [class.sel]="c.selected"
                [class.marked]="c.hasMarcajes"
                [disabled]="c.disabled"
                [title]="c.title"
                (click)="toggle(c)"
              >
                <span class="d">{{ c.day }}</span>
                @if (c.hasMarcajes) { <span class="tick" aria-hidden="true">✓</span> }
              </button>
            }
          </div>

          <div class="legend">
            <span><i class="lg free"></i> Disponible</span>
            <span><i class="lg mark"></i> Con marcajes</span>
            <span><i class="lg sel"></i> Elegido</span>
          </div>
        </div>

        <!-- ===== controls (right) ===== -->
        <div class="ctrl">
          <div class="grphead">
            <span class="label">Horario</span>
            <a id="multi-day-config-ajustes" class="cfg" routerLink="/ajustes">configurar →</a>
          </div>

          @if (schedules().length === 0) {
            <p class="noned">No hay horarios. <a id="multi-day-crear-ajustes" routerLink="/ajustes">Crea uno en Ajustes</a>.</p>
          }

          <div class="schedules">
            @for (h of schedules(); track h.key) {
              <button
                [id]="'multi-day-sched-' + h.key"
                type="button"
                class="sched"
                [class.on]="selectedKey() === h.key"
                (click)="scheduleKey.set(h.key)"
              >
                <span class="stag">{{ tag(h) }}</span>
                <span class="sbody">
                  <span class="slabel">{{ h.label }}</span>
                  <span class="stotal">
                    @if (totals(h).malformed) {
                      horario incompleto
                    } @else {
                      {{ fmt(totals(h).minMs) }} – {{ fmt(totals(h).maxMs) }}
                    }
                  </span>
                </span>
                @if (h.teletrabajo) { <span class="remote">REMOTO</span> }
              </button>
            }
          </div>

          <div class="foot">
            <div class="summary">
              <span class="cnt">{{ selectedCount() }}</span>
              <span class="label">{{ selectedCount() === 1 ? 'día elegido' : 'días elegidos' }}</span>
              @if (selectedCount() > 0 && !busy()) {
                <button id="multi-day-clear" type="button" class="clearbtn" (click)="clearSelection()">limpiar</button>
              }
            </div>

            <button
              id="multi-day-submit"
              type="button"
              class="btn btn-volt submit"
              [disabled]="busy() || !selectedKey() || selectedCount() === 0"
              (click)="submit()"
            >
              @if (busy()) {
                <span class="dots"><i></i><i></i><i></i></span><span>{{ progress() }}</span>
              } @else {
                <span>Fichar {{ selectedCount() ? selectedCount() + ' ' : '' }}{{ selectedCount() === 1 ? 'día' : 'días' }}</span>
              }
            </button>
          </div>
        </div>
      </div>
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

      .mgrid {
        display: grid;
        grid-template-columns: minmax(0, 20rem) 1fr;
        gap: 1.8rem;
        align-items: start;
      }

      /* ===== calendar ===== */
      .cal-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.7rem;
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
      .dow {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 3px;
        margin-bottom: 0.35rem;
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
        gap: 3px;
        transition: opacity 0.2s ease;
      }
      .grid.busy {
        opacity: 0.55;
        pointer-events: none;
      }
      .cell {
        position: relative;
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg);
        border: 1px solid var(--line-strong);
        color: var(--text);
        font-family: var(--font-mono);
        font-size: 0.78rem;
        cursor: pointer;
        transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease,
          box-shadow 0.14s ease;
      }
      /* free & selectable — the actionable ones read crisp & bright */
      .cell:not(:disabled) {
        font-weight: 600;
      }
      .cell:not(:disabled):hover {
        border-color: var(--volt);
        color: var(--volt-ink);
        background: color-mix(in srgb, var(--volt) 14%, transparent);
        box-shadow: 0 0 14px -4px var(--volt-glow);
      }
      .cell.today {
        border-color: var(--volt);
        color: var(--volt-ink);
      }
      .cell.sel {
        background: var(--volt);
        color: var(--on-volt);
        border-color: var(--volt);
        box-shadow: 0 0 16px -3px var(--volt-glow);
      }
      .cell.sel:hover {
        color: var(--on-volt);
      }
      .cell:disabled {
        cursor: not-allowed;
      }

      /* ── days that already have marcajes: recessed "already done" tile ── */
      .cell.marked {
        background: color-mix(in srgb, var(--text) 9%, var(--bg));
        border-color: transparent;
        color: var(--text-faint);
        box-shadow: inset 0 1px 3px color-mix(in srgb, var(--text) 14%, transparent);
      }
      .cell.marked .d {
        opacity: 0.6;
      }
      .tick {
        position: absolute;
        top: 2px;
        right: 3px;
        font-size: 0.52rem;
        line-height: 1;
        color: var(--volt-ink);
        opacity: 0.9;
      }

      /* ── future / out-of-month: ghosted, clearly not on the board ── */
      .cell.out {
        background: transparent;
        border-color: transparent;
        color: var(--text-faint);
        opacity: 0.3;
      }
      .cell:disabled:not(.marked):not(.out) {
        background: transparent;
        border-color: transparent;
        color: var(--text-faint);
        opacity: 0.4;
      }

      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 1rem;
        margin-top: 0.85rem;
        font-family: var(--font-mono);
        font-size: 0.58rem;
        letter-spacing: 0.04em;
        color: var(--text-faint);
      }
      .legend span {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }
      .lg {
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 2px;
        border: 1px solid var(--line-strong);
        flex-shrink: 0;
      }
      .lg.free {
        background: var(--bg);
      }
      .lg.mark {
        background: color-mix(in srgb, var(--text) 9%, var(--bg));
        border-color: transparent;
        box-shadow: inset 0 1px 2px color-mix(in srgb, var(--text) 16%, transparent);
      }
      .lg.sel {
        background: var(--volt);
        border-color: var(--volt);
      }

      /* ===== controls ===== */
      .ctrl {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .grphead {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 0.5rem;
      }
      .cfg,
      .noned a {
        font-family: var(--font-mono);
        font-size: 0.6rem;
        letter-spacing: 0.06em;
        color: var(--text-dim);
        text-decoration: none;
        transition: color 0.18s ease;
      }
      .cfg:hover,
      .noned a:hover {
        color: var(--volt-ink);
      }
      .noned {
        font-family: var(--font-mono);
        font-size: 0.72rem;
        color: var(--text-faint);
        margin: 0 0 0.6rem;
      }
      .schedules {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .sched {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.7rem 0.8rem;
        background: var(--bg);
        border: 1px solid var(--line-strong);
        color: var(--text-dim);
        text-align: left;
        cursor: pointer;
        transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
      }
      .sched:hover {
        border-color: var(--volt);
        color: var(--text);
      }
      .sched.on {
        border-color: var(--volt);
        color: var(--text);
        background: color-mix(in srgb, var(--volt) 8%, transparent);
      }
      .stag {
        font-family: var(--font-mono);
        font-size: 0.62rem;
        letter-spacing: 0.08em;
        color: var(--volt-ink);
        border: 1px solid var(--line-strong);
        padding: 0.28rem 0.4rem;
        min-width: 4rem;
        text-align: center;
        flex-shrink: 0;
      }
      .sched.on .stag {
        border-color: var(--volt);
      }
      .sbody {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
      }
      .slabel {
        font-size: 0.78rem;
        font-family: var(--font-mono);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .stotal {
        font-family: var(--font-mono);
        font-size: 0.62rem;
        color: var(--volt-ink);
      }
      .remote {
        font-family: var(--font-mono);
        font-size: 0.55rem;
        color: var(--cyan);
        letter-spacing: 0.12em;
        flex-shrink: 0;
      }

      .foot {
        margin-top: auto;
        padding-top: 1.2rem;
      }
      .summary {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        margin-bottom: 0.7rem;
      }
      .cnt {
        font-family: var(--font-mono);
        font-size: 1.4rem;
        font-weight: 600;
        color: var(--volt-ink);
        line-height: 1;
      }
      .summary .label {
        margin: 0;
      }
      .clearbtn {
        margin-left: auto;
        background: transparent;
        border: none;
        color: var(--text-dim);
        font-family: var(--font-mono);
        font-size: 0.62rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
        transition: color 0.16s ease;
      }
      .clearbtn:hover {
        color: var(--volt-ink);
      }
      .submit {
        width: 100%;
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

      @media (max-width: 760px) {
        .mgrid {
          grid-template-columns: 1fr;
          gap: 1.4rem;
        }
      }
    `,
  ],
})
export class MultiDayClock {
  private api = inject(MarcajesService);
  private toasts = inject(ToastService);
  private settings = inject(SettingsService);
  private bulk = inject(BulkClockService);

  protected schedules = this.settings.schedules;
  private rand = this.settings.randomness;

  protected dows = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  protected viewDate = signal<Date>(this.startOfMonth(new Date()));
  protected scheduleKey = signal('');

  /** Days that already have marcajes, shared across the bulk cards. */
  private marcajeDays = this.bulk.markedDays;
  protected loading = this.bulk.loading;
  /** Local date keys the user has picked to clock. */
  private selectedDays = signal<Set<string>>(new Set());

  protected busy = signal(false);
  protected progress = signal('');

  protected selectedCount = computed(() => this.selectedDays().size);

  /** Falls back to the first schedule when none is explicitly picked. */
  protected selectedKey = computed(() => {
    const list = this.schedules();
    const picked = this.scheduleKey();
    if (picked && list.some((h) => h.key === picked)) return picked;
    return list[0]?.key ?? '';
  });

  protected cells = computed<DayCell[]>(() => {
    const view = this.viewDate();
    const year = view.getFullYear();
    const month = view.getMonth();
    const startDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
    const start = new Date(year, month, 1 - startDow);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const marked = this.marcajeDays();
    const picked = this.selectedDays();

    const out: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = localDateString(date);
      const inMonth = date.getMonth() === month;
      const hasMarcajes = marked.has(key);
      const isFuture = date.getTime() > today.getTime();
      const disabled = !inMonth || hasMarcajes || isFuture;
      out.push({
        i,
        day: date.getDate(),
        date,
        key,
        inMonth,
        isToday: date.getTime() === today.getTime(),
        hasMarcajes,
        isFuture,
        selected: picked.has(key),
        disabled,
        title: !inMonth
          ? ''
          : hasMarcajes
            ? 'Ya tiene marcajes'
            : isFuture
              ? 'Día futuro'
              : picked.has(key)
                ? 'Quitar de la selección'
                : 'Fichar este día',
      });
    }
    return out;
  });

  protected monthLabel = computed(() => {
    const v = this.viewDate();
    const m = MONTHS[v.getMonth()];
    return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${v.getFullYear()}`;
  });

  constructor() {
    this.bulk.ensureLoaded();
  }

  private startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  protected totals(h: Horario) {
    return totalRange(h, this.rand());
  }
  protected fmt(ms: number) {
    return formatDuration(ms);
  }
  protected tag(h: Horario) {
    return (h.short || h.label.split(/[ ·/]/)[0] || 'HORARIO').toUpperCase().slice(0, 7);
  }

  protected shiftMonth(dir: number) {
    this.viewDate.update((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  }

  protected toggle(c: DayCell) {
    if (c.disabled) return;
    this.selectedDays.update((s) => {
      const next = new Set(s);
      if (next.has(c.key)) next.delete(c.key);
      else next.add(c.key);
      return next;
    });
  }

  protected clearSelection() {
    this.selectedDays.set(new Set());
  }

  protected async submit() {
    if (this.busy()) return;
    const key = this.selectedKey();
    if (!key) {
      this.toasts.error('Selecciona un horario');
      return;
    }
    const days = [...this.selectedDays()].sort();
    if (!days.length) {
      this.toasts.error('Selecciona al menos un día');
      return;
    }

    this.busy.set(true);
    let doneDays = 0;
    let totalMarcajes = 0;
    try {
      for (const day of days) {
        this.progress.set(`Día ${doneDays + 1} / ${days.length}`);
        const list = this.api.buildDay(day, key);
        await this.api.postSequential(list);
        doneDays++;
        totalMarcajes += list.length;
      }
      this.toasts.success(
        `${doneDays} ${doneDays === 1 ? 'día fichado' : 'días fichados'} · ${totalMarcajes} marcajes`,
      );
      this.clearSelection();
    } catch (err) {
      this.toasts.error(`${(err as Error).message} · ${doneDays}/${days.length} días completados`);
    } finally {
      this.busy.set(false);
      this.progress.set('');
      await this.bulk.reload();
    }
  }
}

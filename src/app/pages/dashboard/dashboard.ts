import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MarcajesService } from '../../core/marcajes.service';
import { AnalyticsService } from '../../core/analytics.service';
import { ToastService } from '../../core/toast.service';
import { Marcaje } from '../../core/models';
import { formatDuration, formatTime, localDateString, weekRangeLabel } from '../../core/date-utils';
import { buildWeekModel } from '../../core/week-data';
import { VoltTimeline } from '../../shared/timeline-chart';
import { QuickClock } from '../../shared/quick-clock';

@Component({
  selector: 'volt-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VoltTimeline, QuickClock],
  template: `
    <header class="pagehead rise">
      <div>
        <p class="label">// Resumen semanal</p>
        <h1 class="title">Semana</h1>
      </div>
      <div class="weeknav">
        <button id="dashboard-prev-week" class="btn btn-ghost" (click)="shiftWeek(-1)" aria-label="Semana anterior">‹</button>
        <span class="range">{{ range() }}</span>
        <button id="dashboard-next-week" class="btn btn-ghost" (click)="shiftWeek(1)" aria-label="Semana siguiente">›</button>
        <button id="dashboard-today" class="btn btn-ghost today" (click)="goToday()">HOY</button>
      </div>
    </header>

    <!-- stat strip -->
    <section class="stats">
      <div class="stat panel ticked rise" style="animation-delay:.05s">
        <span class="label">Horas semana</span>
        <span class="big mono">{{ fmt(week().weekTotalMs) }}</span>
        <span class="meta">objetivo 40h 00m</span>
      </div>
      <div class="stat panel rise" style="animation-delay:.1s">
        <span class="label">Hoy</span>
        <span class="big mono">{{ fmt(todayMs()) }}</span>
        <span class="meta">{{ today()?.short || '—' }}</span>
      </div>
      <div class="stat panel rise" style="animation-delay:.15s">
        <span class="label">Estado</span>
        <span class="big status" [class.on]="working()">
          <span class="dot" [class.live]="working()"></span>
          {{ working() ? 'Fichado' : 'Fuera' }}
        </span>
        <span class="meta">{{ lastLabel() }}</span>
      </div>
      <div class="stat panel ticked rise" style="animation-delay:.2s">
        <span class="label">Media / día</span>
        <span class="big mono">{{ daysWorked() > 0 ? fmt(avgMs()) : '—' }}</span>
        <span class="meta">{{ daysWorked() }} {{ daysWorked() === 1 ? 'día fichado' : 'días fichados' }}</span>
      </div>
    </section>

    <!-- timeline -->
    <section class="panel ticked chartpanel rise" style="animation-delay:.25s">
      <div class="chrome">
        <span class="label">Línea temporal · {{ range() }}</span>
        <span class="legend">
          <i class="lg solid"></i> jornada
          <i class="lg live"></i> en curso
        </span>
      </div>
      <volt-timeline [data]="marcajes()" [baseDate]="baseDate()" [loading]="loading()" />
      @if (!loading() && week().weekTotalMs === 0) {
        <div class="empty"><span>Sin marcajes esta semana.</span></div>
      }
    </section>

    <!-- quick clock-in -->
    <div class="quick rise" style="animation-delay:.3s">
      <volt-quick-clock [working]="working()" [markedDays]="markedDays()" (changed)="load()" />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .pagehead {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
        margin-bottom: 1.8rem;
      }
      .title {
        font-size: clamp(1.8rem, 5vw, 2.6rem);
        font-weight: 600;
        letter-spacing: -0.02em;
        margin: 0.2rem 0 0;
        line-height: 1;
      }
      .weeknav {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .range {
        font-family: var(--font-mono);
        font-size: 0.78rem;
        color: var(--text-dim);
        min-width: 9.5rem;
        text-align: center;
      }
      .today {
        font-size: 0.62rem !important;
        border: 1px solid var(--line-strong) !important;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1px;
        margin-bottom: 1.5rem;
      }
      /* pastel: glass cards read better with breathing room */
      :host-context([data-palette='pastel']) .stats {
        gap: 0.7rem;
      }
      .stat {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        padding: 1.2rem 1.25rem;
      }
      .big {
        font-size: 1.55rem;
        font-weight: 500;
        line-height: 1;
        letter-spacing: -0.01em;
      }
      .mono {
        font-family: var(--font-mono);
      }
      .meta {
        font-family: var(--font-mono);
        font-size: 0.62rem;
        letter-spacing: 0.06em;
        color: var(--text-faint);
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--text-dim);
        font-size: 1.3rem;
      }
      .status.on {
        color: var(--volt-ink);
      }
      .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--text-faint);
      }
      .dot.live {
        background: var(--volt);
        box-shadow: 0 0 10px var(--volt-glow);
        animation: pulse-glow 1.6s ease-in-out infinite;
      }
      .chartpanel {
        padding: 1.3rem 1.4rem 1.6rem;
      }
      .chrome {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.4rem;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .legend {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-family: var(--font-mono);
        font-size: 0.6rem;
        color: var(--text-faint);
      }
      .lg {
        display: inline-block;
        width: 14px;
        height: 8px;
        margin-left: 0.6rem;
        margin-right: 0.1rem;
        vertical-align: middle;
      }
      .lg.solid {
        background: var(--volt);
      }
      .lg.live {
        background: repeating-linear-gradient(90deg, var(--cyan) 0 4px, transparent 4px 7px);
      }
      .empty {
        position: absolute;
        left: 0;
        right: 0;
        top: 3.2rem;
        bottom: 1.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .empty span {
        font-family: var(--font-mono);
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        color: var(--text-faint);
        background: color-mix(in srgb, var(--bg-2) 88%, transparent);
        border: 1px solid var(--line);
        padding: 0.45rem 0.9rem;
      }
      .quick {
        margin-top: 1.5rem;
      }
      @media (max-width: 860px) {
        .stats {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 480px) {
        .stats {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DashboardPage {
  private api = inject(MarcajesService);
  private analytics = inject(AnalyticsService);
  private toasts = inject(ToastService);

  protected marcajes = signal<Marcaje[]>([]);
  protected baseDate = signal<Date>(new Date());
  protected loading = signal(true);

  protected range = computed(() => weekRangeLabel(this.baseDate()));
  protected week = computed(() => buildWeekModel(this.marcajes(), this.baseDate()));
  protected today = computed(() => this.week().days.find((d) => d.isToday) ?? null);
  protected todayMs = computed(() => this.today()?.totalMs ?? 0);
  protected daysWorked = computed(() => this.week().days.filter((d) => d.totalMs > 0).length);
  protected avgMs = computed(() => {
    const n = this.daysWorked();
    return n > 0 ? this.week().weekTotalMs / n : 0;
  });

  /** Local date keys that already have at least one marcaje (for warnings). */
  protected markedDays = computed(() => {
    const set = new Set<string>();
    for (const m of this.marcajes()) set.add(localDateString(new Date(m.fecha)));
    return set;
  });

  protected working = computed(() => this.marcajes()[0]?.sentido === 'ENTRADA');
  protected lastLabel = computed(() => {
    const last = this.marcajes()[0];
    if (!last) return 'sin registros';
    return `últ. ${formatTime(new Date(last.fecha))} · ${last.sentido.toLowerCase()}`;
  });

  constructor() {
    this.load();
  }

  protected fmt(ms: number) {
    return formatDuration(ms);
  }

  protected async load() {
    this.loading.set(true);
    try {
      this.marcajes.set(await this.api.fetchAll());
    } catch (err) {
      this.toasts.error((err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected shiftWeek(dir: number) {
    const d = new Date(this.baseDate());
    d.setDate(d.getDate() + dir * 7);
    this.baseDate.set(d);
    this.analytics.track('semana_navegada', { direccion: dir > 0 ? 'siguiente' : 'anterior' });
  }

  protected goToday() {
    this.baseDate.set(new Date());
    this.analytics.track('semana_navegada', { direccion: 'hoy' });
  }
}

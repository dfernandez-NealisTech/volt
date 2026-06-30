import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MarcajesService } from '../../core/marcajes.service';
import { ToastService } from '../../core/toast.service';
import { SettingsService } from '../../core/settings.service';
import { Horario, Sentido } from '../../core/config';
import { totalRange } from '../../core/schedule-math';
import { formatDuration, localDateString, localDateTimeString } from '../../core/date-utils';
import { VoltDatepicker } from '../../shared/datepicker';

@Component({
  selector: 'volt-fichar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, VoltDatepicker],
  template: `
    <header class="pagehead rise">
      <div>
        <p class="label">// Registrar jornada</p>
        <h1 class="title">Fichar</h1>
      </div>
    </header>

    <div class="cols">
      <!-- ===== quick marcaje ===== -->
      <section class="panel ticked card rise" style="animation-delay:.05s">
        <div class="cardhead">
          <span class="num mono">01</span>
          <div>
            <h2>Marcaje</h2>
            <p class="label">Un único fichaje puntual</p>
          </div>
        </div>
        <div class="divider"></div>

        <form (ngSubmit)="sendQuick()">
          <div class="grp">
            <span class="label">Fecha y hora</span>
            <volt-datepicker [(value)]="fecha" [withTime]="true" placeholder="Selecciona fecha y hora" />
          </div>

          <div class="grp">
            <span class="label">Sentido</span>
            <div class="seg">
              <button type="button" [class.on]="sentido() === 'ENTRADA'" (click)="sentido.set('ENTRADA')">
                Entrada
              </button>
              <button type="button" [class.on]="sentido() === 'SALIDA'" (click)="sentido.set('SALIDA')">
                Salida
              </button>
            </div>
          </div>

          <div class="grp">
            <span class="label">Teletrabajo</span>
            <div class="seg">
              <button type="button" [class.on]="!tele()" (click)="tele.set(false)">No</button>
              <button type="button" [class.on]="tele()" (click)="tele.set(true)">Sí</button>
            </div>
          </div>

          <button type="submit" class="btn btn-volt w-full mt-2" [disabled]="qBusy()">
            @if (qBusy()) { <span class="dots"><i></i><i></i><i></i></span><span>Enviando</span> }
            @else { <span>Enviar marcaje</span> }
          </button>
        </form>
      </section>

      <!-- ===== full day ===== -->
      <section class="panel ticked card rise" style="animation-delay:.12s">
        <div class="cardhead">
          <span class="num mono">02</span>
          <div>
            <h2>Día completo</h2>
            <p class="label">Genera la jornada entera</p>
          </div>
        </div>
        <div class="divider"></div>

        <form (ngSubmit)="sendDay()">
          <div class="grp">
            <span class="label">Día</span>
            <volt-datepicker [(value)]="dia" />
          </div>

          <div class="grp">
            <div class="grphead">
              <span class="label">Horario</span>
              <a class="cfg" routerLink="/ajustes">configurar →</a>
            </div>

            @if (schedules().length === 0) {
              <p class="noned">
                No hay horarios. <a routerLink="/ajustes">Crea uno en Ajustes</a>.
              </p>
            }

            <div class="schedules">
              @for (h of schedules(); track h.key) {
                <button
                  type="button"
                  class="sched"
                  [class.on]="selectedKey() === h.key"
                  (click)="horarioKey.set(h.key)"
                >
                  <span class="stag mono">{{ tag(h) }}</span>
                  <span class="sbody">
                    <span class="slabel">{{ h.label }}</span>
                    <span class="stotal mono">
                      @if (totals(h).malformed) {
                        horario incompleto
                      } @else {
                        {{ fmt(totals(h).minMs) }} – {{ fmt(totals(h).maxMs) }}
                      }
                    </span>
                  </span>
                  @if (h.teletrabajo) { <span class="remote mono">REMOTO</span> }
                </button>
              }
            </div>
          </div>

          <button type="submit" class="btn btn-volt w-full mt-2" [disabled]="dBusy() || !selectedKey()">
            @if (dBusy()) {
              <span class="dots"><i></i><i></i><i></i></span><span>{{ progress() }}</span>
            } @else { <span>Fichar día completo</span> }
          </button>

          @if (selected(); as sel) {
            @if (!totals(sel).malformed) {
              <p class="dayhint mono">
                Resultará entre <b>{{ fmt(totals(sel).minMs) }}</b> y
                <b>{{ fmt(totals(sel).maxMs) }}</b> · aleatoriedad
                {{ signed(rand().min) }}…{{ signed(rand().max) }} min
              </p>
            }
          }
        </form>
      </section>
    </div>
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
      .cols {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.4rem;
        align-items: start;
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
      .grp {
        display: block;
        margin-bottom: 1.15rem;
      }
      .grp > .label {
        display: block;
        margin-bottom: 0.5rem;
      }
      .seg {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border: 1px solid var(--line-strong);
        border-radius: var(--radius);
        overflow: hidden;
      }
      .seg button {
        padding: 0.6rem;
        background: transparent;
        border: none;
        color: var(--text-dim);
        font-family: var(--font-mono);
        font-size: 0.74rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background 0.18s ease, color 0.18s ease;
      }
      .seg button + button {
        border-left: 1px solid var(--line-strong);
      }
      .seg button:hover {
        color: var(--text);
      }
      .seg button.on {
        background: var(--volt);
        color: var(--on-volt);
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
      .stag {
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
        font-size: 0.62rem;
        color: var(--volt-ink);
      }
      .remote {
        font-size: 0.55rem;
        color: var(--cyan);
        letter-spacing: 0.12em;
        flex-shrink: 0;
      }
      .dayhint {
        margin: 0.9rem 0 0;
        text-align: center;
        font-size: 0.66rem;
        color: var(--text-faint);
        line-height: 1.5;
      }
      .dayhint b {
        color: var(--volt-ink);
        font-weight: 600;
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
        .cols {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class FicharPage {
  private api = inject(MarcajesService);
  private toasts = inject(ToastService);
  private settings = inject(SettingsService);

  protected schedules = this.settings.schedules;
  protected rand = this.settings.randomness;

  protected fecha = localDateTimeString();
  protected sentido = signal<Sentido>('ENTRADA');
  protected tele = signal(false);
  protected qBusy = signal(false);

  protected dia = localDateString();
  protected horarioKey = signal('');
  protected dBusy = signal(false);
  protected progress = signal('Enviando');

  /** Falls back to the first schedule when no valid one is picked. */
  protected selectedKey = computed(() => {
    const list = this.schedules();
    const picked = this.horarioKey();
    if (picked && list.some((h) => h.key === picked)) return picked;
    return list[0]?.key ?? '';
  });
  protected selected = computed(() =>
    this.schedules().find((h) => h.key === this.selectedKey()) ?? null,
  );

  constructor() {
    this.prefillSentido();
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
  protected signed(n: number) {
    return n > 0 ? `+${n}` : `${n}`;
  }

  /** Default the quick-marcaje direction to the opposite of the last record. */
  private async prefillSentido() {
    try {
      const data = await this.api.fetchAll();
      if (data[0]) this.sentido.set(data[0].sentido === 'ENTRADA' ? 'SALIDA' : 'ENTRADA');
    } catch {
      /* non-fatal */
    }
  }

  protected async sendQuick() {
    if (this.qBusy()) return;
    if (!this.fecha) {
      this.toasts.error('Selecciona fecha y hora');
      return;
    }
    this.qBusy.set(true);
    try {
      await this.api.postFromLocalString(this.fecha, this.sentido(), this.tele());
      this.toasts.success(`Marcaje ${this.sentido().toLowerCase()} enviado`);
    } catch (err) {
      this.toasts.error((err as Error).message);
    } finally {
      this.qBusy.set(false);
    }
  }

  protected async sendDay() {
    if (this.dBusy()) return;
    if (!this.dia) {
      this.toasts.error('Selecciona un día');
      return;
    }
    let list;
    try {
      list = this.api.buildDay(this.dia, this.selectedKey());
    } catch (err) {
      this.toasts.error((err as Error).message);
      return;
    }
    this.dBusy.set(true);
    this.progress.set(`0 / ${list.length}`);
    try {
      const sent = await this.api.postSequential(list, (s, t) => this.progress.set(`${s} / ${t}`));
      this.toasts.success(`Día fichado · ${sent} marcajes`);
    } catch (err) {
      this.toasts.error((err as Error).message);
    } finally {
      this.dBusy.set(false);
      this.progress.set('Enviando');
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SettingsService } from '../../core/settings.service';
import { Horario, RANDOMNESS_BOUNDS, Sentido } from '../../core/config';
import { totalRange } from '../../core/schedule-math';
import { formatDuration } from '../../core/date-utils';
import { RangeSlider } from '../../shared/range-slider';

@Component({
  selector: 'volt-ajustes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RangeSlider],
  template: `
    <header class="pagehead rise">
      <div>
        <p class="label">// Configuración</p>
        <h1 class="title">Ajustes</h1>
      </div>
    </header>

    <!-- ===== randomness ===== -->
    <section class="panel ticked card rise" style="animation-delay:.05s">
      <div class="cardhead">
        <span class="num mono">~</span>
        <div>
          <h2>Aleatoriedad</h2>
          <p class="label">Variación de cada tramo de trabajo</p>
        </div>
        <button class="btn btn-ghost reset" (click)="resetRand()">Restablecer</button>
      </div>
      <div class="divider"></div>

      <div class="randwrap">
        <div class="readout mono">
          <span class="rv" [class.neg]="rand().min < 0">{{ signed(rand().min) }}</span>
          <span class="sep">a</span>
          <span class="rv" [class.neg]="rand().max < 0">{{ signed(rand().max) }}</span>
          <span class="unit">min / tramo</span>
        </div>

        <volt-range
          [min]="bounds.min"
          [max]="bounds.max"
          [step]="1"
          [low]="rand().min"
          (lowChange)="setLow($event)"
          [high]="rand().max"
          (highChange)="setHigh($event)"
          lowLabel="Variación mínima (min)"
          highLabel="Variación máxima (min)"
        />

        <div class="scale mono">
          <span>{{ signed(bounds.min) }}</span>
          <span>0</span>
          <span>{{ signed(bounds.max) }}</span>
        </div>

        <p class="explain">
          La duración de cada tramo se desplaza un valor aleatorio dentro de este rango
          (la entrada se adelanta y la salida se retrasa a partes iguales). Con
          <b>{{ exampleSegments() }}</b> tramos, el rango se acumula tramo a tramo.
        </p>
      </div>
    </section>

    <!-- ===== schedules ===== -->
    <section class="sched-head rise" style="animation-delay:.1s">
      <h2>Horarios</h2>
      <div class="actions">
        <button class="btn btn-ghost reset" (click)="settings.resetSchedules()">Restablecer</button>
        <button class="btn" (click)="settings.addSchedule()">+ Añadir horario</button>
      </div>
    </section>

    <div class="grid">
      @for (h of settings.schedules(); track h.key; let si = $index) {
        <section class="panel ticked card rise" [style.animation-delay.ms]="120 + si * 50">
          <div class="schtop">
            <input
              class="field labelfield"
              [value]="h.label"
              (input)="settings.updateLabel(h.key, asValue($event))"
              aria-label="Nombre del horario"
            />
            <button class="iconbtn danger" (click)="settings.removeSchedule(h.key)" title="Eliminar horario">
              ✕
            </button>
          </div>

          <div class="row tele">
            <span class="label">Teletrabajo</span>
            <div class="seg sm">
              <button type="button" [class.on]="!h.teletrabajo" (click)="settings.toggleTeletrabajo(h.key, false)">No</button>
              <button type="button" [class.on]="h.teletrabajo" (click)="settings.toggleTeletrabajo(h.key, true)">Sí</button>
            </div>
          </div>

          <div class="marcajes">
            @for (m of h.marcajes; track $index; let mi = $index) {
              <div class="mrow">
                <span class="midx mono">{{ pad(mi + 1) }}</span>
                <div class="seg sm dir">
                  <button type="button" [class.on]="m.sentido === 'ENTRADA'" (click)="setSentido(h.key, mi, 'ENTRADA')">Ent</button>
                  <button type="button" [class.on]="m.sentido === 'SALIDA'" (click)="setSentido(h.key, mi, 'SALIDA')">Sal</button>
                </div>
                <input
                  class="field timefield"
                  type="time"
                  [value]="hhmm(m.hour, m.minute)"
                  (input)="setTime(h.key, mi, asValue($event))"
                  aria-label="Hora"
                />
                <button class="iconbtn" (click)="settings.removeMarcaje(h.key, mi)" title="Quitar marcaje">−</button>
              </div>
            }
            <button class="addmk" (click)="settings.addMarcaje(h.key)">+ marcaje</button>
          </div>

          <div class="total" [class.warn]="totals(h).malformed">
            @if (totals(h).malformed) {
              <span class="label">Horario incompleto · empareja entrada/salida</span>
            } @else {
              <span class="label">Total resultante</span>
              <span class="trange mono">
                {{ fmt(totals(h).minMs) }} <span class="dash">–</span> {{ fmt(totals(h).maxMs) }}
              </span>
              <span class="tnom mono">nominal {{ fmt(totals(h).nominalMs) }} · {{ totals(h).pairs }} tramos</span>
            }
          </div>
        </section>
      }
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
      .card {
        padding: 1.5rem 1.6rem 1.6rem;
      }
      .cardhead {
        display: flex;
        align-items: center;
        gap: 0.9rem;
      }
      .num {
        font-size: 1.2rem;
        color: var(--volt-ink);
        border: 1px solid var(--line-strong);
        padding: 0.1rem 0.55rem;
        line-height: 1.4;
      }
      h2 {
        font-size: 1.15rem;
        font-weight: 600;
        margin: 0;
      }
      .cardhead .label {
        margin: 0.2rem 0 0;
      }
      .reset {
        margin-left: auto;
        font-size: 0.62rem !important;
      }
      .divider {
        margin: 1.2rem 0 1.4rem;
      }

      /* randomness */
      .readout {
        display: flex;
        align-items: baseline;
        gap: 0.6rem;
        margin-bottom: 0.4rem;
      }
      .rv {
        font-size: 1.9rem;
        color: var(--volt-ink);
        font-weight: 500;
      }
      .sep {
        color: var(--text-faint);
        font-size: 0.8rem;
      }
      .unit {
        font-size: 0.66rem;
        letter-spacing: 0.1em;
        color: var(--text-faint);
        text-transform: uppercase;
      }
      .scale {
        display: flex;
        justify-content: space-between;
        font-size: 0.6rem;
        color: var(--text-faint);
        margin-top: -0.2rem;
      }
      .explain {
        margin: 1rem 0 0;
        font-size: 0.78rem;
        line-height: 1.5;
        color: var(--text-dim);
      }
      .explain b {
        color: var(--volt-ink);
        font-weight: 600;
      }

      /* schedules header */
      .sched-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 2.2rem 0 1.1rem;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .sched-head h2 {
        font-size: 1.05rem;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
        gap: 1.2rem;
        align-items: start;
      }

      .schtop {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .labelfield {
        font-family: var(--font-sans) !important;
        font-size: 0.95rem;
        font-weight: 600;
      }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 1.1rem;
      }
      .seg {
        display: inline-grid;
        grid-auto-flow: column;
        border: 1px solid var(--line-strong);
      }
      .seg button {
        padding: 0.45rem 0.8rem;
        background: transparent;
        border: none;
        color: var(--text-dim);
        font-family: var(--font-mono);
        font-size: 0.66rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background 0.16s ease, color 0.16s ease;
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
      .seg.dir button {
        padding: 0.45rem 0.6rem;
      }

      .marcajes {
        margin-top: 1.1rem;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }
      .mrow {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .midx {
        font-size: 0.62rem;
        color: var(--text-faint);
        width: 1.1rem;
      }
      .timefield {
        flex: 1;
        padding: 0.45rem 0.6rem;
        font-size: 0.82rem;
      }
      .iconbtn {
        width: 1.9rem;
        height: 1.9rem;
        flex-shrink: 0;
        border: 1px solid var(--line-strong);
        background: transparent;
        color: var(--text-dim);
        cursor: pointer;
        font-family: var(--font-mono);
        transition: color 0.16s ease, border-color 0.16s ease;
      }
      .iconbtn:hover {
        color: var(--volt-ink);
        border-color: var(--volt);
      }
      .iconbtn.danger:hover {
        color: var(--danger);
        border-color: var(--danger);
      }
      .addmk {
        margin-top: 0.2rem;
        padding: 0.45rem;
        border: 1px dashed var(--line-strong);
        background: transparent;
        color: var(--text-dim);
        font-family: var(--font-mono);
        font-size: 0.66rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        cursor: pointer;
        transition: color 0.16s ease, border-color 0.16s ease;
      }
      .addmk:hover {
        color: var(--volt-ink);
        border-color: var(--volt);
      }

      .total {
        margin-top: 1.3rem;
        padding-top: 1rem;
        border-top: 1px solid var(--line);
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .trange {
        font-size: 1.15rem;
        color: var(--volt-ink);
      }
      .dash {
        color: var(--text-faint);
      }
      .tnom {
        font-size: 0.62rem;
        color: var(--text-faint);
      }
      .total.warn .label {
        color: var(--danger);
      }
    `,
  ],
})
export class AjustesPage {
  protected settings = inject(SettingsService);
  protected bounds = RANDOMNESS_BOUNDS;

  protected rand = this.settings.randomness;
  protected exampleSegments = computed(() => {
    const max = Math.max(0, ...this.settings.schedules().map((h) => totalRange(h, this.rand()).pairs));
    return max || 1;
  });

  protected setLow(v: number) {
    this.settings.setRandomness(v, this.rand().max);
  }
  protected setHigh(v: number) {
    this.settings.setRandomness(this.rand().min, v);
  }
  protected resetRand() {
    this.settings.resetRandomness();
  }

  protected setSentido(key: string, index: number, sentido: Sentido) {
    this.settings.updateMarcaje(key, index, { sentido });
  }

  protected setTime(key: string, index: number, value: string) {
    const [h, m] = value.split(':').map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      this.settings.updateMarcaje(key, index, { hour: h, minute: m });
    }
  }

  protected totals(h: Horario) {
    return totalRange(h, this.rand());
  }

  protected fmt(ms: number) {
    return formatDuration(ms);
  }
  protected hhmm(h: number, m: number) {
    return `${this.pad(h)}:${this.pad(m)}`;
  }
  protected pad(n: number) {
    return n.toString().padStart(2, '0');
  }
  protected signed(n: number) {
    return n > 0 ? `+${n}` : `${n}`;
  }
  protected asValue(e: Event) {
    return (e.target as HTMLInputElement).value;
  }
}

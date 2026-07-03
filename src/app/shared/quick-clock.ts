import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MarcajesService } from '../core/marcajes.service';
import { ToastService } from '../core/toast.service';
import { SettingsService } from '../core/settings.service';
import { Sentido } from '../core/config';
import { formatTime, localDateString, localDateTimeString } from '../core/date-utils';
import { VoltDatepicker } from './datepicker';

/** A pending action awaiting confirmation in the warning dialog. */
interface Confirm {
  title: string;
  body: string;
  action: () => void;
}

/**
 * Quick clock-in panel for the dashboard. The primary action posts a marcaje
 * NOW with the direction auto-derived from the current status. A secondary
 * shortcut clocks a full remembered day. Emits `changed` after any post so the
 * parent can refresh the week.
 */
@Component({
  selector: 'volt-quick-clock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, VoltDatepicker],
  template: `
    <div class="flip" [class.flipped]="manual()">
     <div class="flip-inner">
      <!-- ===== FRONT · fichaje rápido ===== -->
      <section class="panel ticked qc face front" [attr.aria-hidden]="manual()">
      <div class="chrome">
        <span class="label">Fichaje rápido</span>
        <button
          type="button"
          class="flipbtn"
          (click)="toggleManual()"
          title="Cambiar a marcaje manual"
          aria-label="Cambiar a marcaje manual"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <polyline points="21 4 21 9 16 9" />
            <polyline points="3 20 3 15 8 15" />
            <path d="M20 9A8 8 0 0 0 5.6 5.6L3 8M4 15a8 8 0 0 0 14.4 2.4L21 15" />
          </svg>
        </button>
      </div>

      <div class="cols">
        <!-- ===== fichar ahora ===== -->
        <div class="col now">
          <div class="actions">
            <button
              type="button"
              class="nowbtn"
              [class.salida]="working()"
              [disabled]="nowBusy()"
              (click)="ficharAhora()"
            >
              <span class="glyph" aria-hidden="true">
                @if (working()) {
                  <svg viewBox="0 0 24 24" width="20" height="20"><path d="M14 5v14M14 12H4M7 9l-3 3 3 3" /></svg>
                } @else {
                  <svg viewBox="0 0 24 24" width="20" height="20"><path d="M10 5v14M10 12h10M17 9l3 3-3 3" /></svg>
                }
              </span>
              <span class="bbody">
                @if (nowBusy()) {
                  <span class="bdir"><span class="dots"><i></i><i></i><i></i></span> Fichando</span>
                } @else {
                  <span class="bdir">Fichar {{ working() ? 'salida' : 'entrada' }}</span>
                  <span class="bsub">{{ working() ? 'estás fichado ahora' : 'estás fuera ahora' }}</span>
                }
              </span>
              <span class="btime mono">{{ nowTime() }}</span>
            </button>

            @if (forgotTarget(); as t) {
              <button
                type="button"
                class="forgotbtn"
                [disabled]="forgotBusy()"
                (click)="ficharOlvido()"
                [title]="forgotTitle()"
              >
                <span class="fg-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="15" height="15">
                    <path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3M3.5 4.2v4h4" />
                    <path d="M12 8.2V12l2.8 1.8" />
                  </svg>
                </span>
                @if (forgotBusy()) {
                  <span class="fg-t"><span class="dots"><i></i><i></i><i></i></span></span>
                } @else {
                  <span class="fg-t">¿Olvidaste fichar?</span>
                  <span class="fg-sub mono">{{ t.sentido === 'SALIDA' ? 'salida' : 'entrada' }} · {{ pad(t.hour) }}:{{ pad(t.minute) }}</span>
                }
              </button>
            }
          </div>

          <div class="teletog">
            <span class="label">Teletrabajo</span>
            <div class="seg sm">
              <button type="button" [class.on]="!tele()" (click)="setTele(false)">No</button>
              <button type="button" [class.on]="tele()" (click)="setTele(true)">Sí</button>
            </div>
          </div>
        </div>

        <div class="vsep"></div>

        <!-- ===== día completo ===== -->
        <div class="col day">
          <span class="label colhead">Día completo</span>

          @if (schedules().length === 0) {
            <p class="noned">
              Sin horarios. <a routerLink="/ajustes">Crear en Ajustes</a>.
            </p>
          } @else {
            <div class="dayrow">
              <select
                class="field"
                [ngModel]="scheduleKey()"
                (ngModelChange)="setSchedule($event)"
                aria-label="Horario"
              >
                @for (h of schedules(); track h.key) {
                  <option [value]="h.key">{{ h.label }}</option>
                }
              </select>
              <volt-datepicker class="datef" [(value)]="dia" />
            </div>

            <button
              type="button"
              class="btn w-full"
              [disabled]="dayBusy() || !scheduleKey()"
              (click)="ficharDia()"
            >
              @if (dayBusy()) {
                <span class="dots"><i></i><i></i><i></i></span><span>{{ progress() }}</span>
              } @else {
                <span>Fichar día completo</span>
              }
            </button>
          }
        </div>
      </div>
      </section>

      <!-- ===== BACK · marcaje manual ===== -->
      <section class="panel ticked qc face back" [attr.aria-hidden]="!manual()">
        <div class="chrome">
          <span class="label">Marcaje manual</span>
          <button
            type="button"
            class="flipbtn"
            (click)="toggleManual()"
            title="Volver al fichaje rápido"
            aria-label="Volver al fichaje rápido"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <polyline points="21 4 21 9 16 9" />
              <polyline points="3 20 3 15 8 15" />
              <path d="M20 9A8 8 0 0 0 5.6 5.6L3 8M4 15a8 8 0 0 0 14.4 2.4L21 15" />
            </svg>
          </button>
        </div>

        <form class="mform" (ngSubmit)="sendManual()">
          <div class="grp">
            <span class="label">Fecha y hora</span>
            <volt-datepicker [(value)]="fecha" [withTime]="true" placeholder="Selecciona fecha y hora" />
          </div>

          <div class="actionrow">
            <div class="toggles">
              <div class="tgl">
                <span class="tgico" title="Sentido" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="15" height="15">
                    <path d="M17 4l3 3-3 3" />
                    <path d="M20 7H9a4 4 0 0 0-4 4" />
                    <path d="M7 20l-3-3 3-3" />
                    <path d="M4 17h11a4 4 0 0 0 4-4" />
                  </svg>
                </span>
                <div class="seg sm" role="group" aria-label="Sentido">
                  <button type="button" [class.on]="sentido() === 'ENTRADA'" (click)="setSentido('ENTRADA')">Entrada</button>
                  <button type="button" [class.on]="sentido() === 'SALIDA'" (click)="setSentido('SALIDA')">Salida</button>
                </div>
              </div>

              <div class="tgl">
                <span class="tgico" title="Teletrabajo" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="15" height="15">
                    <path d="M3 11l9-7 9 7" />
                    <path d="M5 10v9h5v-6h4v6h5v-9" />
                  </svg>
                </span>
                <div class="seg sm" role="group" aria-label="Teletrabajo">
                  <button type="button" [class.on]="!mtele()" (click)="mtele.set(false)">No</button>
                  <button type="button" [class.on]="mtele()" (click)="mtele.set(true)">Sí</button>
                </div>
              </div>
            </div>

            <button type="submit" class="btn btn-volt sendbtn" [disabled]="mBusy()">
              @if (mBusy()) {
                <span class="dots"><i></i><i></i><i></i></span><span>Enviando</span>
              } @else {
                <span>Enviar marcaje</span>
              }
            </button>
          </div>
        </form>
      </section>
     </div>
    </div>

    <!-- ===== confirm dialog (future date / day already clocked) =====
         Native <dialog> so it renders in the browser top layer, escaping the
         card's transform/perspective containing block and covering the viewport. -->
    <dialog
      #cfDlg
      class="cf-dialog"
      role="alertdialog"
      aria-labelledby="cf-title"
      (click)="onBackdropClick($event, cfDlg)"
      (close)="closeConfirm()"
    >
      @if (confirm(); as c) {
        <div class="cf" (click)="$event.stopPropagation()">
          <span class="cf-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M12 3.5 1.8 21h20.4L12 3.5Z" />
              <path d="M12 10v4.5" />
              <circle cx="12" cy="17.6" r="0.6" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <h3 class="cf-title" id="cf-title">{{ c.title }}</h3>
          <p class="cf-body">{{ c.body }}</p>
          <div class="cf-actions">
            <button type="button" class="btn" (click)="closeConfirm()">Cancelar</button>
            <button type="button" class="btn btn-volt" (click)="runConfirm()">Continuar</button>
          </div>
        </div>
      }
    </dialog>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* ===== flip card ===== */
      .flip {
        perspective: 2200px;
      }
      .flip-inner {
        display: grid;
        transform-style: preserve-3d;
        transition: transform 0.6s cubic-bezier(0.5, 0.12, 0.2, 1);
      }
      .flip.flipped .flip-inner {
        transform: rotateY(180deg);
      }
      .face {
        grid-area: 1 / 1;
        min-width: 0;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        /* Panels can be translucent (pastel/glass theme), where backdrop-filter
           defeats backface-visibility and the reverse face bleeds through.
           So we also snap opacity at the rotation midpoint — the card is
           edge-on there, so only one face is ever painted (invisible hand-off). */
        transition: opacity 0.3s step-end;
      }
      .face.back {
        transform: rotateY(180deg);
        display: flex;
        flex-direction: column;
      }
      /* the face turned away is fully hidden and not clickable/focusable */
      .face[aria-hidden='true'] {
        opacity: 0;
        pointer-events: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .flip-inner,
        .face {
          transition: none;
        }
      }

      .qc {
        position: relative;
        padding: 1.3rem 1.4rem 1.5rem;
      }

      /* ===== flip toggle (top-right, in the header) ===== */
      .flipbtn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 1.9rem;
        height: 1.9rem;
        margin: -0.3rem 0;
        padding: 0;
        border: 1px solid var(--line-strong);
        border-radius: 50%;
        background: var(--bg);
        color: var(--text-dim);
        cursor: pointer;
        transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease,
          box-shadow 0.2s ease;
      }
      .flipbtn:hover {
        color: var(--volt-ink);
        border-color: var(--volt);
        background: color-mix(in srgb, var(--volt) 8%, transparent);
        box-shadow: 0 0 16px -4px var(--volt-glow);
      }
      .flipbtn svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.9;
        stroke-linecap: round;
        stroke-linejoin: round;
        transition: transform 0.5s cubic-bezier(0.5, 0.12, 0.2, 1);
      }
      .flipbtn:hover svg {
        transform: rotate(-180deg);
      }

      /* ===== back face · manual marcaje (ultra-compact) ===== */
      .mform {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .grp {
        display: block;
      }
      .grp > .label {
        display: block;
        margin-bottom: 0.5rem;
      }
      /* toggles (left) + send button (right) share one row to save height */
      .actionrow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem 1.4rem;
        flex-wrap: wrap;
        margin-top: 1.2rem;
      }
      .toggles {
        display: flex;
        align-items: center;
        gap: 1.1rem;
        flex-wrap: wrap;
      }
      .tgl {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        min-width: 0;
      }
      .tgico {
        display: inline-flex;
        flex-shrink: 0;
        color: var(--text-faint);
      }
      .tgico svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .sendbtn {
        flex: 1;
        min-width: 12rem;
        max-width: 20rem;
      }
      .chrome {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.2rem;
      }
      .cols {
        display: grid;
        grid-template-columns: 1fr 1px 1fr;
        gap: 1.5rem;
        align-items: stretch;
      }
      .vsep {
        background: var(--line);
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
        min-width: 0;
      }

      .actions {
        display: flex;
        gap: 0.6rem;
        align-items: stretch;
      }

      /* now button */
      .nowbtn {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.9rem;
        flex: 1;
        min-width: 0;
        padding: 1.5rem 1.1rem;
        border-radius: var(--radius);
        background: var(--volt);
        border: 1px solid var(--volt);
        color: var(--on-volt);
        cursor: pointer;
        text-align: left;
        overflow: hidden;
        transition: box-shadow 0.25s ease, transform 0.08s ease, opacity 0.2s ease;
      }
      .nowbtn:hover:not(:disabled) {
        box-shadow: 0 0 30px -4px var(--volt-glow);
      }
      .nowbtn:active:not(:disabled) {
        transform: translateY(1px);
      }
      .nowbtn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      /* salida variant = outlined cyan, to read differently from entrada */
      .nowbtn.salida {
        background: transparent;
        border-color: var(--cyan);
        color: var(--cyan);
      }
      .nowbtn.salida:hover:not(:disabled) {
        box-shadow: 0 0 26px -6px var(--cyan);
      }
      .nowbtn::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(100deg, transparent 35%, rgba(255, 255, 255, 0.4) 50%, transparent 65%);
        transform: translateX(-130%);
        transition: transform 0.6s ease;
        pointer-events: none;
      }
      .nowbtn:hover:not(:disabled)::after {
        transform: translateX(130%);
      }
      .glyph {
        display: inline-flex;
        flex-shrink: 0;
      }
      .glyph svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.9;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .bbody {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        flex: 1;
        min-width: 0;
      }
      .bdir {
        font-family: var(--font-mono);
        font-size: 0.92rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
      .bsub {
        font-family: var(--font-mono);
        font-size: 0.62rem;
        letter-spacing: 0.06em;
        opacity: 0.8;
      }
      .btime {
        font-size: 1.2rem;
        font-weight: 500;
        letter-spacing: -0.01em;
      }

      /* "forgot to clock in" mini button */
      .forgotbtn {
        flex: 0 0 9.5rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.2rem;
        padding: 1.5rem 1.1rem;
        background: transparent;
        border: 1px solid var(--line-strong);
        border-radius: var(--radius);
        color: var(--text-dim);
        text-align: left;
        cursor: pointer;
        transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease;
      }
      .forgotbtn:hover:not(:disabled) {
        color: var(--volt-ink);
        border-color: var(--volt);
        background: color-mix(in srgb, var(--volt) 6%, transparent);
      }
      .forgotbtn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .fg-ico {
        display: inline-flex;
      }
      .fg-ico svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .fg-t {
        font-size: 0.72rem;
        font-weight: 600;
        line-height: 1.2;
      }
      .fg-sub {
        font-size: 0.6rem;
        letter-spacing: 0.04em;
        color: var(--text-faint);
      }
      .forgotbtn:hover:not(:disabled) .fg-sub {
        color: var(--volt-ink);
      }
      .teletog {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      /* segmented toggle (compact) */
      .seg {
        display: inline-grid;
        grid-auto-flow: column;
        border: 1px solid var(--line-strong);
        border-radius: var(--radius);
        overflow: hidden;
      }
      .seg button {
        padding: 0.4rem 0.85rem;
        background: transparent;
        border: none;
        color: var(--text-dim);
        font-family: var(--font-mono);
        font-size: 0.66rem;
        letter-spacing: 0.1em;
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

      /* day column */
      .colhead {
        display: block;
      }
      .dayrow {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
      }
      .datef {
        width: 11.5rem;
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
      .day .btn {
        margin-top: auto;
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

      @media (max-width: 720px) {
        .cols {
          grid-template-columns: 1fr;
          gap: 1.3rem;
        }
        .vsep {
          height: 1px;
        }
      }

      /* ===== confirm dialog (native <dialog>, top layer) ===== */
      .cf-dialog {
        position: fixed;
        inset: 0;
        margin: auto;
        width: calc(100% - 3rem);
        max-width: 24rem;
        height: fit-content;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--text);
        overflow: visible;
      }
      .cf-dialog::backdrop {
        background: color-mix(in srgb, #000 55%, transparent);
        backdrop-filter: blur(2px);
        animation: cf-fade 0.18s ease;
      }
      .cf {
        position: relative;
        width: 100%;
        padding: 1.5rem 1.5rem 1.3rem;
        background: var(--bg-3);
        border: 1px solid var(--line-strong);
        border-radius: var(--radius);
        box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.7), 0 0 0 1px var(--line);
        animation: cf-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .cf::before {
        content: '';
        position: absolute;
        top: -1px;
        left: -1px;
        width: 12px;
        height: 12px;
        border-top: 1px solid var(--cyan);
        border-left: 1px solid var(--cyan);
      }
      .cf-ico {
        display: inline-flex;
        color: var(--cyan);
        margin-bottom: 0.7rem;
      }
      .cf-ico svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .cf-title {
        font-size: 1.02rem;
        font-weight: 600;
        margin: 0 0 0.5rem;
      }
      .cf-body {
        margin: 0 0 1.3rem;
        font-size: 0.82rem;
        line-height: 1.55;
        color: var(--text-dim);
      }
      .cf-body b {
        color: var(--text);
        font-weight: 600;
      }
      .cf-actions {
        display: flex;
        gap: 0.6rem;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      @keyframes cf-fade {
        from { opacity: 0; }
      }
      @keyframes cf-in {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.97);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .cf-backdrop,
        .cf {
          animation: none;
        }
      }
    `,
  ],
})
export class QuickClock implements OnDestroy {
  /** Current status from the dashboard: true => clocked in (next = salida). */
  readonly working = input(false);
  /** Local date keys ("YYYY-MM-DD") that already have marcajes, for warnings. */
  readonly markedDays = input<Set<string>>(new Set());
  /** Emitted after a successful post so the parent reloads the week. */
  readonly changed = output<void>();

  private api = inject(MarcajesService);
  private toasts = inject(ToastService);
  private settings = inject(SettingsService);

  protected schedules = this.settings.schedules;
  protected dia = localDateString();
  protected nowBusy = signal(false);
  protected dayBusy = signal(false);
  protected forgotBusy = signal(false);
  protected progress = signal('Enviando');
  /** Pending confirmation (future date / day already clocked), or null. */
  protected confirm = signal<Confirm | null>(null);
  private cfDlg = viewChild<ElementRef<HTMLDialogElement>>('cfDlg');

  /** Flip state: false => quick clock-in face, true => manual marcaje face. */
  protected manual = computed(() => this.settings.prefs().quickManualMode);

  // ---- manual marcaje (back face) form state ----
  protected fecha = localDateTimeString();
  protected sentido = signal<Sentido>('ENTRADA');
  protected mtele = signal(false);
  protected mBusy = signal(false);
  /** True once the user hand-picks a sentido, so we stop auto-prefilling it. */
  private sentidoTouched = false;

  constructor() {
    // Default the manual sentido to whatever "fichar ahora" would post next,
    // until the user overrides it.
    effect(() => {
      const w = this.working();
      if (!this.sentidoTouched) this.sentido.set(w ? 'SALIDA' : 'ENTRADA');
    });

    // Drive the native <dialog> from the confirm() signal.
    effect(() => {
      const dlg = this.cfDlg()?.nativeElement;
      if (!dlg) return;
      const open = !!this.confirm();
      if (open && !dlg.open) dlg.showModal();
      else if (!open && dlg.open) dlg.close();
    });
  }

  private nowTick = signal(Date.now());
  private timer = setInterval(() => this.nowTick.set(Date.now()), 15_000);
  protected nowTime = computed(() => formatTime(new Date(this.nowTick())));

  protected tele = computed(() => this.settings.prefs().quickTeletrabajo);

  protected scheduleKey = computed(() => {
    const list = this.schedules();
    const picked = this.settings.prefs().quickScheduleKey;
    if (picked && list.some((h) => h.key === picked)) return picked;
    return list[0]?.key ?? '';
  });
  protected selected = computed(
    () => this.schedules().find((h) => h.key === this.scheduleKey()) ?? null,
  );

  /**
   * The scheduled marcaje to backfill: the last one of the matching sentido.
   * Null when the schedule lacks it, or when its time is still in the future
   * (you can't have *forgotten* to clock something that hasn't happened yet).
   */
  protected forgotTarget = computed(() => {
    const sched = this.selected();
    if (!sched) return null;
    const sentido: Sentido = this.working() ? 'SALIDA' : 'ENTRADA';
    const match = [...sched.marcajes].reverse().find((m) => m.sentido === sentido);
    if (!match) return null;

    const now = new Date(this.nowTick());
    const scheduled = new Date(now);
    scheduled.setHours(match.hour, match.minute, 0, 0);
    if (scheduled.getTime() > now.getTime()) return null; // proposed time still ahead

    return { sentido, hour: match.hour, minute: match.minute };
  });

  protected setTele(v: boolean) {
    this.settings.setPref('quickTeletrabajo', v);
  }
  protected setSchedule(key: string) {
    this.settings.setPref('quickScheduleKey', key);
  }

  protected pad(n: number) {
    return n.toString().padStart(2, '0');
  }
  protected forgotTitle() {
    const t = this.forgotTarget();
    if (!t) return 'El horario seleccionado no define ese marcaje';
    const s = t.sentido === 'SALIDA' ? 'salida' : 'entrada';
    return `Fichar la ${s} de hoy a las ${this.pad(t.hour)}:${this.pad(t.minute)} (del horario seleccionado)`;
  }

  protected async ficharAhora() {
    if (this.nowBusy()) return;
    const sentido = this.working() ? 'SALIDA' : 'ENTRADA';
    this.nowBusy.set(true);
    try {
      await this.api.post(new Date(), sentido, this.tele());
      this.toasts.success(`${sentido === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada · ${this.nowTime()}`);
      this.changed.emit();
    } catch (err) {
      this.toasts.error((err as Error).message);
    } finally {
      this.nowBusy.set(false);
    }
  }

  /** Human-readable label of the picked day, for the confirmation dialog.
   *  A plain method (not computed) because `dia` is a template field, not a signal. */
  protected diaLabel(): string {
    const v = this.dia;
    if (!v) return '';
    const [y, m, d] = v.split('-').map(Number);
    if (!y) return v;
    const s = new Date(y, m - 1, d).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Whether "YYYY-MM-DD" is a day after today (day-level, ignoring time). */
  private isFutureDay(dateStr: string): boolean {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y) return false;
    const day = new Date(y, m - 1, d).getTime();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return day > today.getTime();
  }

  /** Human-readable label of the manual date+time, for the dialog. */
  private fechaLabel(): string {
    const v = this.fecha;
    if (!v) return '';
    const s = new Date(v).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
    const t = v.split('T')[1]?.slice(0, 5) ?? '';
    return `${s.charAt(0).toUpperCase() + s.slice(1)}${t ? ' · ' + t : ''}`;
  }

  private ask(title: string, body: string, action: () => void) {
    this.confirm.set({ title, body, action });
  }
  protected closeConfirm() {
    this.confirm.set(null);
  }
  protected runConfirm() {
    const c = this.confirm();
    this.confirm.set(null);
    c?.action();
  }
  /** Close when the click lands on the backdrop (the dialog element itself). */
  protected onBackdropClick(e: MouseEvent, dlg: HTMLDialogElement) {
    if (e.target === dlg) this.closeConfirm();
  }

  protected ficharDia() {
    if (this.dayBusy() || !this.scheduleKey()) return;
    if (!this.dia) {
      this.toasts.error('Selecciona un día');
      return;
    }
    // Future day takes precedence; otherwise warn if the day is already clocked.
    if (this.isFutureDay(this.dia)) {
      this.ask(
        'Vas a fichar un día futuro',
        `${this.diaLabel()} aún no ha ocurrido. Se registrarán marcajes con fecha futura. ¿Fichar de todos modos?`,
        () => this.doFicharDia(),
      );
      return;
    }
    if (this.markedDays().has(this.dia)) {
      this.ask(
        'Este día ya tiene marcajes',
        `${this.diaLabel()} ya contiene marcajes. Fichar el día completo añadirá más marcajes y podría duplicar la jornada. ¿Continuar de todos modos?`,
        () => this.doFicharDia(),
      );
      return;
    }
    void this.doFicharDia();
  }

  private async doFicharDia() {
    let list;
    try {
      list = this.api.buildDay(this.dia, this.scheduleKey());
    } catch (err) {
      this.toasts.error((err as Error).message);
      return;
    }
    this.dayBusy.set(true);
    this.progress.set(`0 / ${list.length}`);
    try {
      const sent = await this.api.postSequential(list, (s, t) => this.progress.set(`${s} / ${t}`));
      this.toasts.success(`Día fichado · ${sent} marcajes`);
      this.changed.emit();
    } catch (err) {
      this.toasts.error((err as Error).message);
    } finally {
      this.dayBusy.set(false);
      this.progress.set('Enviando');
    }
  }

  /**
   * Backfill a forgotten marcaje: posts the matching marcaje of the selected
   * schedule at its scheduled time (today), randomized like a full day —
   * a single delta d ∈ [min, max] applied as ∓d/2 by sentido.
   */
  protected async ficharOlvido() {
    if (this.forgotBusy()) return;
    const t = this.forgotTarget();
    if (!t) {
      this.toasts.error('El horario seleccionado no define ese marcaje');
      return;
    }
    this.forgotBusy.set(true);
    try {
      const { min, max } = this.settings.randomness();
      const delta = min + Math.random() * (max - min);
      const offsetMin = (t.sentido === 'SALIDA' ? 1 : -1) * (delta / 2);
      const when = new Date();
      when.setHours(t.hour, t.minute, 0, 0);
      when.setTime(when.getTime() + offsetMin * 60000);

      await this.api.post(when, t.sentido, this.tele());
      this.toasts.success(
        `${t.sentido === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada · ${formatTime(when)}`,
      );
      this.changed.emit();
    } catch (err) {
      this.toasts.error((err as Error).message);
    } finally {
      this.forgotBusy.set(false);
    }
  }

  protected toggleManual() {
    this.settings.setPref('quickManualMode', !this.manual());
  }

  protected setSentido(s: Sentido) {
    this.sentidoTouched = true;
    this.sentido.set(s);
  }

  /** Validate + warn about future timestamps before posting the manual marcaje. */
  protected sendManual() {
    if (this.mBusy()) return;
    if (!this.fecha) {
      this.toasts.error('Selecciona fecha y hora');
      return;
    }
    if (new Date(this.fecha).getTime() > Date.now()) {
      this.ask(
        'Vas a fichar en el futuro',
        `El marcaje (${this.fechaLabel()}) es posterior a ahora. ¿Enviar de todos modos?`,
        () => this.doSendManual(),
      );
      return;
    }
    void this.doSendManual();
  }

  private async doSendManual() {
    this.mBusy.set(true);
    try {
      await this.api.postFromLocalString(this.fecha, this.sentido(), this.mtele());
      this.toasts.success(`Marcaje ${this.sentido().toLowerCase()} enviado`);
      this.changed.emit();
    } catch (err) {
      this.toasts.error((err as Error).message);
    } finally {
      this.mBusy.set(false);
    }
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}

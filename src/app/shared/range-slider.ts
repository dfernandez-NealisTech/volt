import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

/**
 * Stylized dual-thumb range slider (noir/volt). Two overlaid native range
 * inputs keep it accessible & keyboard-friendly; the fill + thumbs are styled.
 */
@Component({
  selector: 'volt-range',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs">
      <div class="rail"></div>
      <div class="fill" [style.left.%]="lowPct()" [style.right.%]="100 - highPct()"></div>

      <!-- zero baseline tick -->
      @if (showZero() && min() < 0 && max() > 0) {
        <span class="zero" [style.left.%]="zeroPct()"></span>
      }

      <input
        type="range"
        class="inp"
        [min]="min()"
        [max]="max()"
        [step]="step()"
        [value]="low()"
        [attr.aria-label]="lowLabel()"
        (input)="onLow($event)"
      />
      <input
        type="range"
        class="inp"
        [min]="min()"
        [max]="max()"
        [step]="step()"
        [value]="high()"
        [attr.aria-label]="highLabel()"
        (input)="onHigh($event)"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .rs {
        position: relative;
        height: 2.4rem;
      }
      .rail,
      .fill {
        position: absolute;
        top: 50%;
        height: 3px;
        transform: translateY(-50%);
        pointer-events: none;
      }
      .rail {
        left: 0;
        right: 0;
        background: var(--line-strong);
      }
      .fill {
        background: var(--volt);
        box-shadow: 0 0 12px -1px var(--volt-glow);
      }
      .zero {
        position: absolute;
        top: 50%;
        width: 1px;
        height: 12px;
        transform: translate(-50%, -50%);
        background: var(--text-faint);
        pointer-events: none;
      }
      .inp {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        background: transparent;
        -webkit-appearance: none;
        appearance: none;
        pointer-events: none; /* only thumbs are interactive */
      }
      .inp:focus-visible {
        outline: none;
      }
      /* WebKit thumb */
      .inp::-webkit-slider-thumb {
        -webkit-appearance: none;
        pointer-events: auto;
        width: 16px;
        height: 16px;
        background: var(--bg);
        border: 2px solid var(--volt);
        box-shadow: 0 0 10px -2px var(--volt-glow);
        cursor: grab;
        transition: transform 0.1s ease, box-shadow 0.2s ease, background 0.2s ease;
      }
      .inp::-webkit-slider-thumb:hover {
        transform: scale(1.15);
      }
      .inp::-webkit-slider-thumb:active {
        cursor: grabbing;
        background: var(--volt);
        box-shadow: 0 0 18px 0 var(--volt-glow);
      }
      .inp:focus-visible::-webkit-slider-thumb {
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--volt) 30%, transparent);
      }
      /* Firefox thumb */
      .inp::-moz-range-thumb {
        pointer-events: auto;
        width: 16px;
        height: 16px;
        border-radius: 0;
        background: var(--bg);
        border: 2px solid var(--volt);
        box-shadow: 0 0 10px -2px var(--volt-glow);
        cursor: grab;
      }
      .inp::-moz-range-track {
        background: transparent;
      }
    `,
  ],
})
export class RangeSlider {
  readonly min = input(0);
  readonly max = input(100);
  readonly step = input(1);
  readonly low = model(0);
  readonly high = model(100);
  readonly showZero = input(true);
  readonly lowLabel = input('Mínimo');
  readonly highLabel = input('Máximo');

  protected lowPct = computed(() => this.pct(this.low()));
  protected highPct = computed(() => this.pct(this.high()));
  protected zeroPct = computed(() => this.pct(0));

  private pct(v: number): number {
    const span = this.max() - this.min();
    return span <= 0 ? 0 : ((v - this.min()) / span) * 100;
  }

  protected onLow(e: Event) {
    const v = +(e.target as HTMLInputElement).value;
    this.low.set(Math.min(v, this.high()));
  }

  protected onHigh(e: Event) {
    const v = +(e.target as HTMLInputElement).value;
    this.high.set(Math.max(v, this.low()));
  }
}

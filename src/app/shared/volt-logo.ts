import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** VOLT lightning glyph + optional wordmark. */
@Component({
  selector: 'volt-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-2.5 select-none" [style.height.px]="size()">
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        viewBox="0 0 24 24"
        class="bolt shrink-0"
        aria-hidden="true"
      >
        <path d="M13 2 L4 14 h6 l-1 8 9-12 h-6 z" />
      </svg>
      @if (word()) {
        <span
          class="font-semibold tracking-[0.32em] leading-none"
          [style.fontSize.px]="size() * 0.62"
        >
          VOLT
        </span>
      }
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .bolt path {
        fill: var(--volt);
        filter: drop-shadow(0 0 6px var(--volt-glow));
      }
      span {
        color: var(--text);
      }
    `,
  ],
})
export class VoltLogo {
  readonly size = input(22);
  readonly word = input(true);
}

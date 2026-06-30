import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed bottom-5 right-5 z-[1200] flex flex-col gap-2.5 max-w-[min(92vw,360px)]">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast rise" [attr.data-kind]="t.kind" role="status" (click)="toasts.dismiss(t.id)">
          <span class="bar"></span>
          <span class="ico" aria-hidden="true">
            @switch (t.kind) {
              @case ('error') { ✕ }
              @case ('info') { i }
              @default { ✓ }
            }
          </span>
          <span class="msg">{{ t.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.8rem 1rem 0.8rem 1.1rem;
        background: var(--bg-3);
        border: 1px solid var(--line-strong);
        color: var(--text);
        font-size: 0.85rem;
        cursor: pointer;
        overflow: hidden;
        box-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.6);
      }
      .bar {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--volt);
      }
      .toast[data-kind='error'] .bar {
        background: var(--danger);
      }
      .toast[data-kind='info'] .bar {
        background: var(--cyan);
      }
      .ico {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        width: 1.4rem;
        height: 1.4rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--line-strong);
        color: var(--volt-ink);
        flex-shrink: 0;
      }
      .toast[data-kind='error'] .ico {
        color: var(--danger);
      }
      .toast[data-kind='info'] .ico {
        color: var(--cyan);
      }
      .msg {
        line-height: 1.35;
      }
    `,
  ],
})
export class ToastHost {
  protected toasts = inject(ToastService);
}

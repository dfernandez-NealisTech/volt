import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHost } from './shared/toast-host';
import { AnalyticsService } from './core/analytics.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastHost],
  template: `
    <router-outlet />
    <toast-host />
  `,
})
export class App {
  constructor() {
    inject(AnalyticsService).init();
  }
}

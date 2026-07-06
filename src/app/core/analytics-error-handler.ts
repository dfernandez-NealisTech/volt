import { ErrorHandler, Injectable, inject } from '@angular/core';
import { AnalyticsService } from './analytics.service';

/**
 * Global error handler that records uncaught errors as an `app_error` event
 * before logging them. Paired with `provideBrowserGlobalErrorListeners`, this
 * also catches window `error` / `unhandledrejection`. Tracking is best-effort
 * and never allowed to mask the original error in the console.
 */
@Injectable()
export class AnalyticsErrorHandler implements ErrorHandler {
  private analytics = inject(AnalyticsService);

  handleError(error: unknown): void {
    try {
      const msg = error instanceof Error ? error.message : String(error);
      this.analytics.track('app_error', { msg: msg.slice(0, 200) });
    } catch {
      /* never let analytics swallow the real error */
    }
    console.error(error);
  }
}

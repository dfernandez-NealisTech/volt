import { Injectable, computed, inject, signal } from '@angular/core';
import { MarcajesService } from './marcajes.service';
import { ToastService } from './toast.service';
import { Marcaje } from './models';
import { localDateString } from './date-utils';

/**
 * Shared state for the bulk-clock page: one recent-marcajes fetch feeding every
 * card (day picker, auto-fill, coverage). Cards read {@link markedDays} to know
 * which days are already clocked and call {@link reload} after posting so the
 * whole page refreshes together.
 */
@Injectable({ providedIn: 'root' })
export class BulkClockService {
  private api = inject(MarcajesService);
  private toasts = inject(ToastService);

  /** Recent marcajes window (newest first). */
  readonly marcajes = signal<Marcaje[]>([]);
  readonly loading = signal(false);

  /** Local date keys ("YYYY-MM-DD") that already have at least one marcaje. */
  readonly markedDays = computed(() => {
    const set = new Set<string>();
    for (const m of this.marcajes()) set.add(localDateString(new Date(m.fecha)));
    return set;
  });

  private loaded = false;
  private inflight: Promise<void> | null = null;

  /** Fetch once; concurrent callers share the in-flight request. */
  async reload(size = 500): Promise<void> {
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      this.loading.set(true);
      try {
        this.marcajes.set(await this.api.fetchAll(size));
        this.loaded = true;
      } catch (err) {
        this.toasts.error((err as Error).message);
      } finally {
        this.loading.set(false);
      }
    })();
    try {
      await this.inflight;
    } finally {
      this.inflight = null;
    }
  }

  /** Trigger the initial load if it hasn't happened yet. */
  ensureLoaded() {
    if (!this.loaded) void this.reload();
  }
}

import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ANALYTICS, analyticsEnabled } from './analytics.config';

const ANON_KEY = 'volt-anon-id';

interface EventRow {
  anon_id: string;
  session_id: string;
  name: string;
  path: string | null;
  props: Record<string, unknown>;
  client_ts: string;
  app_version: string;
}

/**
 * Fire-and-forget anonymous analytics. Buffers atomic events and flushes them
 * to Supabase (PostgREST) in batches. Fully anonymous: identity is a random
 * per-device token in localStorage, never linked to the Lupe/Nunsys login.
 *
 * Everything is wrapped so a network/config failure can never break the app.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);
  private readonly anonId = this.getOrCreateAnonId();
  private readonly sessionId = safeUuid();
  private readonly currentPath = signal('');
  private queue: EventRow[] = [];
  private started = false;
  private snapshotSources: Array<() => Record<string, unknown>> = [];

  /** Wire router pageviews, click autocapture and flush timers. Idempotent. */
  init(): void {
    if (this.started || !analyticsEnabled()) return;
    this.started = true;

    // SPA pageviews don't fire naturally — derive them from the router.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentPath.set(e.urlAfterRedirects);
        this.track('pageview', {});
      });

    if (ANALYTICS.autocaptureClicks) {
      document.addEventListener('click', (e) => this.captureClick(e), { capture: true });
    }

    // Periodic anonymous state snapshot: one now, then every N minutes,
    // regardless of visibility. Each snapshot carries an `active` flag, so
    // active users = distinct anon_id with active=true per time bucket.
    this.snapshot();
    setInterval(() => this.snapshot(), ANALYTICS.snapshotIntervalMs);

    setInterval(() => this.flush(), ANALYTICS.flushIntervalMs);
    document.addEventListener('visibilitychange', () => {
      // Record the active⇄idle transition immediately (reliable even when the
      // periodic timer is throttled in a hidden tab), then persist it.
      this.snapshot();
      if (document.visibilityState === 'hidden') this.flush(true);
    });
    window.addEventListener('pagehide', () => this.flush(true));
  }

  /**
   * Register a contributor whose returned keys are merged into every snapshot.
   * Lets other services enrich the periodic snapshot without coupling this
   * service to them. Optional — the built-in snapshot already covers the basics.
   */
  registerSnapshot(source: () => Record<string, unknown>): void {
    this.snapshotSources.push(source);
  }

  /** Queue one atomic event. Never throws; no-ops until configured. */
  track(name: string, props: Record<string, unknown> = {}, path = this.currentPath()): void {
    if (!analyticsEnabled()) return;
    this.queue.push({
      anon_id: this.anonId,
      session_id: this.sessionId,
      name,
      path: path || null,
      props,
      client_ts: new Date().toISOString(),
      app_version: ANALYTICS.appVersion,
    });
    if (this.queue.length >= ANALYTICS.flushAt) this.flush();
  }

  /** Emit one general snapshot of anonymous user state. */
  private snapshot(): void {
    const extra: Record<string, unknown> = {};
    for (const source of this.snapshotSources) {
      try {
        Object.assign(extra, source());
      } catch {
        /* a broken contributor must not sink the snapshot */
      }
    }
    this.track('snapshot', { ...this.baseSnapshot(), ...extra });
  }

  /** Built-in snapshot fields, read straight from persisted state + environment. */
  private baseSnapshot(): Record<string, unknown> {
    const session = lsJson<{ accessToken?: string }>('volt-session');
    const schedules = lsJson<unknown[]>('volt-schedules');
    return {
      active: document.visibilityState === 'visible',
      theme: ls('volt-theme') ?? 'dark',
      palette: ls('volt-palette') ?? 'volt',
      logged_in: !!session?.accessToken,
      schedules_count: Array.isArray(schedules) ? schedules.length : null,
      randomness: lsJson('volt-randomness'),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      lang: navigator.language || null,
      tz: safeTz(),
    };
  }

  /** Delegated click capture. Records the control, never input contents. */
  private captureClick(ev: MouseEvent): void {
    const el = (ev.target as Element | null)?.closest?.(
      'button, a, [role="button"], [data-track]',
    );
    if (!el) return;
    const label =
      el.getAttribute('data-track') ||
      el.getAttribute('aria-label') ||
      (el.textContent || '').trim().slice(0, 60) ||
      null;
    this.track('click', { tag: el.tagName.toLowerCase(), id: el.id || null, label });
  }

  private flush(keepalive = false): void {
    if (!this.queue.length || !analyticsEnabled()) return;
    const batch = this.queue;
    this.queue = [];
    try {
      // PostgREST inserts an array of rows in one request. `keepalive` lets the
      // final batch survive an unload. Failures are swallowed by design.
      fetch(`${ANALYTICS.url}/rest/v1/events`, {
        method: 'POST',
        keepalive,
        headers: {
          apikey: ANALYTICS.anonKey,
          Authorization: `Bearer ${ANALYTICS.anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(batch),
      }).catch(() => {
        /* analytics must never surface errors to the user */
      });
    } catch {
      /* ignore */
    }
  }

  private getOrCreateAnonId(): string {
    try {
      let id = localStorage.getItem(ANON_KEY);
      if (!id) {
        id = safeUuid();
        localStorage.setItem(ANON_KEY, id);
      }
      return id;
    } catch {
      return safeUuid();
    }
  }
}

/** Safe localStorage string read (never throws). */
function ls(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safe localStorage JSON read (null on missing/invalid). */
function lsJson<T>(key: string): T | null {
  const raw = ls(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** IANA timezone, or null if unavailable. */
function safeTz(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/** crypto.randomUUID with a Math.random fallback for exotic environments. */
function safeUuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

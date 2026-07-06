/**
 * Supabase analytics ingestion config.
 *
 * The anon key is PUBLIC by design — it ships in the JS bundle. Safety comes
 * from Row Level Security (see `supabase/analytics.sql`), which allows INSERT
 * only. Leave `url`/`anonKey` empty to keep tracking fully disabled (the
 * service no-ops), e.g. in local dev.
 */
export const ANALYTICS = {
  /** Supabase project URL, e.g. https://xxxx.supabase.co — empty disables tracking. */
  url: 'https://tvdoxyjluikatogdxvop.supabase.co',
  /** Public anon key. Safe to expose: RLS permits INSERT only, never reads. */
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZG94eWpsdWlrYXRvZ2R4dm9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyOTk4NTEsImV4cCI6MjA5ODg3NTg1MX0.-VKLwuux9MVUCoSsC_N7BNl-H6IS_0WiOW4K3a2aVk8',
  /** Tagged on every event so you can slice by release. */
  appVersion: '0.0.0',
  /** Flush the queue at least this often (ms). */
  flushIntervalMs: 5000,
  /** Flush eagerly once the queue reaches this many events. */
  flushAt: 20,
  /** Capture every click on buttons/links/[data-track] via one delegated listener. */
  autocaptureClicks: true,
  /**
   * Emit a general "snapshot" event on this cadence (ms), regardless of tab
   * visibility. Each snapshot carries an `active` flag (visible or not), plus a
   * transition snapshot on every visibility change. Active users = distinct
   * anon_id with active=true per time bucket. Default: every 15 minutes.
   */
  snapshotIntervalMs: 15 * 60 * 1000,
  /**
   * Minimum gap (ms) between visibility-triggered snapshots, so rapid tab
   * toggling collapses into one instead of a burst of near-duplicates. The
   * periodic tick and the initial snapshot ignore this. Default: 30 s.
   */
  snapshotMinGapMs: 30 * 1000,
} as const;

/** Tracking only runs once a project URL and anon key are configured. */
export function analyticsEnabled(): boolean {
  return !!ANALYTICS.url && !!ANALYTICS.anonKey;
}

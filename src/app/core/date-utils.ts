/** Date helpers — week math + local formatting (no UTC drift). */

const pad = (n: number) => n.toString().padStart(2, '0');

/** "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">. */
export function localDateTimeString(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DD" in local time, for <input type="date">. */
export function localDateString(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday 00:00 of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday-first
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function sameWeek(a: Date, b: Date): boolean {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime();
}

/** "DD MMM – DD MMM YYYY" label for a week. */
export function weekRangeLabel(baseDate: Date): string {
  const start = startOfWeek(baseDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const s = start.toLocaleDateString('es-ES', opts);
  const e = end.toLocaleDateString('es-ES', { ...opts, year: 'numeric' });
  return `${s} – ${e}`;
}

/** Milliseconds since midnight for a Date. */
export function msSinceMidnight(d: Date): number {
  return d.getHours() * 3600e3 + d.getMinutes() * 60e3 + d.getSeconds() * 1000;
}

/** "Xh Ym" from a millisecond duration. */
export function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${pad(m)}m`;
}

/** "HH:MM" from a Date. */
export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

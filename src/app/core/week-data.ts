import { Marcaje } from './models';
import { formatTime, msSinceMidnight, sameWeek, startOfWeek } from './date-utils';

/** Timeline axis bounds (hours). */
export const AXIS_START_H = 7;
export const AXIS_END_H = 20;
const AXIS_START = AXIS_START_H * 3600e3;
const AXIS_SPAN = (AXIS_END_H - AXIS_START_H) * 3600e3;

export interface Interval {
  startMs: number;
  endMs: number;
  open: boolean; // currently-open (last ENTRADA without SALIDA)
  label: string;
  /** % offsets within the axis window, clamped 0–100. */
  leftPct: number;
  widthPct: number;
}

export interface DayRow {
  name: string;
  short: string;
  date: Date;
  isToday: boolean;
  intervals: Interval[];
  totalMs: number;
}

export interface WeekModel {
  days: DayRow[];
  weekTotalMs: number;
  maxDayMs: number;
}

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_SHORT = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

const pct = (ms: number) => ((ms - AXIS_START) / AXIS_SPAN) * 100;
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Map JS getDay() (0=Sun) to Monday-first index (0=Mon). */
const mondayIndex = (jsDay: number) => (jsDay === 0 ? 6 : jsDay - 1);

export function buildWeekModel(data: Marcaje[], baseDate: Date, now = new Date()): WeekModel {
  const weekStart = startOfWeek(baseDate);
  const events = data
    .filter((d) => sameWeek(new Date(d.fecha), baseDate))
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const days: DayRow[] = DAY_NAMES.map((name, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return {
      name,
      short: DAY_SHORT[i],
      date,
      isToday: sameDay(date, now),
      intervals: [] as Interval[],
      totalMs: 0,
    };
  });

  const pushInterval = (dayIdx: number, startMs: number, endMs: number, open: boolean, label: string) => {
    const leftPct = clamp(pct(startMs));
    const widthPct = clamp(pct(endMs)) - leftPct;
    days[dayIdx].intervals.push({ startMs, endMs, open, label, leftPct, widthPct });
  };

  for (let i = 0; i < events.length; i++) {
    const curr = events[i];
    const next = events[i + 1];
    if (curr.sentido === 'ENTRADA' && next && next.sentido === 'SALIDA') {
      const entrada = new Date(curr.fecha);
      const salida = new Date(next.fecha);
      const idx = mondayIndex(entrada.getDay());
      days[idx].totalMs += salida.getTime() - entrada.getTime();
      pushInterval(
        idx,
        msSinceMidnight(entrada),
        msSinceMidnight(salida),
        false,
        `${formatTime(entrada)} → ${formatTime(salida)}`,
      );
      i++; // consume the SALIDA
    }
  }

  // trailing open ENTRADA → now
  const last = events[events.length - 1];
  if (last && last.sentido === 'ENTRADA') {
    const entrada = new Date(last.fecha);
    const idx = mondayIndex(entrada.getDay());
    days[idx].totalMs += now.getTime() - entrada.getTime();
    pushInterval(
      idx,
      msSinceMidnight(entrada),
      msSinceMidnight(now),
      true,
      `${formatTime(entrada)} → ahora`,
    );
  }

  const weekTotalMs = days.reduce((s, d) => s + d.totalMs, 0);
  const maxDayMs = Math.max(0, ...days.map((d) => d.totalMs));
  return { days, weekTotalMs, maxDayMs };
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Hour ticks for the axis labels. */
export function axisHours(): number[] {
  const out: number[] = [];
  for (let h = AXIS_START_H; h <= AXIS_END_H; h++) out.push(h);
  return out;
}

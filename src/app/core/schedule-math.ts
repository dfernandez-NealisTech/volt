import { Horario, HorarioMarcaje, RandomnessRange } from './config';

const minutesOf = (m: HorarioMarcaje) => m.hour * 60 + m.minute;

/** Sequentially pair ENTRADA→SALIDA and return [pairs, nominalMinutes]. */
function pairs(h: Horario): { count: number; nominalMin: number } {
  let count = 0;
  let nominalMin = 0;
  const list = h.marcajes;
  for (let i = 0; i < list.length - 1; i++) {
    if (list[i].sentido === 'ENTRADA' && list[i + 1].sentido === 'SALIDA') {
      nominalMin += minutesOf(list[i + 1]) - minutesOf(list[i]);
      count++;
      i++; // consume the SALIDA
    }
  }
  return { count, nominalMin };
}

export interface TotalRange {
  pairs: number;
  nominalMs: number;
  minMs: number;
  maxMs: number;
  /** true when the schedule has an unpaired / out-of-order marcaje. */
  malformed: boolean;
}

/**
 * Resulting worked-time interval for a schedule given a randomness range.
 *
 * Each work segment's duration shifts by a value within [rand.min, rand.max]
 * minutes, so with P segments:
 *   total ∈ [nominal + P·rand.min, nominal + P·rand.max]
 */
export function totalRange(h: Horario, rand: RandomnessRange): TotalRange {
  const { count, nominalMin } = pairs(h);
  const nominalMs = nominalMin * 60000;
  const minMs = Math.max(0, (nominalMin + count * rand.min) * 60000);
  const maxMs = Math.max(0, (nominalMin + count * rand.max) * 60000);
  const usable = h.marcajes.length;
  const malformed = count * 2 !== usable || usable === 0;
  return { pairs: count, nominalMs, minMs, maxMs, malformed };
}

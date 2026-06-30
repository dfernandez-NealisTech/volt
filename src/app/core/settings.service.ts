import { Injectable, effect, signal } from '@angular/core';
import {
  DEFAULT_RANDOMNESS,
  Horario,
  HorarioMarcaje,
  RandomnessRange,
  cloneDefaultHorarios,
} from './config';

const SCHEDULES_KEY = 'volt-schedules';
const RANDOMNESS_KEY = 'volt-randomness';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly schedules = signal<Horario[]>(this.loadSchedules());
  readonly randomness = signal<RandomnessRange>(this.loadRandomness());

  constructor() {
    effect(() => {
      const s = this.schedules();
      try {
        localStorage.setItem(SCHEDULES_KEY, JSON.stringify(s));
      } catch {
        /* ignore */
      }
    });
    effect(() => {
      const r = this.randomness();
      try {
        localStorage.setItem(RANDOMNESS_KEY, JSON.stringify(r));
      } catch {
        /* ignore */
      }
    });
  }

  private loadSchedules(): Horario[] {
    try {
      const raw = localStorage.getItem(SCHEDULES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Horario[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {
      /* ignore */
    }
    return cloneDefaultHorarios();
  }

  private loadRandomness(): RandomnessRange {
    try {
      const raw = localStorage.getItem(RANDOMNESS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as RandomnessRange;
        if (typeof p?.min === 'number' && typeof p?.max === 'number') return p;
      }
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_RANDOMNESS };
  }

  getSchedule(key: string): Horario | undefined {
    return this.schedules().find((h) => h.key === key);
  }

  setRandomness(min: number, max: number) {
    this.randomness.set({ min: Math.min(min, max), max: Math.max(min, max) });
  }

  // ---- schedule mutations (immutable updates) ----

  private patch(key: string, fn: (h: Horario) => Horario) {
    this.schedules.update((list) => list.map((h) => (h.key === key ? fn(h) : h)));
  }

  updateLabel(key: string, label: string) {
    this.patch(key, (h) => ({ ...h, label }));
  }

  toggleTeletrabajo(key: string, teletrabajo: boolean) {
    this.patch(key, (h) => ({ ...h, teletrabajo }));
  }

  updateMarcaje(key: string, index: number, partial: Partial<HorarioMarcaje>) {
    this.patch(key, (h) => ({
      ...h,
      marcajes: h.marcajes.map((m, i) => (i === index ? { ...m, ...partial } : m)),
    }));
  }

  addMarcaje(key: string) {
    this.patch(key, (h) => {
      const last = h.marcajes[h.marcajes.length - 1];
      const next: HorarioMarcaje = last
        ? {
            sentido: last.sentido === 'ENTRADA' ? 'SALIDA' : 'ENTRADA',
            hour: Math.min(23, last.hour + 1),
            minute: last.minute,
          }
        : { sentido: 'ENTRADA', hour: 9, minute: 0 };
      return { ...h, marcajes: [...h.marcajes, next] };
    });
  }

  removeMarcaje(key: string, index: number) {
    this.patch(key, (h) => ({
      ...h,
      marcajes: h.marcajes.filter((_, i) => i !== index),
    }));
  }

  addSchedule() {
    const key = `custom-${Date.now().toString(36)}`;
    const fresh: Horario = {
      key,
      label: 'Nuevo horario',
      short: 'NUEVO',
      teletrabajo: false,
      marcajes: [
        { sentido: 'ENTRADA', hour: 9, minute: 0 },
        { sentido: 'SALIDA', hour: 17, minute: 0 },
      ],
    };
    this.schedules.update((list) => [...list, fresh]);
    return key;
  }

  removeSchedule(key: string) {
    this.schedules.update((list) => list.filter((h) => h.key !== key));
  }

  resetSchedules() {
    this.schedules.set(cloneDefaultHorarios());
  }

  resetRandomness() {
    this.randomness.set({ ...DEFAULT_RANDOMNESS });
  }
}

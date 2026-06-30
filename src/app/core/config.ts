/** API endpoints (Lupe / Nunsys) — preserved from the PoC. */
export const API = {
  base: 'https://lupe.nunsys.com/api',
  auth: 'https://lupe.nunsys.com/api/webapp/authenticate',
  marcajes: 'https://lupe.nunsys.com/api/marcajes',
  account: 'https://lupe.nunsys.com/api/account',
  usuarios: 'https://lupe.nunsys.com/api/usuarios',
} as const;

/** causaId the API expects when a marcaje is teletrabajo. */
export const CAUSA_ID_TELETRABAJO = 163820270;
export const METODO_MARCAJE_ID = 3;
export const TIMEZONE = 'Europe/Madrid';

export type Sentido = 'ENTRADA' | 'SALIDA';

export interface HorarioMarcaje {
  sentido: Sentido;
  hour: number;
  minute: number;
}

export interface Horario {
  key: string;
  label: string;
  short: string;
  teletrabajo: boolean;
  marcajes: HorarioMarcaje[];
}

/** Per-segment randomness applied to a full day, in minutes. */
export interface RandomnessRange {
  min: number;
  max: number;
}

export const DEFAULT_RANDOMNESS: RandomnessRange = { min: -5, max: 5 };

/** Hard bounds for the randomness sliders (minutes). */
export const RANDOMNESS_BOUNDS = { min: -30, max: 30 } as const;

/**
 * Default day schedules. Hours are local time (Europe/Madrid).
 * Used as the seed for the editable settings.
 */
export const DEFAULT_HORARIOS: Horario[] = [
  {
    key: 'normal',
    label: 'Normal',
    short: 'NORMAL',
    teletrabajo: false,
    marcajes: [
      { sentido: 'ENTRADA', hour: 8, minute: 0 },
      { sentido: 'SALIDA', hour: 14, minute: 0 },
      { sentido: 'ENTRADA', hour: 14, minute: 45 },
      { sentido: 'SALIDA', hour: 17, minute: 30 },
    ],
  },
  {
    key: 'teletrabajo',
    label: 'Teletrabajo',
    short: 'REMOTO',
    teletrabajo: true,
    marcajes: [
      { sentido: 'ENTRADA', hour: 7, minute: 45 },
      { sentido: 'SALIDA', hour: 14, minute: 0 },
      { sentido: 'ENTRADA', hour: 14, minute: 45 },
      { sentido: 'SALIDA', hour: 17, minute: 15 },
    ],
  },
  {
    key: 'viernes',
    label: 'Viernes / verano',
    short: 'VIERNES',
    teletrabajo: false,
    marcajes: [
      { sentido: 'ENTRADA', hour: 8, minute: 0 },
      { sentido: 'SALIDA', hour: 14, minute: 30 },
    ],
  },
];

/** Deep clone of the default schedules (so edits never mutate the seed). */
export function cloneDefaultHorarios(): Horario[] {
  return DEFAULT_HORARIOS.map((h) => ({
    ...h,
    marcajes: h.marcajes.map((m) => ({ ...m })),
  }));
}

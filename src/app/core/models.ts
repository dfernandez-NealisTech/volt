import { Sentido } from './config';

/** A clock-in/out record as returned by the API. */
export interface Marcaje {
  id?: number;
  fecha: string; // ISO timestamp
  sentido: Sentido;
  causaId?: number | null;
  personalId?: number;
  metodoMarcajeId?: number;
  zonaHoraria?: string;
}

export interface Session {
  accessToken: string;
  userId: number | null;
  personalId: number | null;
}

/** Built locally for the "full day" feature before posting. */
export interface PendingMarcaje {
  sentido: Sentido;
  date: Date;
  teletrabajo: boolean;
}

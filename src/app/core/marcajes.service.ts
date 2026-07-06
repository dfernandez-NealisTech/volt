import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  API,
  CAUSA_ID_TELETRABAJO,
  METODO_MARCAJE_ID,
  Sentido,
  TIMEZONE,
} from './config';
import { Marcaje, PendingMarcaje } from './models';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';
import { AnalyticsService } from './analytics.service';

@Injectable({ providedIn: 'root' })
export class MarcajesService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private settings = inject(SettingsService);
  private analytics = inject(AnalyticsService);

  /** Recent marcajes (newest first). `size` widens the window when needed. */
  async fetchAll(size = 50): Promise<Marcaje[]> {
    this.analytics.track('consulta_marcajes', { size });
    return firstValueFrom(
      this.http.get<Marcaje[]>(`${API.marcajes}?page=0&size=${size}&sort=fecha,desc`, {
        headers: this.auth.authHeaders(),
      }),
    ).catch(() => {
      this.analytics.track('consulta_fallida', {});
      throw new Error('No se pudieron obtener los marcajes');
    });
  }

  /**
   * Post a single marcaje from a Date (local). Random seconds/ms keep each
   * POST unique, mirroring the PoC behaviour.
   */
  async post(date: Date, sentido: Sentido, teletrabajo: boolean): Promise<Marcaje> {
    const stamped = new Date(date.getTime());
    stamped.setSeconds(Math.floor(Math.random() * 60));
    stamped.setMilliseconds(Math.floor(Math.random() * 1000));

    const body = {
      fecha: stamped.toISOString(),
      fechaLocal: null,
      sentido,
      fechaModificado: null,
      metodoMarcajeId: METODO_MARCAJE_ID,
      personalId: this.auth.personalId(),
      causaId: teletrabajo ? CAUSA_ID_TELETRABAJO : null,
      zonaHoraria: TIMEZONE,
    };

    const t0 = Date.now();
    const result = await firstValueFrom(
      this.http.post<Marcaje>(API.marcajes, body, { headers: this.auth.authHeaders() }),
    ).catch(() => {
      this.analytics.track('marcaje_fallido', { sentido, teletrabajo, ms: Date.now() - t0 });
      throw new Error('Error al enviar el marcaje');
    });
    this.analytics.track('marcaje_creado', { sentido, teletrabajo, ms: Date.now() - t0 });
    return result;
  }

  postFromLocalString(local: string, sentido: Sentido, teletrabajo: boolean) {
    return this.post(new Date(local), sentido, teletrabajo);
  }

  /**
   * Build the marcajes for a full day, applying the configured randomness.
   *
   * Each ENTRADA→SALIDA segment gets a single random delta d ∈ [min, max]
   * minutes split as −d/2 on the ENTRADA and +d/2 on the SALIDA, so the
   * segment's duration changes by exactly d. With P segments the day total
   * lands in [nominal + P·min, nominal + P·max]. Time always moves forward.
   */
  buildDay(dateStr: string, horarioKey: string): PendingMarcaje[] {
    const horario = this.settings.getSchedule(horarioKey);
    if (!horario) throw new Error(`Horario desconocido: ${horarioKey}`);

    const { min, max } = this.settings.randomness();
    const marcajes = horario.marcajes;

    // Per-marcaje offset in minutes, derived from per-segment deltas.
    const offsets = new Array(marcajes.length).fill(0);
    for (let i = 0; i < marcajes.length - 1; i++) {
      if (marcajes[i].sentido === 'ENTRADA' && marcajes[i + 1].sentido === 'SALIDA') {
        const delta = min + Math.random() * (max - min);
        offsets[i] -= delta / 2; // entrada
        offsets[i + 1] += delta / 2; // salida
        i++; // consume the SALIDA
      }
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const result: PendingMarcaje[] = [];
    let prevTime = -Infinity;

    for (let i = 0; i < marcajes.length; i++) {
      const m = marcajes[i];
      const base = new Date(year, month - 1, day, m.hour, m.minute, 0, 0);
      let t = base.getTime() + offsets[i] * 60000;
      if (t <= prevTime) t = prevTime + 1000;
      prevTime = t;
      result.push({ sentido: m.sentido, date: new Date(t), teletrabajo: horario.teletrabajo });
    }
    return result;
  }

  /** Post a list sequentially; reports progress and returns count sent. */
  async postSequential(
    list: PendingMarcaje[],
    onProgress?: (sent: number, total: number) => void,
  ): Promise<number> {
    let sent = 0;
    for (const m of list) {
      await this.post(m.date, m.sentido, m.teletrabajo);
      sent++;
      onProgress?.(sent, list.length);
    }
    this.analytics.track('dia_completo_enviado', { marcajes: sent });
    return sent;
  }
}

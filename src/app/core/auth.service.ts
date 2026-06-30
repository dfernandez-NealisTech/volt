import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API } from './config';
import { Session } from './models';

const SESSION_KEY = 'volt-session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private session = signal<Session | null>(this.loadSession());
  readonly isAuthenticated = computed(() => !!this.session()?.accessToken);
  readonly token = computed(() => this.session()?.accessToken ?? null);
  readonly personalId = computed(() => this.session()?.personalId ?? null);

  private loadSession(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }

  private saveSession(s: Session) {
    this.session.set(s);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  authHeaders(): Record<string, string> {
    const token = this.token();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Authenticate then resolve the personalId needed to post marcajes. */
  async login(username: string, password: string): Promise<void> {
    let authData: { id_token: string };
    try {
      authData = await firstValueFrom(
        this.http.post<{ id_token: string }>(API.auth, {
          username,
          password,
          rememberMe: false,
          fromWebApp: true,
        }),
      );
    } catch {
      throw new Error('Usuario o contraseña incorrectos');
    }

    const accessToken = authData.id_token;
    const headers = { Authorization: `Bearer ${accessToken}` };

    const account = await firstValueFrom(
      this.http.get<{ id: number }>(API.account, { headers }),
    ).catch(() => {
      throw new Error('No se pudo obtener el ID del usuario');
    });

    const userDetail = await firstValueFrom(
      this.http.get<{ personalId: number }>(`${API.usuarios}/${account.id}`, { headers }),
    ).catch(() => {
      throw new Error('No se pudo obtener el ID personal');
    });

    this.saveSession({
      accessToken,
      userId: account.id,
      personalId: userDetail.personalId,
    });
  }

  logout() {
    this.session.set(null);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
}

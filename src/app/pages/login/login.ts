import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { VoltLogo } from '../../shared/volt-logo';
import { ThemeToggle } from '../../shared/theme-toggle';
import { PalettePicker } from '../../shared/palette-picker';

@Component({
  selector: 'volt-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, VoltLogo, ThemeToggle, PalettePicker],
  template: `
    <div class="scene">
      <div class="corner"><palette-picker /><theme-toggle /></div>

      <!-- ambient -->
      <div class="bolt-bg" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M13 2 L4 14 h6 l-1 8 9-12 h-6 z" /></svg>
      </div>
      <div class="sparks" aria-hidden="true">
        @for (s of sparks; track s) {
          <span [style.left.%]="s.x" [style.animation-delay.s]="s.d" [style.animation-duration.s]="s.t"></span>
        }
      </div>

      <div class="card panel ticked rise">
        <div class="head">
          <volt-logo [size]="30" />
          <p class="sub label">Control de marcajes</p>
        </div>

        <div class="divider"></div>

        <form (ngSubmit)="submit()" #f="ngForm" autocomplete="on">
          <label class="grp">
            <span class="label">Usuario</span>
            <input
              class="field"
              name="username"
              [(ngModel)]="username"
              required
              autocomplete="username"
              [disabled]="loading()"
              placeholder="usuario"
            />
          </label>

          <label class="grp">
            <span class="label">Contraseña</span>
            <input
              class="field"
              name="password"
              type="password"
              [(ngModel)]="password"
              required
              autocomplete="current-password"
              [disabled]="loading()"
              placeholder="••••••••"
            />
          </label>

          <button id="login-submit" type="submit" class="btn btn-volt w-full mt-1" [disabled]="loading() || !f.valid">
            @if (loading()) {
              <span class="dots"><i></i><i></i><i></i></span>
              <span>Conectando</span>
            } @else {
              <span>Entrar</span>
              <span class="arrow">→</span>
            }
          </button>
        </form>

        <p class="hint">lupe.nunsys.com · sesión segura</p>
      </div>
    </div>
  `,
  styles: [
    `
      .scene {
        position: relative;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        overflow: hidden;
      }
      .corner {
        position: absolute;
        top: 1.2rem;
        right: 1.2rem;
        z-index: 5;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .bolt-bg {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        pointer-events: none;
      }
      .bolt-bg svg {
        width: 62vmin;
        height: 62vmin;
        opacity: 0.04;
      }
      .bolt-bg path {
        fill: var(--volt);
      }
      .sparks {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .sparks span {
        position: absolute;
        bottom: 18%;
        width: 2px;
        height: 2px;
        background: var(--volt);
        border-radius: 50%;
        box-shadow: 0 0 6px var(--volt-glow);
        animation: spark-drift linear infinite;
      }
      .card {
        position: relative;
        width: 100%;
        max-width: 380px;
        padding: 2.4rem 2.1rem 1.8rem;
        background: color-mix(in srgb, var(--bg-2) 88%, transparent);
        backdrop-filter: blur(8px);
        z-index: 2;
      }
      .head {
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
      }
      .sub {
        margin: 0;
      }
      .divider {
        margin: 1.4rem 0 1.6rem;
      }
      .grp {
        display: block;
        margin-bottom: 1.1rem;
      }
      .grp .label {
        display: block;
        margin-bottom: 0.5rem;
      }
      .arrow {
        font-size: 0.7rem;
      }
      .hint {
        margin: 1.4rem 0 0;
        text-align: center;
        font-family: var(--font-mono);
        font-size: 0.6rem;
        letter-spacing: 0.08em;
        color: var(--text-faint);
      }
      .dots {
        display: inline-flex;
        gap: 3px;
      }
      .dots i {
        width: 4px;
        height: 4px;
        background: currentColor;
        border-radius: 50%;
        animation: blink 1s infinite;
      }
      .dots i:nth-child(2) {
        animation-delay: 0.15s;
      }
      .dots i:nth-child(3) {
        animation-delay: 0.3s;
      }
      @keyframes blink {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
      }
    `,
  ],
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toasts = inject(ToastService);

  protected username = '';
  protected password = '';
  protected loading = signal(false);

  protected sparks = Array.from({ length: 14 }, (_, i) => ({
    x: (i * 37 + 7) % 100,
    d: (i % 7) * 0.6,
    t: 3 + (i % 5),
  }));

  protected async submit() {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      await this.auth.login(this.username.trim(), this.password);
      this.toasts.success('Sesión iniciada');
      this.router.navigateByUrl('/dashboard');
    } catch (err) {
      this.toasts.error((err as Error).message ?? 'Error de acceso');
    } finally {
      this.loading.set(false);
    }
  }
}

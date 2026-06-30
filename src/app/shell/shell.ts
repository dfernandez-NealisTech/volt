import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { VoltLogo } from '../shared/volt-logo';
import { ThemeToggle } from '../shared/theme-toggle';
import { PalettePicker } from '../shared/palette-picker';

@Component({
  selector: 'volt-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, VoltLogo, ThemeToggle, PalettePicker],
  template: `
    <div class="layout">
      <!-- ===== rail ===== -->
      <aside class="rail">
        <div class="brand">
          <volt-logo [size]="22" />
          <span class="status" title="Sesión activa"></span>
        </div>

        <nav class="nav">
          @for (item of nav; track item.path) {
            <a
              class="navitem"
              [routerLink]="item.path"
              routerLinkActive="active"
              #rla="routerLinkActive"
            >
              <span class="ind"></span>
              <span class="ico">
                @switch (item.path) {
                  @case ('/dashboard') {
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 12h4l2 6 4-14 2 8h6" />
                    </svg>
                  }
                  @case ('/fichar') {
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="M12 7.5V12l3 2" />
                    </svg>
                  }
                  @case ('/ajustes') {
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h11M3 12h7M3 18h13" />
                      <circle cx="18" cy="6" r="2.2" />
                      <circle cx="14" cy="12" r="2.2" />
                      <circle cx="20" cy="18" r="2.2" />
                    </svg>
                  }
                }
              </span>
              <span class="txt">{{ item.label }}</span>
              <span class="idx">{{ item.idx }}</span>
            </a>
          }
        </nav>

        <div class="foot">
          <div class="foot-controls">
            <theme-toggle />
            <palette-picker />
          </div>
          <button type="button" class="logout" (click)="logout()" title="Cerrar sesión">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M14 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
              <path d="M10 12h11M18 9l3 3-3 3" />
            </svg>
            <span>SALIR</span>
          </button>
        </div>
      </aside>

      <!-- ===== content ===== -->
      <main class="content">
        <div class="inner">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
      }
      .layout {
        display: grid;
        grid-template-columns: 232px 1fr;
        min-height: 100dvh;
      }
      .rail {
        position: sticky;
        top: 0;
        height: 100dvh;
        display: flex;
        flex-direction: column;
        padding: 1.5rem 1.1rem;
        border-right: 1px solid var(--line);
        background: color-mix(in srgb, var(--bg-2) 60%, transparent);
        backdrop-filter: blur(6px);
      }
      .brand {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 0.4rem 1.3rem;
        margin-bottom: 0.5rem;
        border-bottom: 1px solid var(--line);
      }
      .status {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--volt);
        box-shadow: 0 0 8px var(--volt-glow);
        animation: pulse-glow 1.8s ease-in-out infinite;
      }
      .nav {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        margin-top: 1rem;
        flex: 1;
      }
      .navitem {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.7rem 0.7rem;
        font-family: var(--font-mono);
        font-size: 0.72rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-dim);
        text-decoration: none;
        transition: color 0.2s ease, background 0.2s ease;
      }
      .navitem:hover {
        color: var(--text);
        background: color-mix(in srgb, var(--volt) 6%, transparent);
      }
      .navitem.active {
        color: var(--volt-ink);
        background: color-mix(in srgb, var(--volt) 9%, transparent);
      }
      .ind {
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%) scaleY(0);
        width: 2px;
        height: 60%;
        background: var(--volt);
        box-shadow: 0 0 8px var(--volt-glow);
        transition: transform 0.2s ease;
      }
      .navitem.active .ind {
        transform: translateY(-50%) scaleY(1);
      }
      .ico {
        display: inline-flex;
        color: currentColor;
      }
      .txt {
        flex: 1;
      }
      .idx {
        font-size: 0.6rem;
        color: var(--text-faint);
      }
      .foot {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.6rem;
        padding-top: 1rem;
        border-top: 1px solid var(--line);
      }
      .foot-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .logout {
        width: 100%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        height: 2.3rem;
        border: 1px solid var(--line-strong);
        background: transparent;
        color: var(--text-dim);
        font-family: var(--font-mono);
        font-size: 0.66rem;
        letter-spacing: 0.14em;
        cursor: pointer;
        transition: color 0.2s ease, border-color 0.2s ease;
      }
      .logout:hover {
        color: var(--danger);
        border-color: var(--danger);
      }
      .logout svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .content {
        min-width: 0;
        padding: 2.4rem clamp(1.2rem, 4vw, 3.2rem) 2rem;
      }
      .inner {
        max-width: 1080px;
        margin: 0 auto;
      }

      /* ---- mobile ---- */
      @media (max-width: 760px) {
        .layout {
          grid-template-columns: 1fr;
        }
        .rail {
          position: sticky;
          top: 0;
          height: auto;
          flex-direction: row;
          align-items: center;
          padding: 0.8rem 1rem;
          z-index: 50;
        }
        .brand {
          border-bottom: none;
          padding: 0;
          margin: 0 0.5rem 0 0;
        }
        .status {
          display: none;
        }
        .nav {
          flex-direction: row;
          margin: 0;
          gap: 0.2rem;
          flex: 1;
          justify-content: center;
        }
        .navitem {
          padding: 0.5rem 0.6rem;
        }
        .navitem .txt,
        .navitem .idx {
          display: none;
        }
        .ind {
          left: 50%;
          top: auto;
          bottom: 0;
          transform: translateX(-50%) scaleX(0);
          width: 60%;
          height: 2px;
        }
        .navitem.active .ind {
          transform: translateX(-50%) scaleX(1);
        }
        .foot {
          flex-direction: row;
          align-items: center;
          padding: 0;
          border: none;
          gap: 0.4rem;
        }
        .logout span {
          display: none;
        }
        .logout {
          width: 2.3rem;
          padding: 0;
        }
        .content {
          padding: 1.4rem 1.1rem 3rem;
        }
      }
    `,
  ],
})
export class Shell {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toasts = inject(ToastService);

  protected nav = [
    { path: '/dashboard', label: 'Semana', idx: '01' },
    { path: '/fichar', label: 'Fichar', idx: '02' },
    { path: '/ajustes', label: 'Ajustes', idx: '03' },
  ];

  protected logout() {
    this.auth.logout();
    this.toasts.info('Sesión cerrada');
    this.router.navigateByUrl('/login');
  }
}

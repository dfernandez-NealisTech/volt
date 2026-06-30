import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.DashboardPage),
      },
      {
        path: 'fichar',
        loadComponent: () => import('./pages/fichar/fichar').then((m) => m.FicharPage),
      },
      {
        path: 'ajustes',
        loadComponent: () => import('./pages/ajustes/ajustes').then((m) => m.AjustesPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * When an authenticated request comes back 401 the session token has expired
 * (or was revoked). Clear the session and bounce the user to /login. The error
 * is re-thrown so the caller's existing `.catch()` still surfaces its toast.
 *
 * The guard `auth.isAuthenticated()` keeps this from firing during the login
 * flow itself (the session isn't stored until login succeeds), so a wrong
 * password won't be mistaken for an expired token.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && auth.isAuthenticated()) {
        auth.logout('expired');
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};

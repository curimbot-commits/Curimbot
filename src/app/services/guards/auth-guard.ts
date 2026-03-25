// src/app/services/guards/auth-guard.ts

import { inject } from '@angular/core';
import {
  Router,
  CanActivateFn,
  CanActivateChildFn,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { Auth as AuthService } from '../../components/authentication/auth/auth';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/**
 * Verifica autenticación local + remota contra el backend.
 *
 * Orden de verificación:
 *   1. ¿Hay token en localStorage y no expiró localmente? → No: redirigir al login
 *   2. ¿El backend acepta el token? → GET /auth/me
 *      - 200 OK  → dejar pasar
 *      - 401/403 → limpiar sesión y redirigir al login
 *
 * El paso 2 detecta el caso donde el backend reinició (nueva SECRET_KEY,
 * blacklist limpia, etc.) y el token existe localmente pero ya no es válido.
 */
const validateUserPermissions = (user: any, url: string, router: Router): boolean => {
  // Verificar flujo 2FA pendiente
  const pending2FA = sessionStorage.getItem('temp_2fa_auth');
  if (
    user.two_factor_enabled &&
    pending2FA &&
    url !== '/twoverification'
  ) {
    router.navigate(['/twoverification'], {
      queryParams: { returnUrl: url },
      replaceUrl: true,
    });
    return false;
  }

  return true;
};

const checkAuth = (url: string): Observable<boolean> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // ── Paso 1: Verificación local rápida ────────────────────────────
  // Si no hay token o expiró localmente, no hacemos request al backend
  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], {
      queryParams: { returnUrl: url },
      replaceUrl: true,
    });
    return of(false);
  }

  // ── Paso 2: Verificar datos locales vs backend ──────────────────
  const currentUser = authService.getCurrentUser();

  // Si ya tenemos el usuario en memoria, permitimos la navegación inmediata.
  // La integridad de la sesión se valida periódicamente o en el interceptor.
  if (currentUser) {
    return of(validateUserPermissions(currentUser, url, router));
  }

  // Si no hay usuario en memoria pero sí token, lo recuperamos del backend.
  // Esto solo ocurre una vez por sesión o al recargar (F5).
  return authService.getUserProfile().pipe(
    map((user) => {
      return validateUserPermissions(user, url, router);
    }),
    catchError((err) => {
      // El backend rechazó el token:
      //   - 401: token inválido (backend reiniciado, SECRET_KEY cambiada)
      //   - 403: sin permisos
      //   - 0:   backend caído / sin conexión
      //
      // En todos los casos: limpiar sesión local y redirigir al login.
      // No llamamos a /logout porque el token ya no es válido en el backend.
      console.warn(
        `[AuthGuard] Token rechazado por el backend (status: ${err?.status}). Cerrando sesión.`
      );

      authService.clearSessionPublic();

      router.navigate(['/login'], {
        queryParams: {
          returnUrl: url,
          expired: 'true',
        },
        replaceUrl: true,
      });

      return of(false);
    })
  );
};

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> => {
  return checkAuth(state.url);
};

export const authGuardChild: CanActivateChildFn = (
  childRoute: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> => {
  return checkAuth(state.url);
};
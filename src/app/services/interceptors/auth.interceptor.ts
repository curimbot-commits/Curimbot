/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/services/interceptors/auth.interceptor.ts

import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take, finalize } from 'rxjs/operators';
import { Auth as AuthService } from '../../components/authentication/auth/auth';
import { Router } from '@angular/router';

// ==================================================================
// ESTADO COMPARTIDO DEL REFRESH (vive a nivel de módulo)
// ==================================================================

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

// ==================================================================
// ENDPOINTS PÚBLICOS
// ==================================================================

const PUBLIC_ENDPOINTS = [
  '/auth/login',
  '/auth/signup',
  '/auth/login-with-2fa',
  '/auth/health',
  '/auth/google/',
  '/auth/github/',
  '/auth/oauth/set-cookies',
];

function isPublicEndpoint(url: string): boolean {
  return PUBLIC_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

// ==================================================================
// INTERCEPTOR FUNCIONAL
// ==================================================================

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Saltar autenticación para endpoints públicos
  if (isPublicEndpoint(req.url)) {
    return next(req);
  }

  const authReq = req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          return handle401Error(authReq, next, authService, router);
        }
        if (error.status === 403) {
          return handle403Error(error, authService, router);
        }
      }
      return throwError(() => error);
    })
  );
};

// ==================================================================
// MANEJO DE 401
// ==================================================================

function handle401Error(
  request: HttpRequest<any>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router
): Observable<HttpEvent<any>> {

  if (isRefreshing) {
    return waitForTokenRefresh(request, next);
  }

  isRefreshing = true;
  refreshTokenSubject.next(null);

  return authService.refreshToken().pipe(
    switchMap(() => {
      isRefreshing = false;
      refreshTokenSubject.next('refreshed');
      return next(request.clone({ withCredentials: true }));
    }),
    catchError((err) => {
      isRefreshing = false;
      forceLogoutLocal(
        authService,
        router,
        'Tu sesión ha expirado. Por favor inicia sesión nuevamente.'
      );
      return throwError(() => err);
    }),
    finalize(() => {
      isRefreshing = false;
    })
  );
}

function waitForTokenRefresh(
  request: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> {
  return refreshTokenSubject.pipe(
    filter((token) => token !== null),
    take(1),
    switchMap(() => next(request.clone({ withCredentials: true })))
  );
}

// ==================================================================
// MANEJO DE 403
// ==================================================================

function handle403Error(
  error: HttpErrorResponse,
  authService: AuthService,
  router: Router
): Observable<never> {
  const currentUser = authService.getCurrentUser();
  if (!currentUser || !currentUser.role) {
    forceLogoutLocal(
      authService,
      router,
      'Sesión inválida. Por favor inicia sesión nuevamente.'
    );
  }
  return throwError(() => error);
}

// ==================================================================
// CIERRE DE SESIÓN LOCAL
// ==================================================================

function forceLogoutLocal(
  authService: AuthService,
  router: Router,
  message?: string
): void {
  authService.clearSessionPublic();
  router.navigate(['/login'], {
    queryParams: {
      expired: 'true',
      message: message || 'Sesión expirada',
    },
    replaceUrl: true,
  });
}
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/interceptors/auth.interceptor.ts

import { Injectable, inject } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take, finalize } from 'rxjs/operators';
import { Auth as AuthService } from '../../components/authentication/auth/auth';
import { Router } from '@angular/router';

/**
 * Interceptor HTTP para autenticación automática.
 *
 * Responsabilidades:
 *   - Agrega token JWT a todas las peticiones privadas
 *   - Intenta refrescar el token cuando el backend responde 401
 *   - Si el refresh falla → limpia sesión y redirige al login
 *   - Maneja 403 (sin permisos)
 *   - Evita múltiples refresh simultáneos con BehaviorSubject
 *
 * FIX aplicado:
 *   El forceLogout() anterior hacía POST /logout con un token ya inválido,
 *   lo que causaba otro 401 y un loop silencioso sin redirección.
 *   Ahora forceLogoutLocal() limpia la sesión localmente y redirige directo,
 *   sin hacer ninguna request adicional al backend.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  // ==================================================================
  // ESTADO DE REFRESH
  // ==================================================================

  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  // ==================================================================
  // SERVICIOS
  // ==================================================================

  private authService = inject(AuthService);
  private router = inject(Router);

  // ==================================================================
  // ENDPOINTS PÚBLICOS
  // No se agrega Authorization header en estas rutas
  // ==================================================================

  private readonly PUBLIC_ENDPOINTS = [
    '/auth/login',
    '/auth/signup',
    '/auth/login-with-2fa',
    '/auth/health',
    '/auth/google/',    // OAuth Google — no requiere token
    '/auth/github/',    // OAuth GitHub — no requiere token
  ];

  // ==================================================================
  // INTERCEPTOR PRINCIPAL
  // ==================================================================

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {

    // Saltar autenticación para endpoints públicos
    if (this.isPublicEndpoint(req.url)) {
      return next.handle(req);
    }

    // En lugar de enviar un token manual (Bearer), permitimos
    // que el navegador adjunte las cookies HttpOnly con withCredentials.
    let authReq = req.clone({
      withCredentials: true
    });

    return next.handle(authReq).pipe(
      catchError((error) => {
        if (error instanceof HttpErrorResponse) {
          if (error.status === 401) {
            return this.handle401Error(authReq, next);
          }
          if (error.status === 403) {
            return this.handle403Error(error);
          }
        }
        return throwError(() => error);
      })
    );
  }

  // ==================================================================
  // AUTENTICACIÓN
  // ==================================================================

  /**
   * Verifica si la URL es un endpoint público que no requiere token.
   */
  private isPublicEndpoint(url: string): boolean {
    return this.PUBLIC_ENDPOINTS.some((endpoint) => url.includes(endpoint));
  }

  // ==================================================================
  // MANEJO DE ERRORES
  // ==================================================================

  /**
   * Maneja errores 401 (token expirado o inválido).
   *
   * Intenta refrescar el token con el refresh token almacenado.
   * Si el refresh también falla (backend reiniciado, token revocado):
   *   → Limpia sesión localmente y redirige al login.
   *
   * Evita múltiples llamadas simultáneas al endpoint de refresh.
   */
  private handle401Error(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {

    if (this.isRefreshing) {
      return this.waitForTokenRefresh(request, next);
    }

    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    return this.authService.refreshToken().pipe(
      switchMap(() => {
        this.isRefreshing = false;
        // Indicador genérico para desbloquear solicitudes en cola
        this.refreshTokenSubject.next('refreshed');
        return next.handle(request.clone({ withCredentials: true }));
      }),
      catchError((err) => {
        this.isRefreshing = false;
        // FIX: No llamar a /logout con token inválido (causaba loop 401).
        // Limpiar localmente y redirigir directo al login.
        this.forceLogoutLocal(
          'Tu sesión ha expirado. Por favor inicia sesión nuevamente.'
        );
        return throwError(() => err);
      }),
      finalize(() => {
        this.isRefreshing = false;
      })
    );
  }

  /**
   * Espera a que termine un refresh en progreso antes de reintentar.
   * Evita que múltiples peticiones simultáneas llamen al refresh endpoint.
   */
  private waitForTokenRefresh(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return this.refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap(() =>
        next.handle(request.clone({ withCredentials: true }))
      )
    );
  }

  /**
   * Maneja errores 403 (sin permisos suficientes).
   * Si el usuario no tiene rol válido, fuerza el cierre de sesión.
   */
  private handle403Error(error: HttpErrorResponse): Observable<never> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.role) {
      this.forceLogoutLocal('Sesión inválida. Por favor inicia sesión nuevamente.');
    }
    return throwError(() => error);
  }

  // ==================================================================
  // CIERRE DE SESIÓN
  // ==================================================================

  /**
   * Cierra la sesión limpiando el estado local y redirige al login.
   *
   * FIX: A diferencia del forceLogout() anterior, este método NO hace
   * POST /auth/logout al backend. Esa llamada requiere un token válido,
   * y si llegamos aquí es porque el token ya fue rechazado (401/403).
   * Hacer POST /logout con token inválido causaba otro 401 → loop silencioso.
   *
   * El POST /auth/logout solo debe usarse para logout VOLUNTARIO del usuario
   * (cuando el token aún es válido y queremos invalidarlo en el backend).
   */
  private forceLogoutLocal(message?: string): void {
    this.authService.clearSessionPublic();
    this.router.navigate(['/login'], {
      queryParams: {
        expired: 'true',
        message: message || 'Sesión expirada',
      },
      replaceUrl: true,
    });
  }
}
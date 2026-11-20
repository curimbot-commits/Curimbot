/* eslint-disable @angular-eslint/prefer-inject */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/components/authentication/auth/auth.ts

import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpBackend,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import {
  User,
  UserCreate,
  UserInfoResponse,
  UserRole,
  Login2FARequest,
} from '../../../domain/models/user.model';
import { environment } from '../../../../environments/environment';
import { Router } from '@angular/router';

/**
 * Servicio central de autenticación y gestión de usuarios.
 *
 * IMPORTANTE — Ruptura del ciclo DI:
 *   Este servicio inyecta `HttpClient` (que pasa por interceptores) para
 *   la mayoría de operaciones, PERO también crea `httpNoInterceptors` con
 *   `HttpBackend` para que `refreshToken()` no dispare `AuthInterceptor`.
 *
 *   Sin esto: HttpClient → HTTP_INTERCEPTORS → AuthInterceptor → Auth → HttpClient.
 */
@Injectable({
  providedIn: 'root',
})
export class Auth {
  // ==================== CONFIGURACIÓN Y CONSTANTES ====================
  private readonly API_URL = environment.apiUrl;
  private readonly AUTH_URL = `${this.API_URL}/auth`;

  // ==================== ESTADO REACTIVO ====================
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public readonly currentUser = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

  private isRefreshing = false;

  // ==================== CLIENTE HTTP SIN INTERCEPTORES ====================
  /**
   * Cliente "limpio" que NO pasa por los interceptores.
   * Se usa exclusivamente en refreshToken() para romper el ciclo DI.
   */
  private httpNoInterceptors: HttpClient;

  // ==================== CONSTRUCTOR ====================
  constructor(
    private http: HttpClient,
    private httpBackend: HttpBackend,
    private router: Router
  ) {
    this.httpNoInterceptors = new HttpClient(httpBackend);
  }

  // ==================== INICIALIZACIÓN Y TOKENS ====================

  /**
   * Carga el estado inicial de autenticación.
   *
   * Se llama desde un APP_INITIALIZER en app.config.ts, NO desde el
   * constructor, porque dispara una petición HTTP que requiere que
   * HttpClient esté completamente construido.
   */
  public initAuthState(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.resolve();
    }
    if (window.location.pathname.includes('/callback')) {
      return Promise.resolve();
    }

    const hasSessionHint = sessionStorage.getItem('hadSession') === '1';

    if (!hasSessionHint) {
      this.clearSession();
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.getUserProfile().subscribe({
        next: (user) => {
          this.currentUserSubject.next(this.mapUserInfoToUser(user));
          this.isAuthenticatedSubject.next(true);
          resolve();
        },
        error: () => {
          this.clearSession();
          sessionStorage.removeItem('hadSession');
          resolve();   // resolve igual, sin bloquear el arranque
        },
      });
    });
  }

  /**
   * Marca al usuario como autenticado tras login/signup exitoso.
   * Ya NO maneja tokens porque el backend usa cookies HttpOnly.
   */
  private setAuthData(): void {
    this.isAuthenticatedSubject.next(true);
  }

  /**
   * Limpia completamente la sesión del usuario.
   */
  private clearSession(): void {
    sessionStorage.removeItem('temp_2fa_auth');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('userSession');

    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.isRefreshing = false;
  }

  /**
   * Versión pública de clearSession().
   * Usada por auth-guard e interceptor cuando el backend rechaza la cookie.
   */
  clearSessionPublic(): void {
    this.clearSession();
  }

  /**
   * Valida que un string sea un rol de usuario válido.
   */
  private isValidUserRole(role: string): role is UserRole {
    return role === 'admin' || role === 'user';
  }

  // ==================== AUTENTICACIÓN BÁSICA ====================

  /**
   * Inicia sesión con credenciales.
   */
  login(
    email: string,
    password: string,
    enforceSingleSession = true
  ): Observable<any> {
    const body = new HttpParams()
      .set('username', email)
      .set('password', password)
      .set('single_session', enforceSingleSession.toString());

    return this.http
      .post(`${this.AUTH_URL}/login`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        withCredentials: true,
      })
      .pipe(
        tap((response: any) => {
          if (response.requires_2fa) {
            sessionStorage.setItem(
              'temp_2fa_auth',
              JSON.stringify({ email, challenge_token: response.challenge_token })
            );
            throw { requires2FA: true, message: response.message || '2FA requerido' };
          }
          this.clearSession();
          this.setAuthData();
          sessionStorage.setItem('hadSession', '1');
        }),
        switchMap((response) => {
          if (response.requires_2fa) return of(response);
          return this.getUserProfile().pipe(
            tap((user) => this.currentUserSubject.next(this.mapUserInfoToUser(user))),
            map(() => response)
          );
        }),
        catchError((error) => {
          if (error?.requires2FA) return throwError(() => error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Inicia sesión con verificación de dos factores (2FA).
   */
  loginWith2FA(loginData: Login2FARequest): Observable<any> {
    if (!loginData.challenge_token) {
      return throwError(
        () => new Error('Sesión de verificación expirada. Inicia sesión nuevamente')
      );
    }
    if (
      !loginData.code ||
      !(/^\d{6}$/.test(loginData.code) || /^[A-Z0-9]{8}$/.test(loginData.code))
    ) {
      return throwError(() => new Error('Código de verificación inválido'));
    }

    const body = new HttpParams()
      .set('challenge_token', loginData.challenge_token)
      .set('totp_code', loginData.code)
      .set('single_session', (loginData.single_session ?? true).toString());

    return this.http
      .post<any>(`${this.AUTH_URL}/login-with-2fa`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        withCredentials: true,
      })
      .pipe(
        tap(() => {
          this.clearSession();
          this.setAuthData();
          sessionStorage.setItem('hadSession', '1');
        }),
        switchMap((response) =>
          this.getUserProfile().pipe(
            tap((user) =>
              this.currentUserSubject.next(this.mapUserInfoToUser(user))
            ),
            map(() => response)
          )
        ),
        catchError((error) => {
          if (error instanceof HttpErrorResponse) {
            const detail = error.error?.detail || '';
            if (error.status === 401) {
              if (detail.includes('Código de autenticación inválido')) {
                return throwError(
                  () =>
                    new Error(
                      'Código de autenticación inválido. Intenta nuevamente.'
                    )
                );
              }
              if (detail.includes('Código expirado')) {
                return throwError(
                  () => new Error('El código ha expirado. Solicita uno nuevo.')
                );
              }
              if (detail.includes('Cuenta bloqueada')) {
                return throwError(
                  () => new Error('Cuenta bloqueada. Contacta soporte.')
                );
              }
            }
          }
          return this.handleError(error);
        })
      );
  }

  /**
   * Registra un nuevo usuario.
   */
  signup(userData: UserCreate): Observable<any> {
    if (!userData.name || userData.name.length < 2) {
      return throwError(
        () => new Error('El nombre debe tener al menos 2 caracteres')
      );
    }
    if (
      !userData.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)
    ) {
      return throwError(() => new Error('Correo electrónico inválido'));
    }
    if (!userData.password || userData.password.length < 8) {
      return throwError(
        () => new Error('La contraseña debe tener al menos 8 caracteres')
      );
    }
    if (userData.password !== userData.password_confirm) {
      return throwError(() => new Error('Las contraseñas no coinciden'));
    }

    return this.http
      .post<any>(`${this.AUTH_URL}/signup`, userData, {
        withCredentials: true,
      })
      .pipe(
        tap(() => {
          this.setAuthData();
          sessionStorage.setItem('hadSession', '1');
        }),
        switchMap((response) =>
          this.getUserProfile().pipe(
            tap((user) =>
              this.currentUserSubject.next(this.mapUserInfoToUser(user))
            ),
            map(() => response)
          )
        ),
        catchError(this.handleError)
      );
  }

  /**
   * Cierra la sesión del usuario.
   */
  logout(options: { navigate?: boolean } = { navigate: true }): Observable<any> {
    const shouldNavigate = options.navigate !== false;

    // Si no hay sesión, no dispares el backend (evita 401 espurios)
    if (!this.isAuthenticated()) {
      this.clearSession();
      sessionStorage.removeItem('hadSession');
      if (shouldNavigate) {
        setTimeout(() => window.location.replace('/login'), 100);
      }
      return of({ message: 'Sin sesión activa' });
    }

    return this.http
      .post(`${this.AUTH_URL}/logout`, {}, { withCredentials: true })
      .pipe(
        catchError(() => of({ message: 'Sesión cerrada con advertencias' })),
        finalize(() => {
          this.clearSession();
          sessionStorage.removeItem('hadSession');
          if (shouldNavigate) {
            setTimeout(() => window.location.replace('/login'), 100);
          }
        })
      );
  }

  /**
   * Refresca la cookie de acceso usando el refresh token.
   *
   */
  refreshToken(): Observable<any> {
    if (this.isRefreshing) {
      return throwError(() => new Error('Actualización de token en progreso'));
    }

    this.isRefreshing = true;

    return this.httpNoInterceptors
      .post(`${this.AUTH_URL}/refresh`, {}, { withCredentials: true })
      .pipe(
        tap(() => this.setAuthData()),
        finalize(() => (this.isRefreshing = false)),
        catchError((error) => {
          this.clearSession();
          return throwError(() => error);
        })
      );
  }

  // ==================== GESTIÓN DE USUARIO ====================

  getUserProfile(): Observable<UserInfoResponse> {
    return this.http
      .get<UserInfoResponse>(`${this.AUTH_URL}/me`, {
        withCredentials: true,
      })
      .pipe(catchError(this.handleError));
  }

  /**
   * Completa el login OAuth. El backend ya dejó las cookies HttpOnly en el
   * redirect del callback; aquí solo se carga el perfil del usuario.
   */
  completeOAuthLogin(): Observable<UserInfoResponse> {
    this.clearSession();
    return this.getUserProfile().pipe(
      tap((user) => {
        this.currentUserSubject.next(this.mapUserInfoToUser(user));
        this.setAuthData();
        sessionStorage.setItem('hadSession', '1');
      })
    );
  }

  /**
   * Login OAuth de un usuario con 2FA: guarda el challenge_token (5 min,
   * un solo uso) para que /twoverification complete con loginWith2FA.
   */
  startOAuth2FA(email: string, challengeToken: string): void {
    sessionStorage.setItem(
      'temp_2fa_auth',
      JSON.stringify({ email, challenge_token: challengeToken })
    );
  }

  // ==================== UTILIDADES ====================

  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorKey = 'login.errors.unexpectedErrorTitle';

    if (error.error instanceof ErrorEvent) {
      return throwError(() => new Error(error.error.message));
    }

    switch (error.status) {
      case 0:
        errorKey = 'login.errors.connectionErrorTitle';
        break;
      case 401:
        errorKey = 'login.errors.invalidCredentialsTitle';
        break;
      case 403:
        errorKey = 'login.errors.forbiddenAccessTitle';
        break;
      case 404:
        errorKey = 'login.errors.resourceNotFoundTitle';
        break;
      case 423:
        errorKey = 'login.errors.accountLockedTitle';
        break;
      case 429:
        errorKey = 'login.errors.tooManyAttemptsTitle';
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        errorKey = 'login.errors.serverErrorTitle';
        break;
      default:
        errorKey = 'login.errors.unexpectedErrorTitle';
    }

    const customError: any = new Error(errorKey);
    customError.status = error.status;
    customError.originalError = error;

    return throwError(() => customError);
  }

  private mapUserInfoToUser(user: UserInfoResponse): User {
    if (!this.isValidUserRole(user.role)) {
      throw new Error(`Rol inválido recibido: ${user.role}`);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      two_factor_enabled: user.two_factor_enabled,
      last_login: user.last_login,
      created_at: user.created_at,
    };
  }
}
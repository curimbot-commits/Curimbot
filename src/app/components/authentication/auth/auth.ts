/* eslint-disable @angular-eslint/prefer-inject */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';
import {
  User,
  UserCreate,
  UserInfoResponse,
  LoginStatsResponse,
  UserManagementResponse,
  UserRole,
  Login2FARequest,
} from '../../../domain/models/user.model';
import { environment } from '../../../../environments/environment';
import { Router } from '@angular/router';

/**
 * Servicio central de autenticación y gestión de usuarios.
 * Maneja login, registro, tokens JWT, refresh, 2FA, permisos y operaciones administrativas.
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
  public readonly isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private isRefreshing = false;

  // ==================== CONSTRUCTOR ====================
  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.initializeAuth();
  }

  // ==================== INICIALIZACIÓN Y TOKENS ====================

  /**
   * Inicializa el estado de autenticación al cargar el servicio.
   * Llama al backend para obtener el perfil mediante la cookie.
   */
  private initializeAuth(): void {
    this.getUserProfile().subscribe({
      next: (user) => {
        this.currentUserSubject.next(this.mapUserInfoToUser(user));
        this.isAuthenticatedSubject.next(true);
      },
      error: () => {
        this.clearSession();
      }
    });
  }

  /**
   * Almacena datos del usuario reactivo localmente tras un inicio de sesión.
   * Ya NO maneja tokens porque el backend emplea cookies HttpOnly.
   */
  private setAuthData(): void {
    this.isAuthenticatedSubject.next(true);
  }

  /**
   * Limpia completamente la sesión del usuario.
   * Elimina tokens y datos relacionados del almacenamiento.
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
   * Usada por auth-guard e interceptor cuando el backend
   * rechaza el token (reinicio del servidor, blacklist limpia, etc.)
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
   * Si requiere 2FA, lanza error controlado con flag.
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
      })
      .pipe(
        tap((response: any) => {
          if (response.requires_2fa) {
            sessionStorage.setItem(
              'temp_2fa_auth',
              JSON.stringify({ email, password })
            );
            throw { requires2FA: true, message: response.message || '2FA requerido' };
          }
          this.clearSession();
          this.setAuthData();
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
          // ✅ Devolvemos el error original para que login.ts pueda manejar
          // los códigos de estado (401, 423, 0, etc.) con sus propias traducciones.
          return throwError(() => error);
        })
      );
  }

  /**
   * Inicia sesión con verificación de dos factores (2FA).
   */
  loginWith2FA(loginData: Login2FARequest): Observable<any> {
    if (!loginData.username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.username.trim())) {
      return throwError(() => new Error('Correo electrónico inválido'));
    }
    if (!loginData.password || loginData.password.length < 8) {
      return throwError(() => new Error('La contraseña debe tener al menos 8 caracteres'));
    }
    if (!loginData.code || !(/^\d{6}$/.test(loginData.code) || /^[A-Z0-9]{8}$/.test(loginData.code))) {
      return throwError(() => new Error('Código de verificación inválido'));
    }

    const body = new HttpParams()
      .set('username', loginData.username)
      .set('password', loginData.password)
      .set('totp_code', loginData.code)
      .set('single_session', (loginData.single_session ?? true).toString());

    return this.http
      .post<any>(`${this.AUTH_URL}/login-with-2fa`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        tap(() => {
          this.clearSession();
          this.setAuthData();
        }),
        switchMap((response) =>
          this.getUserProfile().pipe(
            tap((user) => this.currentUserSubject.next(this.mapUserInfoToUser(user))),
            map(() => response)
          )
        ),
        catchError((error) => {
          if (error instanceof HttpErrorResponse) {
            const detail = error.error?.detail || '';
            if (error.status === 401) {
              if (detail.includes('Código de autenticación inválido')) {
                return throwError(() => new Error('Código de autenticación inválido. Intenta nuevamente.'));
              }
              if (detail.includes('Código expirado')) {
                return throwError(() => new Error('El código ha expirado. Solicita uno nuevo.'));
              }
              if (detail.includes('Cuenta bloqueada')) {
                return throwError(() => new Error('Cuenta bloqueada. Contacta soporte.'));
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
      return throwError(() => new Error('El nombre debe tener al menos 2 caracteres'));
    }
    if (!userData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      return throwError(() => new Error('Correo electrónico inválido'));
    }
    if (!userData.password || userData.password.length < 8) {
      return throwError(() => new Error('La contraseña debe tener al menos 8 caracteres'));
    }
    if (userData.password !== userData.password_confirm) {
      return throwError(() => new Error('Las contraseñas no coinciden'));
    }

    return this.http.post<any>(`${this.AUTH_URL}/signup`, userData).pipe(
      tap(() => this.setAuthData()),
      switchMap((response) =>
        this.getUserProfile().pipe(
          tap((user) => this.currentUserSubject.next(this.mapUserInfoToUser(user))),
          map(() => response)
        )
      ),
      catchError(this.handleError)
    );
  }

  /**
   * Cierra la sesión del usuario.
   * Intenta notificar al backend y siempre limpia localmente.
   */
  logout(): Observable<any> {
    return this.http
      .post(
        `${this.AUTH_URL}/logout`,
        {},
        { headers: this.getAuthHeaders() }
      )
      .pipe(
        catchError(() => of({ message: 'Sesión cerrada con advertencias' })),
        finalize(() => {
          this.clearSession();
          setTimeout(() => {
            window.location.href = '/login';
          }, 100);
        })
      );
  }

  /**
   * Refresca el token de acceso usando el refresh token.
   * Evita llamadas simultáneas.
   */
  refreshToken(): Observable<any> {
    if (this.isRefreshing) {
      return throwError(() => new Error('Actualización de token en progreso'));
    }

    this.isRefreshing = true;

    return this.http
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
        headers: this.getAuthHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    return this.http
      .patch(
        `${this.AUTH_URL}/change-password`,
        { old_password: oldPassword, new_password: newPassword },
        { headers: this.getAuthHeaders() }
      )
      .pipe(catchError(this.handleError));
  }

  getLoginStats(hours = 24): Observable<LoginStatsResponse> {
    const params = new HttpParams().set('hours', hours.toString());
    return this.http
      .get<LoginStatsResponse>(`${this.AUTH_URL}/login-stats`, {
        headers: this.getAuthHeaders(),
        params,
      })
      .pipe(catchError(this.handleError));
  }

  // ==================== ADMINISTRACIÓN ====================

  getAllUsers(skip = 0, limit = 100, activeOnly = true): Observable<UserInfoResponse[]> {
    const params = new HttpParams()
      .set('skip', skip.toString())
      .set('limit', limit.toString())
      .set('active_only', activeOnly.toString());

    return this.http
      .get<UserInfoResponse[]>(`${this.AUTH_URL}/users`, {
        headers: this.getAuthHeaders(),
        params,
      })
      .pipe(catchError(this.handleError));
  }

  updateUserRole(userId: number, newRole: string): Observable<UserManagementResponse> {
    return this.http
      .patch<UserManagementResponse>(
        `${this.AUTH_URL}/users/${userId}/role`,
        { new_role: newRole },
        { headers: this.getAuthHeaders() }
      )
      .pipe(catchError(this.handleError));
  }

  deactivateUser(userId: number): Observable<UserManagementResponse> {
    return this.http
      .patch<UserManagementResponse>(
        `${this.AUTH_URL}/users/${userId}/deactivate`,
        {},
        { headers: this.getAuthHeaders() }
      )
      .pipe(catchError(this.handleError));
  }

  activateUser(userId: number): Observable<UserManagementResponse> {
    return this.http
      .patch<UserManagementResponse>(
        `${this.AUTH_URL}/users/${userId}/activate`,
        {},
        { headers: this.getAuthHeaders() }
      )
      .pipe(catchError(this.handleError));
  }

  getUserLoginStats(userId: number, hours = 24): Observable<LoginStatsResponse> {
    const params = new HttpParams().set('hours', hours.toString());
    return this.http
      .get<LoginStatsResponse>(`${this.AUTH_URL}/users/${userId}/login-stats`, {
        headers: this.getAuthHeaders(),
        params,
      })
      .pipe(catchError(this.handleError));
  }

  // ==================== MONITOREO Y ESTADÍSTICAS ====================

  healthCheck(): Observable<any> {
    return this.http.get(`${this.AUTH_URL}/health`).pipe(catchError(this.handleError));
  }

  getAuthStatsSummary(): Observable<any> {
    return this.http
      .get(`${this.AUTH_URL}/stats/summary`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  // ==================== UTILIDADES ====================

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
    });
  }

  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  isAdmin(): boolean {
    return this.currentUserSubject.value?.role === 'admin';
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Maneja errores HTTP de forma centralizada.
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorKey = 'login.errors.unexpectedErrorTitle';

    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      return throwError(() => new Error(error.error.message));
    }

    // Mapear estados HTTP a claves de traducción
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

    // Devolvemos el error original pero adjuntamos la clave de traducción sugerida
    // si el componente simplemente quiere mostrar el mensaje de error.
    const customError: any = new Error(errorKey);
    customError.status = error.status;
    customError.originalError = error;
    
    return throwError(() => customError);
  }

  /**
   * Convierte UserInfoResponse a modelo User.
   */
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
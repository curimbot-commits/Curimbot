// src/app/components/authentication/auth/oauth-callback/oauth-callback.component.ts

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Auth as AuthService } from '../auth';
import { jwtDecode } from 'jwt-decode';

/**
 * Componente que captura el JWT del callback OAuth.
 *
 * Flujo:
 *   Backend redirige → /auth/callback?token=JWT
 *   Este componente:
 *     1. Lee el token de la URL
 *     2. Lo guarda en localStorage con las mismas keys que usa AuthService
 *     3. Actualiza el estado reactivo de AuthService
 *     4. Redirige al dashboard o documento según el rol
 */
@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
      <div class="text-center">
        <div class="flex justify-center mb-4">
          <div class="p-4 rounded-2xl shadow-md"
            style="background: linear-gradient(to bottom right, #02ab74, #7209b7);">
            <!-- Spinner animado -->
            <svg class="w-12 h-12 text-white animate-spin"
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
        </div>

        <!-- Estado: cargando -->
        <ng-container *ngIf="!errorMessage">
          <h2 class="text-xl font-semibold text-[#070025] mb-2">Autenticando...</h2>
          <p class="text-gray-500 text-sm">Estamos verificando tu identidad, por favor espera.</p>
        </ng-container>

        <!-- Estado: error -->
        <ng-container *ngIf="errorMessage">
          <h2 class="text-xl font-semibold text-red-600 mb-2">Error de autenticación</h2>
          <p class="text-gray-500 text-sm mb-4">{{ errorMessage }}</p>
          <button
            (click)="goToLogin()"
            class="bg-[#02ab74] hover:bg-[#028a5f] text-white font-medium rounded-lg py-2 px-6 transition-all">
            Volver al login
          </button>
        </ng-container>
      </div>
    </div>
  `,
})
export class OAuthCallbackComponent implements OnInit {

  errorMessage: string | null = null;

  // Keys exactas que usa AuthService para guardar tokens
  private readonly TOKEN_KEY = 'authToken';
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {

      const token = params['token'];
      const error = params['error'];

      // ── Caso error: backend mandó ?error=... ──────────────────────
      if (error) {
        this.handleOAuthError(error);
        return;
      }

      // ── Caso sin token ─────────────────────────────────────────────
      if (!token) {
        this.errorMessage = 'No se recibió token de autenticación.';
        return;
      }

      // ── Caso éxito: procesar token ─────────────────────────────────
      this.processToken(token);
    });
  }

  /**
   * Guarda el token y redirige según el rol del usuario.
   *
   * OAuth solo genera access_token (no refresh_token).
   * Guardamos el mismo token en ambas keys para que AuthService
   * y el interceptor funcionen sin cambios.
   */
  private processToken(token: string): void {
    try {
      // Validar que el token sea un JWT decodificable
      const decoded: any = jwtDecode(token);

      if (!decoded.sub || !decoded.role || !decoded.email) {
        this.errorMessage = 'Token inválido recibido del servidor.';
        return;
      }

      // Guardar con las mismas keys que usa AuthService.setAuthData()
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, token); // OAuth no tiene refresh separado

      // Forzar reinicialización del estado reactivo de AuthService
      // Llamando isAuthenticated() se dispara initializeAuth() si es necesario
      // pero lo más directo es navegar y dejar que el guard valide
      const role = decoded.role as string;
      const destination = role === 'admin' ? '/dashboard' : '/document';

      // Pequeño delay para que localStorage se persista antes de navegar
      setTimeout(() => {
        this.router.navigateByUrl(destination);
      }, 300);

    } catch (err) {
      console.error('Error decodificando token OAuth:', err);
      this.errorMessage = 'El token recibido no es válido.';
    }
  }

  /**
   * Traduce los códigos de error del backend a mensajes amigables.
   */
  private handleOAuthError(error: string): void {
    const errorMessages: Record<string, string> = {
      cancelled:     'Cancelaste el inicio de sesión.',
      invalid_state: 'La sesión expiró. Por favor intenta de nuevo.',
      server_error:  'Error interno del servidor. Intenta más tarde.',
    };

    this.errorMessage = errorMessages[error]
      ?? `Error de autenticación: ${error}`;

    // Redirigir al login automáticamente después de 3 segundos
    setTimeout(() => this.goToLogin(), 3000);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
// src/app/components/authentication/auth/oauth-callback/oauth-callback.component.ts

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Auth as AuthService } from '../auth';
import { jwtDecode } from 'jwt-decode';

/**
 * Componente que captura el JWT del callback OAuth.
 *
 * Flujo:
 *   Backend redirige → /auth/callback (con cookies HttpOnly configuradas)
 *   Este componente:
 *     1. Verifica si hubo un error `?error=`
 *     2. Llama a AuthService para obtener el perfil de usuario a través de cookies
 *     3. Redirige al dashboard o documento según el rol
 */
@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [],
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
        @if (!errorMessage) {
          <h2 class="text-xl font-semibold text-[#070025] mb-2">Autenticando...</h2>
          <p class="text-gray-500 text-sm">Estamos verificando tu identidad, por favor espera.</p>
        }
    
        <!-- Estado: error -->
        @if (errorMessage) {
          <h2 class="text-xl font-semibold text-red-600 mb-2">Error de autenticación</h2>
          <p class="text-gray-500 text-sm mb-4">{{ errorMessage }}</p>
          <button
            (click)="goToLogin()"
            class="bg-[#02ab74] hover:bg-[#028a5f] text-white font-medium rounded-lg py-2 px-6 transition-all">
            Volver al login
          </button>
        }
      </div>
    </div>
    `,
})
export class OAuthCallbackComponent implements OnInit {

  errorMessage: string | null = null;

  // Ya no usamos TOKEN_KEY localmente.

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

      // ── Caso éxito: Backend ya estableció las cookies HttpOnly ────────────────
      // Verificamos el perfil para forzar el estado reactivo y ver el rol.
      this.processAuthCookies();
    });
  }

  /**
   * Intenta obtener el perfil del usuario mediante la cookie HttpOnly recién establecida.
   * Si es exitoso, redirige de acuerdo al rol.
   */
  private processAuthCookies(): void {
    this.authService.getUserProfile().subscribe({
      next: (user) => {
        const role = user.role;
        const destination = role === 'admin' ? '/dashboard' : '/document';

        setTimeout(() => {
          this.router.navigateByUrl(destination);
        }, 300);
      },
      error: (err) => {
        console.error('Error obteniendo perfil después del OAuth:', err);
        this.errorMessage = 'No se pudo iniciar sesión. Las cookies pueden ser inválidas o haber expirado.';
      }
    });
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
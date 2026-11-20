// src/app/components/authentication/auth/oauth-callback/oauth-callback.component.ts

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Auth as AuthService } from '../auth';

/**
 * Destino del callback OAuth. El backend redirige aquí con:
 *   - ?status=success → cookies HttpOnly ya establecidas; se carga el perfil
 *     y se redirige según el rol.
 *   - #requires_2fa=1&challenge=...&email=... → el usuario tiene 2FA; se
 *     guarda el challenge y se va a /twoverification. Va en el fragmento
 *     para que no llegue a servidores, logs ni Referer.
 *   - ?error=<código> → mensaje genérico y vuelta al login.
 * Los tokens de sesión nunca viajan en la URL.
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const snapshot = this.route.snapshot;

    // ── Caso 2FA: challenge en el fragmento (#) ───────────────────
    const fragment = new URLSearchParams(snapshot.fragment ?? '');
    if (fragment.get('requires_2fa') === '1') {
      const email = fragment.get('email');
      const challenge = fragment.get('challenge');
      if (email && challenge) {
        this.authService.startOAuth2FA(email, challenge);
        // replaceUrl: el challenge no queda en el historial del navegador
        this.router.navigate(['/twoverification'], { replaceUrl: true });
      } else {
        this.handleOAuthError('oauth_failed');
      }
      return;
    }

    // ── Caso error: backend mandó ?error=... ──────────────────────
    const error = snapshot.queryParamMap.get('error');
    if (error) {
      this.handleOAuthError(error);
      return;
    }

    // ── Caso éxito: cookies ya establecidas por el backend ────────
    if (snapshot.queryParamMap.get('status') !== 'success') {
      this.handleOAuthError('oauth_failed');
      return;
    }

    this.authService.completeOAuthLogin().subscribe({
      next: (user) => {
        const destination = user.role === 'admin' ? '/app/dashboard' : '/app/document';
        this.router.navigateByUrl(destination, { replaceUrl: true });
      },
      error: () => {
        this.errorMessage = 'No se pudo iniciar sesión. Intenta de nuevo.';
        setTimeout(() => this.goToLogin(), 3000);
      },
    });
  }

  /**
   * Traduce los códigos de error del backend a mensajes amigables.
   */
  private handleOAuthError(error: string): void {
    const errorMessages: Record<string, string> = {
      cancelled:          'Cancelaste el inicio de sesión.',
      invalid_state:      'La sesión expiró. Por favor intenta de nuevo.',
      email_not_verified: 'Tu email no está verificado en el proveedor.',
      account_disabled:   'Tu cuenta está desactivada. Contacta al administrador.',
      oauth_failed:       'No se pudo completar el inicio de sesión. Intenta de nuevo.',
      server_error:       'Error interno del servidor. Intenta más tarde.',
    };

    this.errorMessage = errorMessages[error] ?? 'Error de autenticación.';

    // Redirigir al login automáticamente después de 3 segundos
    setTimeout(() => this.goToLogin(), 3000);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}

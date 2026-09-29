import { Routes } from '@angular/router';

import { twoFactorGuard } from './services/guards/twoFactorGuard';
import { authGuard } from './services/guards/auth-guard';
import { redirectIfAuthenticatedGuard } from './components/authentication/auth/RedirectIfAuthenticatedGuard';
import { roleGuard } from './services/guards/admin-guard';
import { OAuthCallbackComponent } from './components/authentication/auth/oauth-callback/oauth-callback.component';

/**
 * Definición de rutas de la aplicación.
 *
 * Estructura general:
 *   - Rutas públicas: accesibles sin autenticación. Protegidas por
 *     `redirectIfAuthenticatedGuard` cuando no deben mostrarse a usuarios
 *     ya autenticados.
 *   - Rutas de empresa: contenido informativo público bajo `/company`.
 *   - Rutas protegidas: agrupadas bajo el prefijo `/app`, protegidas por
 *     `authGuard` y, a nivel de cada ruta hija, por `roleGuard` cuando se
 *     requiere un rol específico.
 *   - Ruta 404: captura cualquier ruta no reconocida.
 */
export const routes: Routes = [
  // ========================================
  // RUTAS PÚBLICAS
  // ========================================
  {
    path: '',
    loadComponent: () =>
      import('./components/landing-page/landing-page').then(
        (m) => m.LandingPage
      ),
    title: 'CURIM',
    pathMatch: 'full',
  },
  {
    path: 'auth/callback',
    component: OAuthCallbackComponent,
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./components/authentication/login/login').then((m) => m.Login),
    title: 'Iniciar sesión',
    canActivate: [redirectIfAuthenticatedGuard],
  },
  {
    path: 'twoverification',
    loadComponent: () =>
      import(
        './components/authentication/login/two-verification/two-verification'
      ).then((m) => m.TwoVerification),
    title: 'Verificación 2FA',
    canActivate: [twoFactorGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/authentication/register/register').then(
        (m) => m.Register
      ),
    title: 'Registro',
    canActivate: [redirectIfAuthenticatedGuard],
  },
  {
    path: 'passwordreset',
    loadComponent: () =>
      import(
        './components/authentication/forgot-password/forgot-password'
      ).then((m) => m.ForgotPassword),
    title: 'Recuperar contraseña',
    canActivate: [redirectIfAuthenticatedGuard],
  },
  {
    path: 'checkemail',
    loadComponent: () =>
      import('./components/authentication/check-email/check-email').then(
        (m) => m.CheckEmail
      ),
    title: 'Verificar correo',
    canActivate: [redirectIfAuthenticatedGuard],
  },
  {
    path: 'resetpassword',
    loadComponent: () =>
      import(
        './components/authentication/reset-password/reset-password'
      ).then((m) => m.ResetPassword),
    title: 'Restablecer contraseña',
    canActivate: [redirectIfAuthenticatedGuard],
  },
  {
    path: 'passwordchanged',
    loadComponent: () =>
      import(
        './components/authentication/password-changed/password-changed'
      ).then((m) => m.PasswordChanged),
    title: 'Contraseña actualizada',
    canActivate: [redirectIfAuthenticatedGuard],
  },

  // ========================================
  // COMPANY
  // ========================================
  {
    path: 'company',
    
    children: [
      {
        path: 'trayectoria',
        loadComponent: () =>
          import('./components/pages/trayectoria/trayectoria.component').then(
            (m) => m.TrayectoriaComponent
          ),
        title: 'Trayectoria · Curiman Brokers Group',
      },
      {
        path: 'liderazgo',
        loadComponent: () =>
          import('./components/pages/liderazgo/liderazgo.component').then(
            (m) => m.LiderazgoComponent
          ),
        title: 'Liderazgo · Curiman Brokers Group',
      },
      {
        path: 'alcance',
        loadComponent: () =>
          import('./components/pages/alcance/alcance.component').then(
            (m) => m.AlcanceComponent
          ),
        title: 'Alcance · Curiman Brokers Group',
      },
      {
        path: 'mision',
        loadComponent: () =>
          import('./components/pages/mision/mision.component').then(
            (m) => m.MisionComponent
          ),
        title: 'Misión · Curiman Brokers Group',
      },
      {
        path: 'propuesta-de-valor',
        loadComponent: () =>
          import(
            './components/pages/propuesta-valor/propuesta-valor.component'
          ).then((m) => m.PropuestaValorComponent),
        title: 'Propuesta de valor · Curiman Brokers Group',
      },
      {
        path: '',
        redirectTo: 'trayectoria',
        pathMatch: 'full',
      },
    ],
  },

  // ========================================
  // RUTAS PROTEGIDAS
  // ========================================
  {
    path: 'app',
    loadComponent: () =>
      import('./components/navbar/navbar').then((m) => m.Navbar),
    canActivate: [authGuard],
    children: [
      {
        path: 'document',
        loadComponent: () =>
          import('./components/document/document').then(
            (m) => m.DocumentComponent
          ),
        canActivate: [roleGuard],
        title: 'Documentos',
        data: { roles: ['user', 'admin'] },
      },
      {
        path: 'search',
        loadComponent: () =>
          import('./components/search/search').then((m) => m.Search),
        canActivate: [roleGuard],
        title: 'Búsqueda',
        data: { roles: ['user', 'admin'] },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./components/settings/settings').then((m) => m.Settings),
        canActivate: [roleGuard],
        title: 'Configuraciones',
        data: { roles: ['user', 'admin'] },
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./components/security/security').then((m) => m.Security),
        canActivate: [roleGuard],
        title: 'Seguridad',
        data: { roles: ['user', 'admin'] },
      },
      {
        path: 'voice',
        loadComponent: () =>
          import('./components/athenia-voice/athenia-voice').then(
            (m) => m.AtheniaVoice
          ),
        canActivate: [roleGuard],
        title: 'Curim',
        data: { roles: ['user', 'admin'] },
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/dashboard/dashboard').then((m) => m.Dashboard),
        canActivate: [roleGuard],
        title: 'Panel de control',
        data: { roles: ['admin'] },
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./components/users/users').then((m) => m.Users),
        canActivate: [roleGuard],
        title: 'Usuarios',
        data: { roles: ['admin'] },
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./components/history/history').then((m) => m.History),
        canActivate: [roleGuard],
        title: 'Historial',
        data: { roles: ['admin'] },
      },
      {
        path: '',
        redirectTo: 'document',
        pathMatch: 'full',
      },
    ],
  },

  // ========================================
  // 404
  // ========================================
  {
    path: '404',
    loadComponent: () =>
      import('./components/not-found/not-found').then(
        (m) => m.NotFoundComponent
      ),
    title: '404 - Página no encontrada',
  },
  {
    path: '**',
    redirectTo: '404',
  },
];
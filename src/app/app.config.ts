// src/app/app.config.ts

import {
  ApplicationConfig,
  APP_INITIALIZER,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { LucideIcons } from './icon/icons';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AuthInterceptor } from './services/interceptors/auth.interceptor';
import { errorInterceptor } from './services/interceptors/error.interceptor';
import { credentialsInterceptor } from './services/interceptors/credentials.interceptor';
import { ThemeService } from './services/theme/theme.service';
import {
  TranslateModule,
  TranslateLoader,
  TranslateService,
} from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import * as enTranslation from './shared/i18n/en.json';
import * as esTranslation from './shared/i18n/es.json';
import { GsapAnimationService } from './shared/components/animacion/gsap-animation.service';
import { Auth } from './components/authentication/auth/auth';

export class CustomTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<any> {
    if (lang === 'en') {
      return of((enTranslation as any).default || enTranslation);
    }
    return of((esTranslation as any).default || esTranslation);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),

    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      })
    ),

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),

    importProvidersFrom(
      LucideAngularModule.pick(LucideIcons),
      TranslateModule.forRoot({
        fallbackLang: 'es',
        loader: {
          provide: TranslateLoader,
          useClass: CustomTranslateLoader,
        },
      })
    ),

    
    //    Orden response: abajo → arriba
    provideHttpClient(
      withInterceptors([
        credentialsInterceptor, // 1º añade withCredentials
        AuthInterceptor,        // 2º maneja 401/403 y refresh
        errorInterceptor,       // 3º captura errores restantes
      ])
    ),

    // =====================================================
    // APP_INITIALIZERS — orden de ejecución: de arriba a abajo
    // =====================================================

    // 0) Cargar estado de autenticación (perfil vía cookie)
    //    Se hace aquí y NO en el constructor de Auth para romper
    //    el ciclo DI con AuthInterceptor.
    {
      provide: APP_INITIALIZER,
      useFactory: (auth: Auth) => () => {
        auth.initAuthState();
        return Promise.resolve(); // no bloquea el arranque
      },
      deps: [Auth],
      multi: true,
    },

    // 1) Tema
    {
      provide: APP_INITIALIZER,
      useFactory: (themeService: ThemeService) => () => themeService.init(),
      deps: [ThemeService],
      multi: true,
    },

    // 2) Traducciones
    {
      provide: APP_INITIALIZER,
      useFactory: (translate: TranslateService) => {
        return () => {
          const savedLanguage = localStorage.getItem('language') || 'es';
          translate.setDefaultLang('es');
          return translate.use(savedLanguage);
        };
      },
      deps: [TranslateService],
      multi: true,
    },

    // 3) Precargar GSAP + ScrollTrigger
    {
      provide: APP_INITIALIZER,
      useFactory: (gsapService: GsapAnimationService) => () =>
        gsapService.preload(),
      deps: [GsapAnimationService],
      multi: true,
    },
  ],
};
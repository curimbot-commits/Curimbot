import { ApplicationConfig, APP_INITIALIZER, importProvidersFrom, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { LucideIcons } from './icon/icons';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AuthInterceptor } from './services/interceptors/auth.interceptor';
import { ThemeService } from './services/theme/theme.service';
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import * as enTranslation from './shared/i18n/en.json';
import * as esTranslation from './shared/i18n/es.json';

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
    provideRouter(routes),
    importProvidersFrom(
      LucideAngularModule.pick(LucideIcons),
      TranslateModule.forRoot({
        defaultLanguage: 'es',
        loader: {
          provide: TranslateLoader,
          useClass: CustomTranslateLoader
        }
      })
    ),

    // ✅ withInterceptorsFromDi() habilita los interceptores de clase (HTTP_INTERCEPTORS)
    provideHttpClient(
      withInterceptorsFromDi()
    ),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },

    // ✅ Inicializa el tema ANTES de que Angular monte los componentes
    {
      provide: APP_INITIALIZER,
      useFactory: (themeService: ThemeService) => () => themeService.init(),
      deps: [ThemeService],
      multi: true
    },

    // ✅ Inicializa las traducciones antes de que se cargue la UI
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
      multi: true
    }
  ]
};
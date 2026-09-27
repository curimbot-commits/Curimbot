import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

export type AppTheme = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'app-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private doc = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);

  /** Signal con el tema seleccionado por el usuario */
  private themeSignal = signal<AppTheme>('light');

  /** Signal reactivo: ¿está activo el modo oscuro? */
  readonly isDark = computed(() => {
    const t = this.themeSignal();
    return t === 'dark' || (t === 'auto' && this.systemPrefersDark);
  });

  /** Icono listo para el header */
  readonly themeIcon = computed(() => (this.isDark() ? 'sun' : 'moon'));

  /** ¿El sistema prefiere dark? */
  private systemPrefersDark = false;

  /** Tema actual */
  get currentTheme(): AppTheme {
    return this.themeSignal();
  }

  /**
   * Inicializa el tema. Llamar desde APP_INITIALIZER
   * o desde el constructor de AppComponent.
   */
  init(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemPrefersDark = media.matches;

    // Escuchar cambios del sistema (solo afecta si theme === 'auto')
    media.addEventListener('change', (e) => {
      this.systemPrefersDark = e.matches;
      if (this.themeSignal() === 'auto') {
        this.applyTheme('auto');
        // forzamos recálculo del computed
        this.themeSignal.set('auto');
      }
    });

    // Leer preferencia guardada
    const saved = (localStorage.getItem(STORAGE_KEY) as AppTheme) ?? 'auto';
    this.setTheme(saved);
  }

  setTheme(theme: AppTheme): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(STORAGE_KEY, theme);
    this.themeSignal.set(theme);
    this.applyTheme(theme);
  }

  /** Alterna entre light y dark (ignora auto) */
  toggle(): void {
    const next: AppTheme = this.isDark() ? 'light' : 'dark';
    this.setTheme(next);
  }

  private applyTheme(theme: AppTheme): void {
    const html = this.doc.documentElement;
    const body = this.doc.body;
    const dark = theme === 'dark' || (theme === 'auto' && this.systemPrefersDark);

    html.classList.toggle('dark', dark);
    body.classList.toggle('dark', dark);
  }
}
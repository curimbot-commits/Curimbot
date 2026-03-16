import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type AppTheme = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'app-theme';

/**
 * Servicio centralizado para gestionar el tema de la aplicación.
 * Aplica la clase `dark` al elemento <html> para que Tailwind CSS
 * y las variables CSS respondan correctamente.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private doc = inject(DOCUMENT);
  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  /** Tema actualmente guardado en el sistema */
  get currentTheme(): AppTheme {
    return (localStorage.getItem(STORAGE_KEY) as AppTheme) ?? 'light';
  }

  /**
   * Inicializa el tema al arrancar la app.
   * Debe llamarse desde APP_INITIALIZER o en el constructor del root.
   */
  init(): void {
    // Escuchar cambios del sistema para modo AUTO
    this.mediaQuery.addEventListener('change', () => {
      if (this.currentTheme === 'auto') {
        this.applyTheme('auto');
      }
    });
    // Aplicar el tema guardado
    this.applyTheme(this.currentTheme);
  }

  /**
   * Cambia y persiste el tema.
   * @param theme 'light' | 'dark' | 'auto'
   */
  setTheme(theme: AppTheme): void {
    localStorage.setItem(STORAGE_KEY, theme);
    this.applyTheme(theme);
  }

  /**
   * Aplica efectivamente el tema al DOM.
   * Añade/quita la clase `dark` del elemento `<html>`.
   */
  applyTheme(theme: AppTheme): void {
    const html = this.doc.documentElement; // <html>
    const isDark =
      theme === 'dark' ||
      (theme === 'auto' && this.mediaQuery.matches);

    if (isDark) {
      html.classList.add('dark');
      // También en body para compatibilidad con CSS variables legacy
      this.doc.body.classList.add('dark');
    } else {
      html.classList.remove('dark');
      this.doc.body.classList.remove('dark');
    }
  }

  /** Devuelve true si el modo oscuro está activo actualmente */
  get isDark(): boolean {
    return this.doc.documentElement.classList.contains('dark');
  }
}

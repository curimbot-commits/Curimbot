import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

export type ThemeType = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly storageKey = 'app-theme-preference';

  private readonly themeSubject = new BehaviorSubject<ThemeType>('system');
  public readonly theme$: Observable<ThemeType> = this.themeSubject.asObservable();

  constructor() {
    if (this.isBrowser) {
      this.initTheme();
      this.listenToSystemChanges();
    }
  }

  public setTheme(theme: ThemeType): void {
    if (!this.isBrowser) return;

    this.themeSubject.next(theme);
    
    if (theme === 'system') {
      localStorage.removeItem(this.storageKey);
      this.applySystemTheme();
    } else {
      localStorage.setItem(this.storageKey, theme);
      this.applyTheme(theme);
    }
  }

  public get currentTheme(): ThemeType {
    return this.themeSubject.value;
  }

  private initTheme(): void {
    const savedTheme = localStorage.getItem(this.storageKey) as ThemeType | null;
    
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      this.themeSubject.next(savedTheme);
      this.applyTheme(savedTheme);
    } else {
      this.themeSubject.next('system');
      this.applySystemTheme();
    }
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  private applySystemTheme(): void {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.applyTheme(prefersDark ? 'dark' : 'light');
    document.documentElement.removeAttribute('data-theme');
  }

  private listenToSystemChanges(): void {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (this.currentTheme === 'system') {
        this.applyTheme(e.matches ? 'dark' : 'light');
        document.documentElement.removeAttribute('data-theme');
      }
    });
  }
}

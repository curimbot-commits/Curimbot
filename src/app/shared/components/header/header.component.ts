import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ThemeService } from 'src/app/services/theme/theme.service';
import { EyeTrackerComponent } from '../Robot/eye-tracker.component';
import { Auth } from 'src/app/components/authentication/auth/auth';

interface CompanyLink {
  path: string;
  labelKey: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    LucideAngularModule,
    EyeTrackerComponent
],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private translate = inject(TranslateService);
  private authService = inject(Auth);

  /** Servicio de tema expuesto al template */
  readonly theme = inject(ThemeService);

  isScrolled = false;
  mobileMenuOpen = false;

  /** Estado del acordeón (mobile) */
  readonly mobileCompanyOpen = signal(false);

  /** Idioma actual */
  readonly currentLang = signal<'es' | 'en'>('es');

  /** Links de las 5 vistas (desktop + mobile) */
  readonly companyLinks: CompanyLink[] = [
    { path: '/company/trayectoria',        labelKey: 'landing.company.trayectoria.badge' },
    { path: '/company/liderazgo',          labelKey: 'landing.company.liderazgo.badge' },
    { path: '/company/alcance',            labelKey: 'landing.company.alcance.badge' },
    { path: '/company/mision',             labelKey: 'landing.company.mision.badge' },
    { path: '/company/propuesta-de-valor', labelKey: 'landing.company.propuesta.badge' }
  ];

  constructor() {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'es';
    this.currentLang.set(lang.startsWith('en') ? 'en' : 'es');
  }

  // ============================================================
  // IDIOMA
  // ============================================================
  toggleLanguage(): void {
    const next = this.currentLang() === 'es' ? 'en' : 'es';
    this.translate.use(next);
    this.currentLang.set(next);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('lang', next);
      document.documentElement.lang = next;
    }
  }

  // ============================================================
  // SCROLL
  // ============================================================
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isScrolled = window.scrollY > 50;
  }

  // ============================================================
  // ESCAPE
  // ============================================================
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.mobileMenuOpen = false;
    this.mobileCompanyOpen.set(false);
  }

  // ============================================================
  // MOBILE
  // ============================================================
  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (!this.mobileMenuOpen) this.mobileCompanyOpen.set(false);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
    this.mobileCompanyOpen.set(false);
  }

  toggleMobileCompany(): void {
    this.mobileCompanyOpen.update(v => !v);
  }

  // ============================================================
  // UTILIDADES
  // ============================================================
  scrollToTop(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToLogin(): void {
    if (this.authService.isAuthenticated()) {
      const user = this.authService.getCurrentUser();
      const defaultRoute = user?.role === 'admin' ? '/app/dashboard' : '/app/document';
      this.router.navigate([defaultRoute]);
    } else {
      this.router.navigate(['/login']);
    }
  }
}
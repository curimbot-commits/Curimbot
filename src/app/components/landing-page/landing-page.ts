/* eslint-disable @angular-eslint/prefer-inject */
// src/app/features/landing/components/landing-page.component.ts

import {
  Component,
  HostListener,
  OnInit,
  AfterViewInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
  ElementRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ThemeService, AppTheme } from 'src/app/services/theme/theme.service';
import { TranslateModule } from '@ngx-translate/core';
import { HeaderComponent } from 'src/app/shared/components/header/header.component';
import { FooterComponent } from 'src/app/shared/components/footer/footer.component';
import { GsapAnimationService } from 'src/app/shared/components/animacion/gsap-animation.service';

/**
 * Interfaz para características del producto.
 */
interface Feature {
  icon: string;
  key: string;
}

/**
 * Interfaz para perfiles de usuario objetivo.
 */
interface Persona {
  icon: string;
  key: string;
}

/**
 * Interfaz para empresas aliadas / partners.
 */
interface Partner {
  name: string;
  logo: string;
  alt: string;
}

/**
 * Landing Page principal de la aplicación.
 * Presenta características, casos de uso, pasos, precios y testimonios.
 */
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    TranslateModule,
    HeaderComponent,
    FooterComponent,
  ],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPage implements OnInit, AfterViewInit, OnDestroy {
  // ==================================================================
  // SERVICIOS
  // ==================================================================

  private router = inject(Router);
  private themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);
  private el = inject(ElementRef<HTMLElement>);
  private gsapService = inject(GsapAnimationService);

  // ==================================================================
  // ESTADO PÚBLICO
  // ==================================================================

  isScrolled = false;
  mobileMenuOpen = false;
  currentYear = new Date().getFullYear();

  // ==================================================================
  // ESTADO PRIVADO
  // ==================================================================

  private scrollRafId: number | null = null;
  private lastScrollY = 0;
  private gsapCtx?: any;

  // ==================================================================
  // DATOS ESTÁTICOS
  // ==================================================================

  readonly features: Feature[] = [
    { icon: 'fas fa-cloud-upload-alt', key: 'upload' },
    { icon: 'fas fa-search', key: 'search' },
    { icon: 'fas fa-microphone', key: 'voice' },
    { icon: 'fas fa-history', key: 'history' },
    { icon: 'fas fa-file-contract', key: 'summary' },
    { icon: 'fas fa-lock', key: 'security' },
  ];

  readonly personas: Persona[] = [
    { icon: 'Briefcase', key: 'agents' },
    { icon: 'Building2', key: 'directors' },
    { icon: 'Scale', key: 'compliance' },
    { icon: 'History', key: 'support' },
  ];

  readonly partners: Partner[] = [
    { name: 'Americo', logo: 'assets/images/partners/Americo.webp', alt: 'Americo' },
    { name: 'F&G', logo: 'assets/images/partners/FG.webp', alt: 'Fidelity & Guaranty Life' },
    { name: 'National Life Group', logo: 'assets/images/partners/NLG.webp', alt: 'National Life Group' },
    { name: 'American-Amicable', logo: 'assets/images/partners/americanami.webp', alt: 'American-Amicable' },
    { name: 'Mutual of Omaha', logo: 'assets/images/partners/mutual-of-omaha.webp', alt: 'Mutual of Omaha' },
  ];

  // ==================================================================
  // LIFECYCLE
  // ==================================================================

  ngOnInit(): void {
  }

  async ngAfterViewInit(): Promise<void> {
    // Inicialización centralizada en el servicio (espera assets + refresh + kill).
    this.gsapCtx = await this.gsapService.createContext(
      this.el.nativeElement,
      ({ gsap, ScrollTrigger }) => {
        // 1) HERO con video
        this.gsapService.initHeroVideo(gsap, {
          titleSelector: '.gsap-hero-title',
          subSelector: '.gsap-hero-sub',
          buttonsSelector: '.gsap-hero-btns',
        });

        // 2) Parallax del video.
        this.gsapService.initVideoParallax(gsap, ScrollTrigger, 'video', 'section.relative');

        // 3) Feature cards: stagger.
        this.gsapService.initStagger(gsap, ScrollTrigger, {
          selector: '.gsap-feature-card',
          y: 50,
          stagger: 0.1,
          duration: 1,
          trigger: '#features',
          start: 'top 85%',
        });

        // 4) Role cards: stagger con pop elástico.
        this.gsapService.initStagger(gsap, ScrollTrigger, {
          selector: '.gsap-role-card',
          y: 50,
          stagger: 0.15,
          duration: 1,
          trigger: '#roles',
          start: 'top 85%',
        });

        // 5) Reveals genéricos (.animate-on-scroll).
        this.gsapService.initScrollReveals(gsap, ScrollTrigger);


        // 6) Promise cards: stagger.
        this.gsapService.initStagger(gsap, ScrollTrigger, {
          selector: '.gsap-promise-card',
          y: 50,
          stagger: 0.2,
          duration: 1,
          trigger: '#promise',
          start: 'top 85%',
        });
      }
    );
  }

  ngOnDestroy(): void {
    this.gsapService.revertContext(this.gsapCtx);
    this.gsapService.killAllScrollTriggers();

    if (this.scrollRafId !== null) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }
  }

  // ==================================================================
  // UTILIDADES
  // ==================================================================

  /**
   * Maneja errores de carga de imagen.
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement;
    if (fallback) {
      fallback.classList.remove('hidden');
      fallback.classList.add('flex');
    }
  }

  // ==================================================================
  // SCROLL
  // ==================================================================

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (this.scrollRafId !== null) return;

    this.scrollRafId = requestAnimationFrame(() => {
      const currentY = window.scrollY;

      const shouldBeScrolled = currentY > 50;
      if (this.isScrolled !== shouldBeScrolled) {
        this.isScrolled = shouldBeScrolled;
      }

      this.lastScrollY = currentY;
      this.scrollRafId = null;
    });
  }

  // ==================================================================
  // NAVEGACIÓN
  // ==================================================================

  /** Redirige al login. */
  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  /** Vuelve al inicio de la página con scroll suave. */
  scrollToTop(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Scroll suave a una sección específica con offset del header. */
  scrollToSection(event: Event, sectionId: string): void {
    event.preventDefault();
    const element = document.getElementById(sectionId);
    if (!element) return;

    const headerOffset = 80;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    });
  }

  /** Abre/cierra el menú móvil. */
  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  /** Cierra el menú móvil. */
  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }
}
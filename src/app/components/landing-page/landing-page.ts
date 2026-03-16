/* eslint-disable @angular-eslint/prefer-inject */
// src/app/features/landing/components/landing-page.component.ts

import { Component, HostListener, OnInit, AfterViewInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ThemeService, AppTheme } from 'src/app/services/theme/theme.service';
import { TranslateModule } from '@ngx-translate/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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
 * Landing Page principal de la aplicación.
 * Presenta características, casos de uso, pasos, precios y testimonios.
 */
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    TranslateModule
  ],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css'
})
export class LandingPage implements OnInit, AfterViewInit {
  // ==================================================================
  // SERVICIOS
  // ==================================================================

  private router = inject(Router);
  private themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);

  isScrolled = false;
  mobileMenuOpen = false;

  // ==================================================================
  // DATOS ESTÁTICOS
  // ==================================================================

  readonly features: Feature[] = [
    { icon: 'fas fa-cloud-upload-alt', key: 'upload' },
    { icon: 'fas fa-search', key: 'search' },
    { icon: 'fas fa-microphone', key: 'voice' },
    { icon: 'fas fa-history', key: 'history' },
    { icon: 'fas fa-file-contract', key: 'summary' },
    { icon: 'fas fa-lock', key: 'security' }
  ];

  readonly personas: Persona[] = [
    { icon: 'Briefcase', key: 'agents' },
    { icon: 'Building2', key: 'directors' },
    { icon: 'Scale', key: 'compliance' },
    { icon: 'History', key: 'support' }
  ];

  readonly partners = [
    { name: 'Aetna' },
    { name: 'Cigna' },
    { name: 'Humana' },
    { name: 'UnitedHealthcare' },
    { name: 'BlueCross BlueShield' },
    { name: 'Molina Healthcare' }
  ];

  // ==================================================================
  // ANIMACIONES DE SCROLL
  // ==================================================================

  private intersectionObserver?: IntersectionObserver;

  ngOnInit(): void {
    this.setupScrollAnimations();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      gsap.registerPlugin(ScrollTrigger);
      this.initGsapAnimations();
    }
  }

  private initGsapAnimations(): void {
    // 1. Hero Entrance Timeline
    const heroTl = gsap.timeline({ defaults: { ease: 'power4.out', duration: 1.2 } });

    // Set initial states via GSAP directly
    gsap.set(['.gsap-hero-title', '.gsap-hero-sub', '.gsap-hero-btns'], { opacity: 0, y: 30 });

    heroTl.to('.gsap-hero-title', { opacity: 1, y: 0, delay: 0.3 })
          .to('.gsap-hero-sub', { opacity: 1, y: 0 }, '-=0.8')
          .to('.gsap-hero-btns', { opacity: 1, y: 0 }, '-=0.6');

    // 1.1 Hero Parallax
    gsap.to('video', {
      scrollTrigger: {
        trigger: 'section.relative',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      },
      y: 150,
      ease: 'none'
    });

    // 2. Feature Cards ScrollTrigger
    gsap.fromTo('.gsap-feature-card', 
      { autoAlpha: 0, y: 50 },
      {
        scrollTrigger: {
          trigger: '#features',
          start: 'top 85%',
          toggleActions: 'play none none none'
        },
        autoAlpha: 1,
        y: 0,
        duration: 1,
        stagger: 0.1,
        ease: 'power3.out'
      }
    );

    // 3. Role Cards ScrollTrigger
    gsap.fromTo('.gsap-role-card', 
      { autoAlpha: 0, scale: 0.9 },
      {
        scrollTrigger: {
          trigger: '#roles',
          start: 'top 85%',
          toggleActions: 'play none none none'
        },
        autoAlpha: 1,
        scale: 1,
        duration: 1,
        stagger: 0.15,
        ease: 'back.out(1.7)'
      }
    );
  }

  /** Configura animaciones de aparición al hacer scroll */
  private setupScrollAnimations(): void {
    const options: IntersectionObserverInit = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, options);

    // Delay para asegurar que el DOM esté listo
    setTimeout(() => {
      document.querySelectorAll('.animate-on-scroll').forEach(el => {
        this.intersectionObserver?.observe(el);
      });
    }, 100);
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled = window.scrollY > 50;
    this.animateOnScroll();
  }

  /** Alterna entre tema claro y oscuro */
  toggleTheme(): void {
    const nextTheme: AppTheme = this.themeService.isDark ? 'light' : 'dark';
    this.themeService.setTheme(nextTheme);
  }

  /** Devuelve el icono actual del tema */
  get themeIcon(): string {
    return this.themeService.isDark ? 'sun' : 'moon';
  }

  /** Animación fallback (en caso de que IntersectionObserver no funcione) */
  private animateOnScroll(): void {
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 100) {
        el.classList.add('visible');
      }
    });
  }

  // ==================================================================
  // NAVEGACIÓN
  // ==================================================================

  /** Redirige al login */
  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  scrollToSection(event: Event, sectionId: string): void {
    event.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      ScrollTrigger.getAll().forEach(t => t.kill());
    }
    this.intersectionObserver?.disconnect();
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }
}
import {
  ChangeDetectionStrategy,
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  Inject,
  PLATFORM_ID,
  NgZone,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { HeaderComponent } from 'src/app/shared/components/header/header.component';
import { GsapAnimationService } from 'src/app/shared/components/animacion/gsap-animation.service';
import { FooterComponent } from "src/app/shared/components/footer/footer.component";

@Component({
  selector: 'app-mision',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, HeaderComponent, FooterComponent],
  templateUrl: './mision.component.html',
  styleUrls: ['./mision.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisionComponent implements AfterViewInit, OnDestroy {
  readonly pillars = [
    { key: 'products', icon: 'package' },
    { key: 'education', icon: 'graduation-cap' },
    { key: 'technology', icon: 'cpu' },
    { key: 'strategy', icon: 'compass' },
    { key: 'support', icon: 'life-buoy' },
  ];

  readonly outcomes = [
    { key: 'producers', icon: 'user-check' },
    { key: 'professionals', icon: 'briefcase' },
    { key: 'leaders', icon: 'crown' },
  ];

  private gsapCtx?: any;
  private isBrowser: boolean;

  constructor(
    private el: ElementRef<HTMLElement>,
    private zone: NgZone,
    private gsapService: GsapAnimationService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async ngAfterViewInit(): Promise<void> {
    // Se utiliza el servicio compartido, que espera assets, programa refreshes
    // con debounce y elimina los ScrollTriggers huérfanos.
    this.gsapCtx = await this.gsapService.createContext(
      this.el.nativeElement,
      ({ gsap, ScrollTrigger }) => {
        this.initHeroAnimations(gsap);
        this.initPillarsAnimation(gsap, ScrollTrigger);
        this.initOutcomesAnimation(gsap, ScrollTrigger);
        this.gsapService.initScrollReveals(gsap, ScrollTrigger);
        this.initParallax(gsap, ScrollTrigger);
      }
    );
  }

  ngOnDestroy(): void {
    // Revierte el contexto y elimina los ScrollTriggers huérfanos.
    this.gsapService.revertContext(this.gsapCtx);
    this.gsapService.killAllScrollTriggers();
  }

  // =====================================================
  // 1) HERO
  // =====================================================

  private initHeroAnimations(gsap: any): void {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    if (gsap.utils.toArray('.gsap-hero-badge').length) {
      tl.fromTo(
        '.gsap-hero-badge',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, clearProps: 'all' }
      );
    }

    if (gsap.utils.toArray('.gsap-hero-title').length) {
      tl.fromTo(
        '.gsap-hero-title',
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, clearProps: 'all' },
        '-=0.3'
      );
    }

    if (gsap.utils.toArray('.gsap-hero-sub').length) {
      tl.fromTo(
        '.gsap-hero-sub',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, clearProps: 'all' },
        '-=0.6'
      );
    }

    if (gsap.utils.toArray('.gsap-hero-image').length) {
      gsap.fromTo(
        '.gsap-hero-image',
        { scale: 1.15, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 1.4,
          ease: 'power2.out',
          clearProps: 'transform',
        }
      );
    }
  }

  // =====================================================
  // 2) PILARES
  // =====================================================

  private initPillarsAnimation(gsap: any, ScrollTrigger: any): void {
    const cards = gsap.utils.toArray('.gsap-pillar-card');
    if (!cards.length) return;

    const center = Math.floor(cards.length / 2);

    cards.forEach((card: any, i: number) => {
      const offset = (i - center) * 40;

      gsap.fromTo(
        card,
        { y: 60, x: offset * 0.3, opacity: 0, scale: 0.85 },
        {
          y: 0,
          x: 0,
          opacity: 1,
          scale: 1,
          duration: 0.9,
          ease: 'power3.out',
          clearProps: 'all',
          scrollTrigger: {
            trigger: card,
            start: 'top 88%',
            toggleActions: 'play none none none',
            once: true,
          },
        }
      );
    });

    // Iconos con efecto pop escalonado.
    const icons = gsap.utils.toArray('.gsap-pillar-icon');
    icons.forEach((icon: any, i: number) => {
      gsap.fromTo(
        icon,
        { scale: 0, rotate: -30 },
        {
          scale: 1,
          rotate: 0,
          duration: 0.6,
          delay: i * 0.08,
          ease: 'back.out(2.5)',
          clearProps: 'all',
          scrollTrigger: {
            trigger: icon,
            start: 'top 90%',
            toggleActions: 'play none none none',
            once: true,
          },
        }
      );
    });
  }

  // =====================================================
  // 3) OUTCOMES
  // =====================================================

  private initOutcomesAnimation(gsap: any, ScrollTrigger: any): void {
    const cards = gsap.utils.toArray('.gsap-outcome-card');
    if (!cards.length) return;

    // Cards con stagger.
    gsap.fromTo(
      cards,
      { y: 60, opacity: 0, scale: 0.95 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.9,
        stagger: 0.15,
        ease: 'power3.out',
        clearProps: 'all',
        scrollTrigger: {
          trigger: cards[0],
          start: 'top 85%',
          toggleActions: 'play none none none',
          once: true,
        },
      }
    );

    // Iconos con efecto pop elástico.
    const icons = gsap.utils.toArray('.gsap-outcome-icon');
    icons.forEach((icon: any, i: number) => {
      gsap.fromTo(
        icon,
        { scale: 0, rotate: 360 },
        {
          scale: 1,
          rotate: 0,
          duration: 0.9,
          delay: i * 0.15,
          ease: 'back.out(1.7)',
          clearProps: 'all',
          scrollTrigger: {
            trigger: icon,
            start: 'top 88%',
            toggleActions: 'play none none none',
            once: true,
          },
        }
      );
    });

    // Glow pulsante continuo: anima boxShadow en bucle infinito.
    // No afecta la opacidad, de modo que no oculta ningún elemento.
    gsap.to(cards, {
      boxShadow: '0 0 40px rgba(2, 171, 116, 0.15)',
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      stagger: 0.4,
    });
  }

  // =====================================================
  // 4) PARALLAX
  // =====================================================

  private initParallax(gsap: any, ScrollTrigger: any): void {
    const heroImg = gsap.utils.toArray('.gsap-hero-image');
    const heroSec = gsap.utils.toArray('.gsap-hero-section');
    if (!heroImg.length || !heroSec.length) return;

    gsap.to(heroImg, {
      yPercent: 15,
      ease: 'none',
      scrollTrigger: {
        trigger: '.gsap-hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });
  }
}
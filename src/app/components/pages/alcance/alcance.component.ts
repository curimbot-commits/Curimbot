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
  selector: 'app-alcance',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, HeaderComponent, FooterComponent],
  templateUrl: './alcance.component.html',
  styleUrls: ['./alcance.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlcanceComponent implements AfterViewInit, OnDestroy {
  readonly ecosystem = [
    { key: 'carriers', icon: 'building-2', accent: 'green'  as const },
    { key: 'cbg',      icon: 'bot',        accent: 'purple' as const },
    { key: 'agents',   icon: 'users',      accent: 'blue'   as const },
  ];

  readonly stats = [
    { value: '3,000+', key: 'agents' },
    { value: '50',     key: 'states' },
    { value: '100+',   key: 'carriers' },
  ];

  readonly profileLevels = [
    { key: 'starter',  icon: 'rocket' },
    { key: 'producer', icon: 'award' },
    { key: 'leader',   icon: 'crown' },
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
    // y elimina ScrollTriggers huérfanos.
    this.gsapCtx = await this.gsapService.createContext(
      this.el.nativeElement,
      ({ gsap, ScrollTrigger }) => {
        this.initHeroAnimations(gsap);
        this.initStatsAnimation(gsap, ScrollTrigger);
        this.initEcosystemAnimation(gsap, ScrollTrigger);
        this.initProfilesAnimation(gsap, ScrollTrigger);
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
  // 2) STATS
  // =====================================================

  private initStatsAnimation(gsap: any, ScrollTrigger: any): void {
    const cards = gsap.utils.toArray('.gsap-stat-card');
    if (!cards.length) return;

    gsap.fromTo(
      cards,
      { y: 50, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
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

    // Valores con contador animado.
    const values = gsap.utils.toArray('.gsap-stat-value');
    values.forEach((el: any) => {
      const raw = el.textContent?.trim() ?? '';
      const num = parseFloat(raw.replace(/[^\d.]/g, ''));
      if (isNaN(num)) return;

      const suffix = raw.replace(/[\d.,]/g, '').trim();
      const hasComma = raw.includes(',');

      const obj = { val: 0 };
      gsap.to(obj, {
        val: num,
        duration: 1.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none',
          once: true,
        },
        onUpdate: () => {
          const v = hasComma
            ? Math.floor(obj.val).toLocaleString('en-US')
            : Math.floor(obj.val).toString();
          el.textContent = v + suffix;
        },
      });
    });
  }

  // =====================================================
  // 3) ECOSISTEMA
  // =====================================================

  private initEcosystemAnimation(gsap: any, ScrollTrigger: any): void {
    const cards = gsap.utils.toArray('.gsap-ecosystem-card');
    if (cards.length) {
      gsap.fromTo(
        cards,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
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
    }

    const icons = gsap.utils.toArray('.gsap-ecosystem-icon');
    icons.forEach((icon: any) => {
      gsap.fromTo(
        icon,
        { scale: 0, rotate: -45 },
        {
          scale: 1,
          rotate: 0,
          duration: 0.7,
          ease: 'back.out(2)',
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
  // 4) PERFILES
  // =====================================================

  private initProfilesAnimation(gsap: any, ScrollTrigger: any): void {
    // Título de la sección.
    const titles = gsap.utils.toArray('.gsap-section-title');
    titles.forEach((title: any) => {
      gsap.fromTo(
        title,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          clearProps: 'all',
          scrollTrigger: {
            trigger: title,
            start: 'top 88%',
            toggleActions: 'play none none none',
            once: true,
          },
        }
      );
    });

    // Cards con entrada escalonada.
    const cards = gsap.utils.toArray('.gsap-profile-card');
    cards.forEach((card: any, i: number) => {
      gsap.fromTo(
        card,
        { y: 60, opacity: 0, scale: 0.95 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.8,
          delay: i * 0.12,
          ease: 'power3.out',
          clearProps: 'all',
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            toggleActions: 'play none none none',
            once: true,
          },
        }
      );
    });

    // Iconos con efecto pop.
    const icons = gsap.utils.toArray('.gsap-profile-icon');
    icons.forEach((icon: any) => {
      gsap.fromTo(
        icon,
        { scale: 0, rotate: 20 },
        {
          scale: 1,
          rotate: 0,
          duration: 0.6,
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
  // 5) PARALLAX
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
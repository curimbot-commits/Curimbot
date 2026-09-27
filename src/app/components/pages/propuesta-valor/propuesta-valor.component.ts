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
  selector: 'app-propuesta-valor',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, HeaderComponent, FooterComponent],
  templateUrl: './propuesta-valor.component.html',
  styleUrls: ['./propuesta-valor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropuestaValorComponent implements AfterViewInit, OnDestroy {
  readonly services = [
    { key: 'caseManagement', icon: 'folder-search' },
    { key: 'training', icon: 'graduation-cap' },
    { key: 'newBusiness', icon: 'FilePlusIcon' },
    { key: 'marketing', icon: 'megaphone' },
    { key: 'contracting', icon: 'FilePenLine' },
    { key: 'eft', icon: 'CreditCard' },
    { key: 'afterIssue', icon: 'heart-handshake' },
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
        this.initServicesAnimation(gsap, ScrollTrigger);
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
  // El brillo pulsante del subtítulo se gestiona vía CSS
  // (ver propuesta-valor.component.css). Aquí se evita el
  // bucle infinito de GSAP sobre textShadow.
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

    if (gsap.utils.toArray('.gsap-hero-subtitle').length) {
      tl.fromTo(
        '.gsap-hero-subtitle',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, clearProps: 'all' },
        '-=0.5'
      );
    }

    if (gsap.utils.toArray('.gsap-hero-sub').length) {
      tl.fromTo(
        '.gsap-hero-sub',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, clearProps: 'all' },
        '-=0.5'
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
  // 2) SERVICIOS
  // =====================================================

  private initServicesAnimation(gsap: any, ScrollTrigger: any): void {
    const cards = gsap.utils.toArray('.gsap-service-card');
    if (!cards.length) return;

    // Entrada en cascada desde diferentes direcciones según columna.
    cards.forEach((card: any, i: number) => {
      const col = i % 3;
      const offsetX = col === 0 ? -50 : col === 2 ? 50 : 0;

      gsap.fromTo(
        card,
        { x: offsetX, y: 50, opacity: 0, scale: 0.92 },
        {
          x: 0,
          y: 0,
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

    // Iconos con efecto pop rotacional escalonado.
    const icons = gsap.utils.toArray('.gsap-service-icon');
    icons.forEach((icon: any, i: number) => {
      gsap.fromTo(
        icon,
        { scale: 0, rotate: -90 },
        {
          scale: 1,
          rotate: 0,
          duration: 0.7,
          delay: i * 0.06,
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
  // 3) PARALLAX
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
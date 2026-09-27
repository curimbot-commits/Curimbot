import { Injectable, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  CounterOptions,
  HeroAnimationOptions,
  StaggerOffsetOptions,
  StaggerOptions,
} from './gsap-animation.types';

@Injectable({ providedIn: 'root' })
export class GsapAnimationService {
  private gsap: any = null;
  private ScrollTrigger: any = null;
  private isBrowser: boolean;
  private loaded = false;
  private refreshTimer: any = null;
  private extraRefreshTimer: any = null;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private zone: NgZone
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // =====================================================
  // SETUP
  // =====================================================

  async preload(): Promise<void> {
    if (!this.isBrowser || this.loaded) return;

    const gsapModule = await import('gsap');
    const stModule = await import('gsap/ScrollTrigger');

    this.gsap = gsapModule.gsap ?? gsapModule.default;
    this.ScrollTrigger = stModule.ScrollTrigger ?? stModule.default;

    this.gsap.registerPlugin(this.ScrollTrigger);
    this.loaded = true;
  }

  private async loadGsap(): Promise<void> {
    if (this.loaded) return;
    await this.preload();
  }

  // =====================================================
  // CREATE CONTEXT
  // Espera assets, aplica doble RAF y programa refreshes
  // debounced para asegurar el layout final de Angular.
  // =====================================================

  async createContext(
    hostElement: HTMLElement,
    init: (ctx: { gsap: any; ScrollTrigger: any; scope: HTMLElement }) => void
  ): Promise<any> {
    if (!this.isBrowser) return null;

    await this.loadGsap();
    await this.waitForAssets(hostElement);

    return new Promise((resolve) => {
      this.zone.runOutsideAngular(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const ctx = this.gsap.context(() => {
              init({
                gsap: this.gsap,
                ScrollTrigger: this.ScrollTrigger,
                scope: hostElement,
              });
            }, hostElement);

            // Refresh con debounce (150 ms).
            this.scheduleRefresh();

            // Refresh adicional a los 500 ms para capturar el layout final.
            clearTimeout(this.extraRefreshTimer);
            this.extraRefreshTimer = setTimeout(() => {
              if (this.ScrollTrigger) {
                this.zone.runOutsideAngular(() => {
                  this.ScrollTrigger.refresh();
                });
              }
            }, 500);

            resolve(ctx);
          });
        });
      });
    });
  }

  // =====================================================
  // ESPERA DE FUENTES E IMÁGENES DENTRO DEL HOST
  // =====================================================

  private async waitForAssets(host: HTMLElement): Promise<void> {
    const tasks: Promise<any>[] = [];

    if ((document as any).fonts?.ready) {
      tasks.push((document as any).fonts.ready);
    }

    const imgs = Array.from(host.querySelectorAll('img')) as HTMLImageElement[];
    imgs.forEach((img) => {
      if (img.complete) return;
      tasks.push(
        new Promise<void>((res) => {
          img.addEventListener('load', () => res(), { once: true });
          img.addEventListener('error', () => res(), { once: true });
        })
      );
    });

    if (tasks.length) {
      await Promise.race([
        Promise.all(tasks),
        new Promise((res) => setTimeout(res, 2500)),
      ]);
    }
  }

  // =====================================================
  // REFRESH CON DEBOUNCE
  // =====================================================

  private scheduleRefresh(delay = 150): void {
    if (!this.isBrowser || !this.ScrollTrigger) return;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.zone.runOutsideAngular(() => {
        this.ScrollTrigger.refresh();
      });
    }, delay);
  }

  refresh(): void {
    this.scheduleRefresh(50);
  }

  // =====================================================
  // ELIMINAR TODOS LOS SCROLLTRIGGERS HUÉRFANOS
  // Llamar desde ngOnDestroy de cada componente animado.
  // =====================================================

  killAllScrollTriggers(): void {
    if (!this.isBrowser || !this.ScrollTrigger) return;
    this.zone.runOutsideAngular(() => {
      this.ScrollTrigger.getAll().forEach((t: any) => t.kill());
    });
  }

  // =====================================================
  // 1) HERO
  // =====================================================

  initHero(
    gsap: any,
    ScrollTrigger: any,
    options: HeroAnimationOptions = {}
  ): void {
    const {
      badgeSelector = '.gsap-hero-badge',
      titleSelector = '.gsap-hero-title',
      subtitleSelector,
      subSelector = '.gsap-hero-sub',
      imageSelector = '.gsap-hero-image',
    } = options;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    if (gsap.utils.toArray(badgeSelector).length) {
      tl.fromTo(
        badgeSelector,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, clearProps: 'all' }
      );
    }

    if (gsap.utils.toArray(titleSelector).length) {
      tl.fromTo(
        titleSelector,
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, clearProps: 'all' },
        '-=0.3'
      );
    }

    if (subtitleSelector && gsap.utils.toArray(subtitleSelector).length) {
      tl.fromTo(
        subtitleSelector,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, clearProps: 'all' },
        '-=0.5'
      );
    }

    if (gsap.utils.toArray(subSelector).length) {
      tl.fromTo(
        subSelector,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, clearProps: 'all' },
        '-=0.5'
      );
    }

    if (gsap.utils.toArray(imageSelector).length) {
      gsap.fromTo(
        imageSelector,
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
  // 2) PARALLAX
  // =====================================================

  initParallax(
    gsap: any,
    ScrollTrigger: any,
    imageSelector = '.gsap-hero-image',
    triggerSelector = '.gsap-hero-section'
  ): void {
    if (!gsap.utils.toArray(imageSelector).length) return;
    if (!gsap.utils.toArray(triggerSelector).length) return;

    gsap.to(imageSelector, {
      yPercent: 15,
      ease: 'none',
      scrollTrigger: {
        trigger: triggerSelector,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });
  }

  // =====================================================
  // 3) STAGGER GENÉRICO
  // =====================================================

  initStagger(gsap: any, ScrollTrigger: any, options: StaggerOptions): void {
    const {
      selector,
      y = 50,
      x = 0,
      stagger = 0.12,
      duration = 0.9,
      trigger,
      start = 'top 85%',
    } = options;

    const elements = gsap.utils.toArray(selector);
    if (!elements.length) return;

    gsap.fromTo(
      elements,
      { y, x, opacity: 0 },
      {
        y: 0,
        x: 0,
        opacity: 1,
        duration,
        stagger,
        ease: 'power3.out',
        clearProps: 'all',
        scrollTrigger: {
          trigger: trigger ?? selector,
          start,
          toggleActions: 'play none none none',
          once: true,
        },
      }
    );
  }

  // =====================================================
  // 4) STAGGER DIRECCIONAL
  // =====================================================

  initStaggerDirectional(
    gsap: any,
    ScrollTrigger: any,
    options: StaggerOffsetOptions
  ): void {
    const {
      selector,
      columns = 3,
      offsetX = 50,
      y = 50,
      duration = 0.9,
      start = 'top 88%',
    } = options;

    const elements = gsap.utils.toArray(selector);
    if (!elements.length) return;

    elements.forEach((el: any, i: number) => {
      const col = i % columns;
      const dx = col === 0 ? -offsetX : col === columns - 1 ? offsetX : 0;

      gsap.fromTo(
        el,
        { x: dx, y, opacity: 0, scale: 0.92 },
        {
          x: 0,
          y: 0,
          opacity: 1,
          scale: 1,
          duration,
          ease: 'power3.out',
          clearProps: 'all',
          scrollTrigger: {
            trigger: el,
            start,
            toggleActions: 'play none none none',
            once: true,
          },
        }
      );
    });
  }

  // =====================================================
  // 5) ICON POP
  // =====================================================

  initIconPop(
    gsap: any,
    ScrollTrigger: any,
    iconSelector: string,
    options: { rotate?: number; stagger?: number; start?: string } = {}
  ): void {
    const { rotate = -30, stagger = 0.08, start = 'top 90%' } = options;

    const icons = gsap.utils.toArray(iconSelector);
    if (!icons.length) return;

    icons.forEach((icon: any, i: number) => {
      gsap.fromTo(
        icon,
        { scale: 0, rotate },
        {
          scale: 1,
          rotate: 0,
          duration: 0.6,
          delay: i * stagger,
          ease: 'back.out(2)',
          clearProps: 'all',
          scrollTrigger: {
            trigger: icon,
            start,
            toggleActions: 'play none none none',
            once: true,
          },
        }
      );
    });
  }

  // =====================================================
  // 6) SCROLL REVEALS GENÉRICO
  // =====================================================

  initScrollReveals(
    gsap: any,
    ScrollTrigger: any,
    selector = '.animate-on-scroll'
  ): void {
    const elements = gsap.utils.toArray(selector);
    if (!elements.length) return;

    elements.forEach((el: any) => {
      gsap.fromTo(
        el,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: 'power3.out',
          clearProps: 'all',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none none',
            once: true,
          },
        }
      );
    });
  }

  // =====================================================
  // 7) COUNTERS
  // =====================================================

  initCounters(
    gsap: any,
    ScrollTrigger: any,
    options: CounterOptions
  ): void {
    const { selector, duration = 1.8 } = options;
    const elements = gsap.utils.toArray(selector);
    if (!elements.length) return;

    elements.forEach((el: any) => {
      const raw = el.textContent?.trim() ?? '';
      const num = parseFloat(raw.replace(/[^\d.]/g, ''));
      if (isNaN(num)) return;

      const suffix = raw.replace(/[\d.,]/g, '').trim();
      const hasComma = raw.includes(',');

      const obj = { val: 0 };
      gsap.to(obj, {
        val: num,
        duration,
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
  // 8) PULSE
  // =====================================================

  initPulse(
    gsap: any,
    selector: string,
    options: {
      property?: string;
      from?: string;
      to?: string;
      duration?: number;
      stagger?: number;
    } = {}
  ): void {
    const {
      property = 'boxShadow',
      to = '0 0 40px rgba(2, 171, 116, 0.15)',
      duration = 2,
      stagger = 0.4,
    } = options;

    if (!gsap.utils.toArray(selector).length) return;

    gsap.to(selector, {
      [property]: to,
      duration,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      stagger,
    });
  }

  // =====================================================
  // 9) SECTION ENTRANCE
  // =====================================================

  initSectionEntrance(
    gsap: any,
    ScrollTrigger: any,
    selector: string,
    options: { y?: number; duration?: number; start?: string } = {}
  ): void {
    const { y = 60, duration = 1, start = 'top 85%' } = options;

    const elements = gsap.utils.toArray(selector);
    if (!elements.length) return;

    gsap.fromTo(
      elements,
      { y, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration,
        ease: 'power3.out',
        clearProps: 'all',
        scrollTrigger: {
          trigger: selector,
          start,
          toggleActions: 'play none none none',
          once: true,
        },
      }
    );
  }

  // =====================================================
  // UTILIDAD
  // =====================================================

  revertContext(ctx: any): void {
    if (ctx && typeof ctx.revert === 'function') {
      ctx.revert();
    }
  }

  // =====================================================
  // 10) HERO CON VIDEO
  // Variante para landing: anima título, subtítulo y
  // botones sobre un video de fondo.
  // =====================================================

  initHeroVideo(
    gsap: any,
    options: {
      titleSelector?: string;
      subSelector?: string;
      buttonsSelector?: string;
    } = {}
  ): void {
    const {
      titleSelector = '.gsap-hero-title',
      subSelector = '.gsap-hero-sub',
      buttonsSelector = '.gsap-hero-btns',
    } = options;

    const hasTitle = gsap.utils.toArray(titleSelector).length > 0;
    const hasSub = gsap.utils.toArray(subSelector).length > 0;
    const hasButtons = gsap.utils.toArray(buttonsSelector).length > 0;

    if (!hasTitle && !hasSub && !hasButtons) return;

    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

    if (hasTitle) {
      tl.fromTo(
        titleSelector,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1.2, clearProps: 'all' }
      );
    }

    if (hasSub) {
      tl.fromTo(
        subSelector,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1.2, clearProps: 'all' },
        '-=0.8'
      );
    }

    if (hasButtons) {
      tl.fromTo(
        buttonsSelector,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1.2, clearProps: 'all' },
        '-=0.6'
      );
    }
  }

  // =====================================================
  // 11) PARALLAX DE VIDEO
  // Variante para landing: desplaza el video al hacer scroll.
  // =====================================================

  initVideoParallax(
    gsap: any,
    ScrollTrigger: any,
    videoSelector = 'video',
    triggerSelector = 'section.relative'
  ): void {
    if (!gsap.utils.toArray(videoSelector).length) return;
    if (!gsap.utils.toArray(triggerSelector).length) return;

    gsap.to(videoSelector, {
      y: 150,
      ease: 'none',
      force3D: true,
      scrollTrigger: {
        trigger: triggerSelector,
        start: 'top top',
        end: 'bottom top',
        scrub: 1,
        pin: false,
      },
    });
  }
}
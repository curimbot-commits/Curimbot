import {
  ChangeDetectionStrategy,
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { HeaderComponent } from 'src/app/shared/components/header/header.component';
import { GsapAnimationService } from 'src/app/shared/components/animacion/gsap-animation.service';
import { FooterComponent } from "src/app/shared/components/footer/footer.component";

@Component({
  selector: 'app-trayectoria',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, HeaderComponent, FooterComponent],
  templateUrl: './trayectoria.component.html',
  styleUrls: ['./trayectoria.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrayectoriaComponent implements AfterViewInit, OnDestroy {
  readonly milestones = [
    { key: 'origin', icon: 'flag', year: '2018' },
    { key: 'growth', icon: 'trending-up', year: '2020' },
    { key: 'platform', icon: 'layers', year: '2022' },
    { key: 'today', icon: 'users', year: '2025' },
  ];

  private gsapCtx: any;

  constructor(
    private el: ElementRef<HTMLElement>,
    private gsapService: GsapAnimationService
  ) {}

  async ngAfterViewInit(): Promise<void> {
    this.gsapCtx = await this.gsapService.createContext(
      this.el.nativeElement,
      ({ gsap, ScrollTrigger }) => {
        // 1) HERO: entrada escalonada y parallax.
        this.gsapService.initHero(gsap, ScrollTrigger);
        this.gsapService.initParallax(gsap, ScrollTrigger);

        // 2) TIMELINE: la línea vertical se "dibuja" al hacer scroll.
        gsap.fromTo(
          '.gsap-timeline-line',
          { scaleY: 0, transformOrigin: 'top center' },
          {
            scaleY: 1,
            duration: 1.5,
            ease: 'power2.out',
            clearProps: 'transform',
            scrollTrigger: {
              trigger: '.gsap-timeline',
              start: 'top 75%',
              end: 'bottom 60%',
              scrub: 1,
            },
          }
        );

        // 3) MILESTONES: entrada lateral, efecto pop en iconos y fade del año.
        this.gsapService.initStagger(gsap, ScrollTrigger, {
          selector: '.gsap-milestone',
          x: -60,
          y: 0,
          stagger: 0.15,
          start: 'top 85%',
        });

        this.gsapService.initIconPop(
          gsap,
          ScrollTrigger,
          '.gsap-milestone-icon',
          {
            rotate: -45,
            start: 'top 85%',
          }
        );

        // Año: fade lateral con delay.
        const years = gsap.utils.toArray('.gsap-milestone-year');
        years.forEach((year: any) => {
          const trigger = year.closest('.gsap-milestone');
          if (!trigger) return;

          gsap.fromTo(
            year,
            { x: -20, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              duration: 0.5,
              delay: 0.2,
              clearProps: 'all',
              scrollTrigger: {
                trigger,
                start: 'top 85%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        });

        // 4) CIERRE: bloque e imagen lateral.
        this.gsapService.initSectionEntrance(
          gsap,
          ScrollTrigger,
          '.gsap-closing-block',
          { y: 80, duration: 1.1 }
        );

        gsap.fromTo(
          '.gsap-closing-image',
          { scale: 1.15, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 1.4,
            ease: 'power2.out',
            clearProps: 'transform',
            scrollTrigger: {
              trigger: '.gsap-closing-block',
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        );

        // 5) Reveals genéricos (.animate-on-scroll).
        this.gsapService.initScrollReveals(gsap, ScrollTrigger);
      }
    );
  }

  ngOnDestroy(): void {
    // Revierte el contexto y elimina todos los ScrollTriggers huérfanos.
    // Esto evita que al navegar entre rutas queden triggers activos con
    // posiciones obsoletas.
    this.gsapService.revertContext(this.gsapCtx);
    this.gsapService.killAllScrollTriggers();
  }
}
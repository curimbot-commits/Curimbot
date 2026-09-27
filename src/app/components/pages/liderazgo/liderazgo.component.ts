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
  selector: 'app-liderazgo',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, HeaderComponent, FooterComponent],
  templateUrl: './liderazgo.component.html',
  styleUrls: ['./liderazgo.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiderazgoComponent implements AfterViewInit, OnDestroy {
  readonly pillars = [
    { key: 'service', icon: 'heart-handshake' },
    { key: 'discipline', icon: 'target' },
    { key: 'education', icon: 'graduation-cap' },
    { key: 'innovation', icon: 'lightbulb' },
    { key: 'integrity', icon: 'shield-check' },
    { key: 'growth', icon: 'sprout' },
  ];

  readonly leadershipActions = [
    { key: 'strategy', icon: 'compass' },
    { key: 'systems', icon: 'cog' },
    { key: 'training', icon: 'book-open' },
    { key: 'tech', icon: 'cpu' },
    { key: 'carriers', icon: 'building-2' },
    { key: 'support', icon: 'life-buoy' },
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

        // 2) PREMISA: bloque y texto con delay.
        this.gsapService.initSectionEntrance(
          gsap,
          ScrollTrigger,
          '.gsap-premise',
          { y: 60, duration: 1 }
        );

        if (gsap.utils.toArray('.gsap-premise-text').length) {
          gsap.fromTo(
            '.gsap-premise-text',
            { y: 20, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.9,
              delay: 0.3,
              ease: 'power3.out',
              clearProps: 'all',
              scrollTrigger: {
                trigger: '.gsap-premise',
                start: 'top 85%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }

        // 3) TÍTULO DE ACCIONES: slide lateral.
        const actionsTitle = gsap.utils.toArray('.gsap-section-title')[0];
        if (actionsTitle) {
          gsap.fromTo(
            actionsTitle,
            { x: -30, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              duration: 0.8,
              ease: 'power3.out',
              clearProps: 'all',
              scrollTrigger: {
                trigger: actionsTitle,
                start: 'top 88%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }

        // 4) CARDS DE ACCIONES: stagger.
        this.gsapService.initStagger(gsap, ScrollTrigger, {
          selector: '.gsap-action-card',
          y: 50,
          stagger: 0.12,
        });

        // 5) ICONOS DE ACCIONES: efecto pop.
        this.gsapService.initIconPop(gsap, ScrollTrigger, '.gsap-action-icon', {
          rotate: -30,
        });

        // 6) CULTURA: imagen lateral con zoom out.
        if (gsap.utils.toArray('.gsap-culture-image').length) {
          gsap.fromTo(
            '.gsap-culture-image',
            { scale: 1.15, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: 1.3,
              ease: 'power2.out',
              clearProps: 'transform',
              scrollTrigger: {
                trigger: '.gsap-culture-block',
                start: 'top 80%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }

        // 7) TÍTULO DE CULTURA: slide lateral.
        const cultureTitle = gsap.utils.toArray(
          '.gsap-culture-block .gsap-section-title'
        )[0];
        if (cultureTitle) {
          gsap.fromTo(
            cultureTitle,
            { x: -30, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              duration: 0.8,
              ease: 'power3.out',
              clearProps: 'all',
              scrollTrigger: {
                trigger: '.gsap-culture-block',
                start: 'top 80%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }

        // 8) PILARES: stagger con pop elástico.
        const pillars = gsap.utils.toArray('.gsap-pillar');
        if (pillars.length) {
          gsap.fromTo(
            pillars,
            { y: 30, opacity: 0, scale: 0.9 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.6,
              stagger: 0.08,
              ease: 'back.out(1.4)',
              clearProps: 'all',
              scrollTrigger: {
                trigger: '.gsap-culture-block',
                start: 'top 75%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }

        // 9) Reveals genéricos (.animate-on-scroll).
        this.gsapService.initScrollReveals(gsap, ScrollTrigger);
      }
    );
  }

  ngOnDestroy(): void {
    this.gsapService.revertContext(this.gsapCtx);
    this.gsapService.killAllScrollTriggers();
  }
}
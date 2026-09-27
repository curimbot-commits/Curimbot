import {
  Component,
  ElementRef,
  Input,
  ViewChild,
  ViewChildren,
  QueryList,
  AfterViewInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-eye-tracker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- 🟢 MODO BADGE: fondo gradiente + robot (para login) -->
    <div
      *ngIf="withBadge; else bareMode"
      class="robot-badge rounded-2xl shadow-md flex items-center justify-center"
      style="background: linear-gradient(to bottom right, #02ab74, #7209b7);"
      [style.padding]="badgePadding"
    >
      <ng-container *ngTemplateOutlet="robotSvgTpl"></ng-container>
    </div>

    <!-- ⚪ MODO SUELTO: solo el robot, 100% del contenedor -->
    <ng-template #bareMode>
      <ng-container *ngTemplateOutlet="robotSvgTpl"></ng-container>
    </ng-template>

    <!-- 🧩 SVG reutilizable: ocupa el 100% del contenedor padre -->
    <ng-template #robotSvgTpl>
      <svg
        #robotSvg
        class="robot-svg block w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        [attr.stroke]="color"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <!-- Cuerpo del robot (Lucide original) -->
        <path d="M12 8V4H8" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <rect x="4" y="8" width="16" height="12" rx="2" />

        <!-- 👁️ Ojos ovalados verticales gruesos -->
        <g class="eye" #eyeGroup data-eye="left">
          <rect
            class="eye-ball"
            #eyeBall
            x="8"
            y="12.5"
            width="2"
            height="3"
            rx="1"
            ry="1"
            [attr.fill]="color"
            stroke="none"
          />
        </g>
        <g class="eye" #eyeGroup data-eye="right">
          <rect
            class="eye-ball"
            #eyeBall
            x="14"
            y="12.5"
            width="2"
            height="3"
            rx="1"
            ry="1"
            [attr.fill]="color"
            stroke="none"
          />
        </g>
      </svg>
    </ng-template>
  `,
  styles: [`
    :host {
      display: inline-block;
      /* 🔑 El tamaño lo define el contenedor padre */
      width: 100%;
      height: 100%;
      line-height: 0;
    }

    :host(.inline) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .robot-badge {
      width: 100%;
      height: 100%;
    }

    /* 👁️ Los ojos se escalan desde su propio centro al parpadear */
    .eye-ball {
      transform-box: fill-box;
      transform-origin: center;
      transition: transform 0.08s ease-out;
    }

    /* El grupo se mueve suavemente al seguir al ratón */
    .eye {
      transition: transform 0.05s linear;
    }
  `]
})
export class EyeTrackerComponent implements AfterViewInit, OnDestroy {
  /** 🔘 `true` = con badge gradiente (login). `false` = solo el robot. */
  @Input() withBadge = false;

  /** 🎨 Color del robot y de los ojos. */
  @Input() color = '#ffffff';

  /** 📏 Padding del badge (solo aplica si withBadge = true). */
  @Input() badgePadding = '10px';

  @ViewChild('robotSvg', { static: true })
  robotSvg!: ElementRef<SVGSVGElement>;

  @ViewChildren('eyeGroup')
  eyeGroups!: QueryList<ElementRef<SVGGElement>>;

  @ViewChildren('eyeBall')
  eyeBalls!: QueryList<ElementRef<SVGRectElement>>;

  private readonly MAX_OFFSET = 0.6;
  private readonly EYE_CENTER: Record<string, { x: number; y: number }> = {
    left: { x: 9, y: 14 },
    right: { x: 15, y: 14 },
  };

  private rafId: number | null = null;
  private mouseX = 0;
  private mouseY = 0;
  private blinkTimeout: any = null;

  ngAfterViewInit(): void {
    this.updateEyes();
    this.scheduleBlink();
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.blinkTimeout) clearTimeout(this.blinkTimeout);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;

    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.updateEyes();
      this.rafId = null;
    });
  }

  private updateEyes(): void {
    if (!this.robotSvg?.nativeElement) return;

    const svgEl = this.robotSvg.nativeElement;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = 24 / rect.width;
    const scaleY = 24 / rect.height;
    const svgMouseX = (this.mouseX - rect.left) * scaleX;
    const svgMouseY = (this.mouseY - rect.top) * scaleY;

    this.eyeGroups.forEach((groupRef) => {
      const group = groupRef.nativeElement;
      const eye = group.dataset['eye'];
      if (!eye) return;

      const center = this.EYE_CENTER[eye];
      const dx = svgMouseX - center.x;
      const dy = svgMouseY - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const offset = Math.min(distance, this.MAX_OFFSET);

      const newX = Math.cos(angle) * offset;
      const newY = Math.sin(angle) * offset;

      group.setAttribute('transform', `translate(${newX}, ${newY})`);
    });
  }

  private scheduleBlink(): void {
    const nextBlink = 3000 + Math.random() * 2000;
    this.blinkTimeout = setTimeout(() => {
      this.blink();
      this.scheduleBlink();
    }, nextBlink);
  }

  private blink(): void {
    this.eyeBalls.forEach((ref) => {
      ref.nativeElement.style.transform = 'scaleY(0.15)';
    });
    setTimeout(() => {
      this.eyeBalls.forEach((ref) => {
        ref.nativeElement.style.transform = '';
      });
    }, 130);
  }
}
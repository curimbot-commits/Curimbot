import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { EyeTrackerComponent } from '../Robot/eye-tracker.component';

interface CompanyLink {
  path: string;
  labelKey: string;
}

interface Partner {
  name: string;
  logo: string;
  alt: string;
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    LucideAngularModule,
    EyeTrackerComponent
],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {

  currentYear = new Date().getFullYear();

  /** Mismas rutas y claves que el header — consistencia garantizada */
  readonly companyLinks: CompanyLink[] = [
    { path: '/company/trayectoria',        labelKey: 'landing.company.trayectoria.badge' },
    { path: '/company/liderazgo',          labelKey: 'landing.company.liderazgo.badge' },
    { path: '/company/alcance',            labelKey: 'landing.company.alcance.badge' },
    { path: '/company/mision',             labelKey: 'landing.company.mision.badge' },
    { path: '/company/propuesta-de-valor', labelKey: 'landing.company.propuesta.badge' },
  ];

  readonly partners: Partner[] = [
    { name: 'Americo',             logo: 'assets/images/partners/Americo.webp',        alt: 'Americo' },
    { name: 'F&G',                 logo: 'assets/images/partners/FG.webp',              alt: 'Fidelity & Guaranty Life' },
    { name: 'National Life Group', logo: 'assets/images/partners/NLG.webp',             alt: 'National Life Group' },
    { name: 'American-Amicable',   logo: 'assets/images/partners/americanami.webp',     alt: 'American-Amicable' },
    { name: 'Mutual of Omaha',     logo: 'assets/images/partners/mutual-of-omaha.webp', alt: 'Mutual of Omaha' },
  ];

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}
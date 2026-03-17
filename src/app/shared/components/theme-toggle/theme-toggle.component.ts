import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, ThemeType } from '../../../core/services/theme.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-toggle.component.html',
  styleUrls: ['./theme-toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeToggleComponent {
  public readonly themeService = inject(ThemeService);
  public readonly currentTheme = toSignal(this.themeService.theme$);

  public setTheme(theme: ThemeType): void {
    this.themeService.setTheme(theme);
  }
}

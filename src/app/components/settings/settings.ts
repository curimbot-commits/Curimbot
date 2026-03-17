// src/app/features/settings/components/settings.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';

import { ZardSwitchComponent } from '@shared/components/switch/switch.component';
import { ProfileAvatar } from '@shared/components/profile-avatar/profile-avatar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import {
  UserPreferencesResponse,
  LanguageEnum,
  ThemeEnum,
  WeeklySummaryFormatEnum,
  LanguageOption,
  ThemeOption
} from '../../domain/models/user-preferences.model';

import { UserInfoResponse } from '../../domain/models/user.model';
import { UserPreferencesService } from 'src/app/services/api/user-preferences.service';
import { ThemeService, AppTheme } from 'src/app/services/theme/theme.service';
import { UserService } from 'src/app/services/api/user-service';
import { AlertService } from '@shared/components/alert/alert.service';
import { NavService } from '../navbar/navbar-services';

/**
 * Página de configuración del usuario.
 * Permite editar perfil, notificaciones, idioma, tema y acceso a convocatorias.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    LucideAngularModule,
    ZardSwitchComponent,
    ProfileAvatar,
    TranslateModule
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit, OnDestroy {
  // ==================================================================
  // REACTIVO
  // ==================================================================

  private destroy$ = new Subject<void>();
  profileForm!: FormGroup;

  // ==================================================================
  // ESTADO
  // ==================================================================

  preferences: UserPreferencesResponse | null = null;
  currentUser: UserInfoResponse | null = null;
  loading = false;
  saving = false;

  emailNotifications = true;
  pushNotifications = false;
  weeklySummary = true;
  weeklySummaryFormat = WeeklySummaryFormatEnum.PDF;
  convocatoriaEnabled: boolean | null = null;


  selectedLanguage = LanguageEnum.ES;
  selectedTheme = ThemeEnum.LIGHT;

  // ==================================================================
  // CONSTANTES
  // ==================================================================

  readonly languages: LanguageOption[] = [
    { code: LanguageEnum.ES, label: 'settings.languages.es', flag: '' },
    { code: LanguageEnum.EN, label: 'settings.languages.en', flag: '' }
  ];

  readonly themes: ThemeOption[] = [
    { code: ThemeEnum.LIGHT, label: 'settings.themes.light', icon: 'Sun' },
    { code: ThemeEnum.DARK, label: 'settings.themes.dark', icon: 'Moon' },
    { code: ThemeEnum.AUTO, label: 'settings.themes.auto', icon: 'Monitor' }
  ];

  // ==================================================================
  // SERVICIOS
  // ==================================================================

  private fb = inject(FormBuilder);
  private preferencesService = inject(UserPreferencesService);
  private userService = inject(UserService);
  private alertService = inject(AlertService);
  private navService = inject(NavService);
  private themeService = inject(ThemeService);
  private document = inject(DOCUMENT);
  private translate = inject(TranslateService);

  // ==================================================================
  // MEDIA QUERY PARA TEMA AUTOMÁTICO
  // ==================================================================

  private mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
  private systemThemeChangeHandler = () => {
    if (this.selectedTheme === ThemeEnum.AUTO) {
      this.themeService.applyTheme('auto');
    }
  };

  // ==================================================================
  // CICLO DE VIDA
  // ==================================================================

  constructor() {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadUserData();
    this.loadPreferences();
    this.mediaQueryList.addEventListener('change', this.systemThemeChangeHandler);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.mediaQueryList.removeEventListener('change', this.systemThemeChangeHandler);
  }

  // ==================================================================
  // INICIALIZACIÓN
  // ==================================================================

  /** Inicializa formulario de perfil */
  private initializeForms(): void {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  // ==================================================================
  // CARGA DE DATOS
  // ==================================================================

  /** Carga datos del usuario actual */
  private loadUserData(): void {
    this.loading = true;
    this.userService.getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: user => {
          this.currentUser = user;
          this.profileForm.patchValue({ name: user.name, email: user.email });
          this.loading = false;
        },
        error: () => {
          this.alertService.error(this.translate.instant('settings.alerts.loadUserError'), '');
          this.loading = false;
        }
      });
  }

  /** Carga preferencias del usuario */
  private loadPreferences(): void {
    this.preferencesService.getUserPreferences()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: prefs => {
          this.preferences = prefs;
          this.emailNotifications = prefs.email_notifications;
          this.pushNotifications = prefs.push_notifications;
          this.weeklySummary = prefs.weekly_summary;
          this.weeklySummaryFormat = prefs.weekly_summary_format;
          this.selectedLanguage = prefs.language;

          this.selectedTheme = prefs.theme;
          this.convocatoriaEnabled = prefs.convocatoria_enabled;

          this.applyTheme(this.selectedTheme);
          this.navService.setConvocatoriaEnabled(this.convocatoriaEnabled);
        },
        error: () => this.alertService.error(this.translate.instant('settings.alerts.loadPrefsError'), '')
      });
  }

  // ==================================================================
  // GUARDADO
  // ==================================================================

  /** Guarda cambios en el perfil */
  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.markAllAsTouched();
      return;
    }

    this.saving = true;
    const formValue = this.profileForm.value;

    this.preferencesService.updateUserProfile(formValue)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: user => {
          this.currentUser = user;
          this.alertService.success(this.translate.instant('settings.alerts.profileSuccess'), '');
          this.saving = false;
        },
        error: () => {
          this.alertService.error(this.translate.instant('settings.alerts.profileError'), '');
          this.saving = false;
        }
      });
  }

  /** Actualiza preferencias de notificaciones */
  updateNotificationPreferences(): void {
    const preferences = {
      email_notifications: this.emailNotifications,
      push_notifications: this.pushNotifications,
      weekly_summary: this.weeklySummary,
      weekly_summary_format: this.weeklySummaryFormat
    };


    this.preferencesService.updateNotificationPreferences(preferences)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.alertService.success(this.translate.instant('settings.alerts.notifSuccess'), ''),
        error: () => this.alertService.error(this.translate.instant('settings.alerts.notifError'), '')
      });
  }

  // ==================================================================
  // IDIOMA Y TEMA
  // ==================================================================

  /**
   * Cambia el idioma de la interfaz.
   * @param language Nuevo idioma
   */
  changeLanguage(language: LanguageEnum): void {
    this.selectedLanguage = language;
    this.preferencesService.updateInterfacePreferences({ language })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.alertService.success(this.translate.instant('settings.alerts.langSuccess'), ''),
        error: () => this.alertService.error(this.translate.instant('settings.alerts.langError'), '')
      });
  }

  /**
   * Cambia el tema de la aplicación.
   * @param theme Nuevo tema
   */
  changeTheme(theme: ThemeEnum): void {
    this.selectedTheme = theme;
    // Mapear ThemeEnum a AppTheme para el ThemeService
    const appTheme: AppTheme = theme === ThemeEnum.DARK ? 'dark' : theme === ThemeEnum.AUTO ? 'auto' : 'light';
    this.themeService.setTheme(appTheme);
    this.preferencesService.updateInterfacePreferences({ theme })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.alertService.success(this.translate.instant('settings.alerts.themeSuccess'), ''),
        error: () => this.alertService.error(this.translate.instant('settings.alerts.themeError'), '')
      });
  }

  /** Aplica tema al documento delegando al ThemeService */
  private applyTheme(theme: ThemeEnum): void {
    const appTheme: AppTheme = theme === ThemeEnum.DARK ? 'dark' : theme === ThemeEnum.AUTO ? 'auto' : 'light';
    this.themeService.applyTheme(appTheme);
  }

  // ==================================================================
  // CONVOCATORIAS
  // ==================================================================

  /**
   * Activa/desactiva acceso a convocatorias.
   * @param enabled Estado deseado
   */
  onConvocatoriaToggle(enabled: boolean): void {
    this.saving = true;
    this.preferencesService.updateConvocatoria(enabled)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.navService.setConvocatoriaEnabled(enabled);
          this.alertService.success(this.translate.instant('settings.alerts.convSuccess'), '');
          this.saving = false;
        },
        error: () => {
          this.alertService.error(this.translate.instant('settings.alerts.convError'), '');
          this.saving = false;
        }
      });
  }

  // ==================================================================
  // UTILIDADES
  // ==================================================================

  /** Envía email de prueba */
  sendTestEmail(): void {
    this.preferencesService.sendTestEmail()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.alertService.success(this.translate.instant('settings.alerts.emailSuccess'), ''),
        error: () => this.alertService.error(this.translate.instant('settings.alerts.emailError'), '')
      });
  }

  /** Obtiene iniciales del usuario */
  getUserInitials(): string {
    if (!this.currentUser?.name) return '??';
    const names = this.currentUser.name.trim().split(' ');
    return names.length >= 2
      ? (names[0][0] + names[1][0]).toUpperCase()
      : this.currentUser.name.substring(0, 2).toUpperCase();
  }

  /** Marca todos los campos como tocados */
  private markAllAsTouched(): void {
    Object.keys(this.profileForm.controls).forEach(key => {
      this.profileForm.get(key)?.markAsTouched();
    });
  }

  /** Verifica si un campo tiene error */
  hasError(field: string): boolean {
    const control = this.profileForm.get(field);
    return !!(control && control.invalid && control.touched);
  }

  /** Obtiene mensaje de error */
  getErrorMessage(field: string): string {
    const control = this.profileForm.get(field);
    if (control?.hasError('required')) return this.translate.instant('settings.errors.required');
    if (control?.hasError('email')) return this.translate.instant('settings.errors.invalidEmail');
    if (control?.hasError('minlength')) return this.translate.instant('settings.errors.minLength');
    if (control?.hasError('maxlength')) return this.translate.instant('settings.errors.maxLength');
    return '';
  }

  /** Ícono del tema seleccionado */
  get selectedThemeIcon(): string {
    return this.themes.find(t => t.code === this.selectedTheme)?.icon || 'Monitor';
  }

}
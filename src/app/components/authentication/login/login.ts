/* eslint-disable @angular-eslint/prefer-inject */

import {
  Component,
  OnDestroy,
  OnInit,
  EventEmitter,
  Output,
} from '@angular/core';
import { Auth as AuthService } from '../auth/auth';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '@shared/components/alert/alert.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from 'src/environments/environment';

/**
 * Componente de inicio de sesión.
 * Soporta autenticación básica, 2FA y redirección inteligente.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    LucideAngularModule,
    TranslateModule
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class Login implements OnInit, OnDestroy {
  // ==================== OUTPUTS ====================
  @Output() navigate = new EventEmitter<
    'landing' | 'login' | 'register' | 'forgot-password' | 'two_verification'
  >();

  // ==================== ESTADO DEL COMPONENTE ====================
  form!: FormGroup;
  isLoading = false;
  returnUrl = '/app/dashboard';
  showPassword = false;

  private destroy$ = new Subject<void>();

  // ==================== CONSTRUCTOR ====================
  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private alertService: AlertService,
    private translate: TranslateService
  ) { }

  // ==================== CICLO DE VIDA ====================
  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.returnUrl]);
      return;
    }

    this.initializeForm();
    this.returnUrl =
      this.route.snapshot.queryParams['returnUrl'] || '/app/dashboard';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== INICIALIZACIÓN ====================
  private initializeForm(): void {
    this.form = this.fb.group({
      email: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.pattern(
            /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
          ),
        ],
      ],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rememberMe: [false],
    });
  }

  // ==================== ENVÍO DEL FORMULARIO ====================
  onSubmitLogin(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const errors = this.collectFormErrors();
      this.alertService.showErrors(errors);
      return;
    }

    this.performLogin();
  }

  private performLogin(): void {
    this.isLoading = true;
    const { email, password, rememberMe } = this.form.value;
    this.authService
      .login(email, password, rememberMe)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoading = false;

          if (response?.requires_2fa) {
            this.handle2FARequired(email, password);
            return;
          }

          this.handleLoginSuccess();
        },
        error: (error) => {
          this.isLoading = false;

          if (error?.requires2FA) {
            this.handle2FARequired(email, password);
            return;
          }

          this.handleLoginError(error);
        },
      });
  }

  // ==================== MANEJO DE 2FA ====================
  private handle2FARequired(email: string, password: string): void {
    sessionStorage.setItem(
      'temp_2fa_auth',
      JSON.stringify({ email, password })
    );

    this.alertService.info(this.translate.instant('login.success.twoFactorRequired'), '', 3000);

    setTimeout(() => {
      if (this.navigate.observers.length > 0) {
        this.navigate.emit('two_verification');
      } else {
        this.router.navigate(['/twoverification'], {
          queryParams: { returnUrl: this.returnUrl },
        });
      }
    }, 500);
  }

  // ==================== ERRORES DE VALIDACIÓN ====================
  private collectFormErrors(): string[] {
    const errors: string[] = [];

    if (this.email?.errors) {
      if (this.email.errors['required']) {
        errors.push(this.translate.instant('login.errors.emailRequired'));
      }
      if (this.email.errors['email'] || this.email.errors['pattern']) {
        errors.push(this.translate.instant('login.errors.emailInvalid'));
      }
    }

    if (this.password?.errors) {
      if (this.password.errors['required']) {
        errors.push(this.translate.instant('login.errors.passwordRequired'));
      }
      if (this.password.errors['minlength']) {
        errors.push(this.translate.instant('login.errors.passwordMinLength'));
      }
    }

    return errors;
  }

  // ==================== ÉXITO ====================
  private handleLoginSuccess(): void {
    this.alertService.success(this.translate.instant('login.success.loginSuccess'), '', 2000);

    setTimeout(() => {
      this.router.navigateByUrl(this.returnUrl);
    }, 500);
  }

  // ==================== ERRORES DE AUTENTICACIÓN ====================
  private handleLoginError(err: unknown): void {
    this.isLoading = false;
    let errorTitle = this.translate.instant('login.errors.authTitle');
    let duration = 4000;

    if (err instanceof HttpErrorResponse) {
      const detail = err.error?.detail || '';

      switch (err.status) {
        case 401:
          if (
            detail.includes('Credenciales inválidas') ||
            detail.includes('Credenciales incorrectas')
          ) {
            errorTitle = this.translate.instant('login.errors.invalidCredentialsTitle');
            duration = 5000;
          } else if (
            detail.includes('Cuenta desactivada') ||
            detail.includes('Usuario desactivado')
          ) {
            errorTitle = this.translate.instant('login.errors.accountDisabledTitle');
            duration = 6000;
          } else if (
            detail.includes('Token expirado') ||
            detail.includes('Token inválido')
          ) {
            errorTitle = this.translate.instant('login.errors.sessionExpiredTitle');
            duration = 4000;
          } else if (detail.includes('Token revocado')) {
            errorTitle = this.translate.instant('login.errors.sessionClosedTitle');
            duration = 4000;
          } else {
            errorTitle = this.translate.instant('login.errors.unauthorizedTitle');
          }
          break;

        case 403:
          if (
            detail.includes('Cuenta bloqueada') ||
            detail.includes('demasiados intentos')
          ) {
            errorTitle = this.translate.instant('login.errors.accountLockedTitle');
            duration = 7000;
          } else if (
            detail.includes('permisos') ||
            detail.includes('administrador')
          ) {
            errorTitle = this.translate.instant('login.errors.insufficientPermissionsTitle');
            duration = 5000;
          } else {
            errorTitle = this.translate.instant('login.errors.forbiddenAccessTitle');
          }
          break;

        case 404:
          if (detail.includes('Usuario no encontrado')) {
            errorTitle = this.translate.instant('login.errors.userNotFoundTitle');
            duration = 5000;
          } else {
            errorTitle = this.translate.instant('login.errors.resourceNotFoundTitle');
          }
          break;

        case 409:
          if (detail.includes('Sesión activa')) {
            errorTitle = this.translate.instant('login.errors.activeSessionTitle');
            duration = 5000;
          } else {
            errorTitle = this.translate.instant('login.errors.conflictTitle');
          }
          break;

        case 422:
          errorTitle = this.translate.instant('login.errors.invalidDataTitle');
          duration = 5000;
          break;

        case 429:
          errorTitle = this.translate.instant('login.errors.tooManyAttemptsTitle');
          duration = 6000;
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          errorTitle = this.translate.instant('login.errors.serverErrorTitle');
          duration = 5000;
          break;

        case 0:
          errorTitle = this.translate.instant('login.errors.connectionErrorTitle');
          duration = 6000;
          break;

        default:
          errorTitle = this.translate.instant('login.errors.unexpectedErrorTitle');
          duration = 5000;
      }
    } else if (err instanceof Error) {
      errorTitle = err.message || this.translate.instant('login.errors.unexpectedErrorTitle');
    }

    this.alertService.error(errorTitle, '', duration);
    this.form.patchValue({ password: '' });
  }

  // ==================== UTILIDADES UI ====================
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  register(): void {
    if (this.navigate.observers.length > 0) {
      this.navigate.emit('register');
    } else {
      this.router.navigate(['/register']);
    }
  }

  password_reset(): void {
    if (this.navigate.observers.length > 0) {
      this.navigate.emit('forgot-password');
    } else {
      this.router.navigate(['/passwordreset']);
    }
  }

  // ==================== GETTERS ====================
  get email() {
    return this.form.get('email');
  }

  get password() {
    return this.form.get('password');
  }

  get emailError(): string {
    if (this.email?.hasError('required') && this.email?.touched) {
      return this.translate.instant('login.errors.emailRequired');
    }
    if (this.email?.hasError('email') || this.email?.hasError('pattern')) {
      return this.translate.instant('login.errors.emailInvalid');
    }
    return '';
  }

  get passwordError(): string {
    if (this.password?.hasError('required') && this.password?.touched) {
      return this.translate.instant('login.errors.passwordRequired');
    }
    if (this.password?.hasError('minlength')) {
      return this.translate.instant('login.errors.passwordMinLength');
    }
    return '';
  }
  // Botones de login 
  loginWithGoogle(): void {
    window.location.href = `${environment.apiUrl}/auth/google/login`;
  }

  loginWithGitHub(): void {
    window.location.href = `${environment.apiUrl}/auth/github/login`;
  }
}
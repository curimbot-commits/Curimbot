/* eslint-disable @angular-eslint/prefer-inject */

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Auth as AuthService } from '../auth/auth';
import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
  FormGroup,
  Validators,
  FormControl,
  ReactiveFormsModule,
  FormBuilder
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { AlertService } from '@shared/components/alert/alert.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

/**
 * Validador personalizado: fuerza una contraseña fuerte.
 * Requiere: mayúscula, minúscula, número, carácter especial y mínimo 8 caracteres.
 */
export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null;

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumeric = /[0-9]/.test(value);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
    const isLongEnough = value.length >= 8;

    return hasUpperCase && hasLowerCase && hasNumeric && hasSpecial && isLongEnough
      ? null
      : { weakPassword: true };
  };
}

/**
 * Validador de grupo: verifica que las contraseñas coincidan.
 */
export function passwordMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password && confirmPassword && password !== confirmPassword
      ? { passwordMismatch: true }
      : null;
  };
}

/**
 * Componente de registro de usuarios.
 * Incluye validaciones avanzadas de formulario y manejo completo de errores.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    LucideAngularModule,
    TranslateModule
  ],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnInit {
  registerForm!: FormGroup;
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private alertService: AlertService,
    private translate: TranslateService
  ) {}

  // ==================== CICLO DE VIDA ====================

  ngOnInit(): void {
    this.initializeForm();
  }

  // ==================== INICIALIZACIÓN DEL FORMULARIO ====================

  /**
   * Configura el formulario con validaciones robustas:
   * - Nombre: sin números, 2-50 caracteres
   * - Email: formato válido, máx. 100
   * - Contraseña: 8+ caracteres, mayúscula, minúscula, número, especial
   * - Confirmación: debe coincidir
   * - Términos: aceptación obligatoria
   */
  private initializeForm(): void {
    this.registerForm = new FormGroup({
      name: new FormControl('', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(/^[^0-9]*$/)
      ]),
      email: new FormControl('', [
        Validators.required,
        Validators.email,
        Validators.maxLength(100)
      ]),
      password: new FormControl('', [
        Validators.required,
        Validators.minLength(8),
        passwordStrengthValidator()
      ]),
      confirmPassword: new FormControl('', [Validators.required]),
      terms: new FormControl(false, Validators.requiredTrue)
    }, { validators: passwordMatchValidator() });

    // Actualiza confirmación cuando cambia la contraseña
    this.registerForm.get('password')?.valueChanges.subscribe(() => {
      this.registerForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  // ==================== ENVÍO DEL FORMULARIO ====================

  /**
   * Procesa el envío del formulario.
   * Valida localmente antes de enviar al backend.
   */
  onSubmitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      const errors = this.collectFormErrors();
      this.alertService.showErrors(errors);
      return;
    }

    this.performRegistration();
  }

  /**
   * Envía los datos al servicio de autenticación.
   */
  private performRegistration(): void {
    this.isLoading = true;
    const { name, email, password, confirmPassword } = this.registerForm.value;
    const userData = { name, email, password, password_confirm: confirmPassword };

    this.authService.signup(userData).subscribe({
      next: () => {
        this.isLoading = false;
        this.handleSuccessfulRegistration();
      },
      error: (err) => {
        this.isLoading = false;
        this.handleRegistrationError(err);
      }
    });
  }

  // ==================== MANEJO DE ERRORES LOCALES ====================

  private collectFormErrors(): string[] {
    const errors: string[] = [];

    if (this.name?.errors) {
      if (this.name.errors['required']) {
        errors.push(this.translate.instant('register.errors.nameRequired'));
      }
      if (this.name.errors['minlength']) {
        errors.push(this.translate.instant('register.errors.nameMinLength'));
      }
      if (this.name.errors['maxlength']) {
        errors.push(this.translate.instant('register.errors.nameMaxLength'));
      }
      if (this.name.errors['pattern']) {
        errors.push(this.translate.instant('register.errors.namePattern'));
      }
    }

    if (this.email?.errors) {
      if (this.email.errors['required']) {
        errors.push(this.translate.instant('register.errors.emailRequired'));
      }
      if (this.email.errors['email']) {
        errors.push(this.translate.instant('register.errors.emailInvalid'));
      }
      if (this.email.errors['maxlength']) {
        errors.push(this.translate.instant('register.errors.emailMaxLength'));
      }
    }

    if (this.password?.errors) {
      if (this.password.errors['required']) {
        errors.push(this.translate.instant('register.errors.passwordRequired'));
      }
      if (this.password.errors['minlength']) {
        errors.push(this.translate.instant('register.errors.passwordMinLength'));
      }
      if (this.password.errors['weakPassword']) {
        errors.push(this.translate.instant('register.errors.weakPassword'));
      }
    }

    if (this.registerForm.errors?.['passwordMismatch']) {
      errors.push(this.translate.instant('register.errors.passwordMismatch'));
    }

    if (!this.termsAccepted) {
      errors.push(this.translate.instant('register.errors.termsRequired'));
    }

    return errors;
  }

  // ==================== RESPUESTAS DEL SERVIDOR ====================

  private handleSuccessfulRegistration(): void {
    this.alertService.success(this.translate.instant('register.success.registerSuccess'), '');

    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 2000);
  }

  private handleRegistrationError(err: unknown): void {
    let errorMessage = this.translate.instant('register.errors.registerErrorHeader');

    if (err instanceof HttpErrorResponse) {
      errorMessage = this.getHttpErrorMessage(err);
    }

    this.alertService.error(errorMessage, '', 4000);
  }

  private getHttpErrorMessage(err: HttpErrorResponse): string {
    switch (err.status) {
      case 400:
        return err.error?.detail || this.translate.instant('register.errors.invalidData');
      case 409:
        return this.translate.instant('register.errors.conflict');
      case 422:
        return this.translate.instant('register.errors.unprocessable');
      case 500:
        return this.translate.instant('register.errors.serverError');
      default:
        return err.error?.detail || `${this.translate.instant('login.errors.unexpectedErrorTitle')}: ${err.status}`;
    }
  }

  // ==================== NAVEGACIÓN ====================

  /**
   * Redirige al formulario de inicio de sesión.
   */
  login(): void {
    this.router.navigate(['/login']);
  }

  // ==================== GETTERS PARA TEMPLATE ====================

  get termsAccepted(): boolean {
    return this.registerForm.get('terms')?.value;
  }

  get name() {
    return this.registerForm.get('name');
  }

  get email() {
    return this.registerForm.get('email');
  }

  get password() {
    return this.registerForm.get('password');
  }

  get confirmPassword() {
    return this.registerForm.get('confirmPassword');
  }
}
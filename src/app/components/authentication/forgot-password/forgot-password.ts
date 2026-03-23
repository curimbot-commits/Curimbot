/* eslint-disable @angular-eslint/prefer-inject */
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { LucideAngularModule } from 'lucide-angular';
import { PasswordResetService } from 'src/app/services/api/password-reset.service';
import { AlertService } from '@shared/components/alert/alert.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, LucideAngularModule, TranslateModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css']
})
export class ForgotPassword implements OnInit {
  forgotPasswordForm!: FormGroup;
  isLoading = false;

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private passwordResetService: PasswordResetService,
    private alertService: AlertService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  get email() {
    return this.forgotPasswordForm.get('email');
  }

  onSubmit(): void {
  if (this.forgotPasswordForm.invalid || this.isLoading) {
    this.markFormGroupTouched(this.forgotPasswordForm);
    this.alertService.warning(this.translate.instant('forgotPassword.errors.emailWarning'), '');
    return;
  }

  this.isLoading = true;
  const email = this.email?.value;

  this.passwordResetService.checkEmailExists(email).subscribe({
    next: (exists: boolean) => {
      if (!exists) {
        this.isLoading = false;
        this.alertService.error(this.translate.instant('forgotPassword.errors.emailNotFound'), '');
        return;
      }

      // Si existe, enviamos el correo
      this.passwordResetService.requestPasswordReset(email).subscribe({
        next: () => {
          this.isLoading = false;
          this.alertService.success(this.translate.instant('forgotPassword.success.sendSuccess'), '');
          this.router.navigate(['/checkemail'], { queryParams: { email } });
        },
        error: () => {
          this.isLoading = false;
          this.alertService.error(this.translate.instant('forgotPassword.errors.sendError'), '');
        }
      });
    },
    error: () => {
      this.isLoading = false;
      this.alertService.error(this.translate.instant('forgotPassword.errors.verifyError'), '');
    }
  });
}


  login(): void {
    this.router.navigate(['/login']);
  }

  register(): void {
    this.router.navigate(['/register']);
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}

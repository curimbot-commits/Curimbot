/* eslint-disable @angular-eslint/prefer-inject */
import { Component, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { PasswordResetService } from 'src/app/services/api/password-reset.service';
import { AlertService } from '@shared/components/alert/alert.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-check-email',
  standalone: true,
  imports: [LucideAngularModule, CommonModule, RouterModule, TranslateModule],
  templateUrl: './check-email.html',
  styleUrls: ['./check-email.css']
})
export class CheckEmail implements OnDestroy {
  email = '';
  isLoading = false;
  canResend = true;
  resendCountdown = 0;
  private resendInterval?: ReturnType<typeof setInterval>;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private passwordResetService: PasswordResetService,
    private alertService: AlertService,
    private translate: TranslateService
  ) {
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] || '';
    });
  }

  resendEmail(): void {
    if (!this.canResend || this.isLoading || !this.email) return;

    this.isLoading = true;

    this.passwordResetService.requestPasswordReset(this.email).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.alertService.info(
          this.translate.instant('checkEmail.success.resendSuccessHeader'),
          response.message || this.translate.instant('checkEmail.success.resendSuccess')
        );
        this.startResendCountdown();
      },
      error: (error) => {
        this.isLoading = false;

        if (error.status === 0) {
          this.alertService.error(
            this.translate.instant('checkEmail.errors.noConnectionHeader'),
            this.translate.instant('checkEmail.errors.noConnection')
          );
        } else if (error.error?.detail) {
          this.alertService.warning(this.translate.instant('checkEmail.errors.attention'), error.error.detail);
        } else {
          this.alertService.error(
            this.translate.instant('checkEmail.errors.resendErrorHeader'),
            this.translate.instant('checkEmail.errors.resendError')
          );
        }
      }
    });
  }

  private startResendCountdown(): void {
    this.canResend = false;
    this.resendCountdown = 60;

    this.resendInterval = setInterval(() => {
      this.resendCountdown--;

      if (this.resendCountdown <= 0) {
        this.canResend = true;
        clearInterval(this.resendInterval);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.resendInterval) {
      clearInterval(this.resendInterval);
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}

/* eslint-disable @angular-eslint/prefer-inject */
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { LucideAngularModule } from "lucide-angular";
import { UserService } from 'src/app/services/api/user-service'

import { NgOtpInputComponent } from "ng-otp-input";
import { AlertService } from '@shared/components/alert/alert.service';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

type SetupStep = 'qr' | 'verify' | 'backup';

@Component({
  selector: 'app-two-factor-setup-dialog',
  imports: [LucideAngularModule, FormsModule, NgOtpInputComponent, TranslateModule],
  templateUrl: './two-factor-setup-dialog.html',
  styleUrl: './two-factor-setup-dialog.css'
})
export class TwoFactorSetupDialog implements OnChanges {
  digit = '';
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();
  @Output() setupComplete = new EventEmitter<void>();
  @Output() setupCancelled = new EventEmitter<void>();

  step: SetupStep = 'qr';
  verificationCode = ['', '', '', '', '', ''];
  copiedSecret = false;
  copiedBackup = false;

  secretKey = '';
  qrCodeUrl = '';
  backupCodes: string[] = [];

  constructor(private userService: UserService, private alertService: AlertService, private translate: TranslateService) { }


  @Input() isAlreadyEnabled = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && changes['open'].currentValue) {
      this.initializeSetup();
    }
  }

  initializeSetup(): void {
    if (this.step === 'backup' && !this.isAlreadyEnabled) return;

    this.verificationCode = ['', '', '', '', '', ''];
    this.copiedSecret = false;
    this.copiedBackup = false;

    if (this.isAlreadyEnabled) {
      this.step = 'backup';
      this.userService.getBackupCodes().subscribe({
        next: (response) => {
          this.backupCodes = response.backup_codes || [];
        },
        error: (error) => {
          console.error('Error al obtener códigos de respaldo:', error);
          this.showToast(this.translate.instant('security.alerts.getBackupCodesError'), 'error');
          this.closeDialog();
        }
      });
    } else {
      this.step = 'qr';
      this.userService.setup2FA().subscribe({
        next: (response) => {
          this.secretKey = response.secret;
          this.qrCodeUrl = response.qr_code;
          this.backupCodes = response.backup_codes || [];
        },
        error: (error) => {
          console.error('Error setting up 2FA:', error);

          if (error.status === 400 && error.error?.detail) {
            
            this.showToast(error.error.detail, 'error');
            
          } else {
            this.showToast(this.translate.instant('security.alerts.setup2faError'), 'error');
            this.closeDialog();
          }
        }
      });
    }
  }


  handleOtpInput(otp: string): void {
    this.verificationCode = otp.split('');
    
  }

  handleOtpKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.verificationCode[index] && index > 0) {
      const prevInput = (event.target as HTMLElement).previousElementSibling as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
        this.verificationCode[index - 1] = '';
      }
    }
  }

  handleCopySecret(): void {
    navigator.clipboard.writeText(this.secretKey);
    this.copiedSecret = true;
    this.showToast(this.translate.instant('security.alerts.secretCopied'), 'success');
    setTimeout(() => this.copiedSecret = false, 2000);
  }

  handleCopyBackupCodes(): void {
    const codesText = this.backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    this.copiedBackup = true;
    this.showToast(this.translate.instant('security.alerts.backupCopied'), 'success');
    setTimeout(() => this.copiedBackup = false, 2000);
  }

  handleDownloadBackupCodes(): void {
    const title = this.translate.instant('security.setup2fa.downloadContentTitle');
    const footer = this.translate.instant('security.setup2fa.downloadContentFooter');
    const content = `${title}${this.backupCodes.join('\n')}${footer}${new Date().toLocaleString()}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codigos-respaldo-2fa.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(this.translate.instant('security.alerts.codesDownloaded'), 'success');
  }

  continueToVerify(): void {
    this.step = 'verify';
    this.verificationCode = ['', '', '', '', '', ''];
  }

  goBack(): void {
    if (this.step === 'verify') {
      this.step = 'qr';
      this.verificationCode = ['', '', '', '', '', ''];
    }
  }

  handleVerify(): void {
    const code = this.verificationCode.join('');

    if (code.length !== 6) {
      this.showToast(this.translate.instant('security.alerts.enter6digits'), 'error');
      return;
    }

    this.userService.confirm2FA({ code }).subscribe({
      next: () => {
        this.showToast(this.translate.instant('security.alerts.codeVerified'), 'success');
        this.step = 'backup';
      },
      error: (error) => {
        console.error('Error verifying 2FA:', error);
        this.showToast(this.translate.instant('security.alerts.wrongCode'), 'error');
        this.verificationCode = ['', '', '', '', '', ''];
        setTimeout(() => {
          const firstInput = document.querySelector('.otp-input') as HTMLInputElement;
          if (firstInput) firstInput.focus();
        }, 100);
      }
    });
  }

  handleComplete(): void {
    this.showToast(this.translate.instant('security.alerts.setup2faSuccess'), 'success');
    this.setupComplete.emit();
    this.closeDialog();
  }

  async handleCancel(): Promise<void> {
    const confirmed = await this.alertService.confirm(
      this.translate.instant('alerts.confirm'),
      this.translate.instant('security.alerts.cancelConfirm')
    );

    if (confirmed) {
      this.setupCancelled.emit();
      this.closeDialog();
    }
  }

  closeDialog(): void {
    this.openChange.emit(false);
    setTimeout(() => {
      this.step = 'qr';
      this.verificationCode = ['', '', '', '', '', ''];
      this.copiedSecret = false;
      this.copiedBackup = false;
    }, 300);
  }

  get isCodeComplete(): boolean {
    return this.verificationCode.every(digit => digit !== '');
  }

  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
  switch(type) {
    case 'success':
      this.alertService.success(this.translate.instant('alerts.success'), message);
      break;
    case 'error':
      this.alertService.error(this.translate.instant('alerts.error'), message);
      break;
    case 'info':
    default:
      this.alertService.info(this.translate.instant('alerts.info'), message);
      break;
  }
}

}

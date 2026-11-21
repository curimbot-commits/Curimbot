/* eslint-disable @angular-eslint/prefer-inject */
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { UserService } from 'src/app/services/api/user-service';

import { NgOtpInputComponent } from 'ng-otp-input';
import { AlertService } from '@shared/components/alert/alert.service';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

/**
 * - setup:      escanear QR → verificar código → guardar códigos de respaldo
 * - regenerate: verificar código → guardar los códigos nuevos
 * - disable:    verificar código (app o respaldo) → 2FA desactivado
 */
export type TwoFactorDialogMode = 'setup' | 'regenerate' | 'disable';
type Step = 'qr' | 'verify' | 'backup';

@Component({
  selector: 'app-two-factor-setup-dialog',
  imports: [LucideAngularModule, FormsModule, NgOtpInputComponent, TranslateModule],
  templateUrl: './two-factor-setup-dialog.html',
  styleUrl: './two-factor-setup-dialog.css'
})
export class TwoFactorSetupDialog implements OnChanges {
  @Input() open = false;
  @Input() mode: TwoFactorDialogMode = 'setup';
  @Output() openChange = new EventEmitter<boolean>();
  /** Se emite al terminar el flujo del modo actual. */
  @Output() completed = new EventEmitter<TwoFactorDialogMode>();
  /** Se emite si el usuario cierra el diálogo sin terminar. */
  @Output() cancelled = new EventEmitter<TwoFactorDialogMode>();

  step: Step = 'qr';
  code = '';
  /** En modo disable: usar un código de respaldo en vez del de la app. */
  useBackupCode = false;
  busy = false;
  copiedSecret = false;
  copiedBackup = false;

  secretKey = '';
  qrCodeUrl = '';
  backupCodes: string[] = [];

  /** Para vaciar las casillas tras un código incorrecto. */
  @ViewChild(NgOtpInputComponent) private otpInput?: NgOtpInputComponent;

  constructor(
    private userService: UserService,
    private alertService: AlertService,
    private translate: TranslateService,
    // El padre (Security) es OnPush: los cambios hechos en callbacks async deben marcarse.
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) this.start();
  }

  private start(): void {
    this.code = '';
    this.useBackupCode = false;
    this.busy = false;
    this.copiedSecret = false;
    this.copiedBackup = false;
    this.backupCodes = [];

    if (this.mode !== 'setup') {
      this.step = 'verify';
      return;
    }

    this.step = 'qr';
    this.secretKey = '';
    this.qrCodeUrl = '';
    this.userService.setup2FA().subscribe({
      next: (response) => {
        this.secretKey = response.secret;
        this.qrCodeUrl = response.qr_code;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.toast(error?.error?.detail || this.t('security.alerts.setup2faError'), 'error');
        this.close();
      }
    });
  }

  get codeIsValid(): boolean {
    return this.useBackupCode
      ? /^[0-9A-Fa-f]{8}$/.test(this.code.trim())
      : /^\d{6}$/.test(this.code);
  }

  get titleKey(): string {
    return {
      setup: 'security.setup2fa.title',
      regenerate: 'security.setup2fa.regenerateTitle',
      disable: 'security.setup2fa.disableTitle',
    }[this.mode];
  }

  get descriptionKey(): string {
    if (this.step === 'qr') return 'security.setup2fa.step1Desc';
    if (this.step === 'backup') return 'security.setup2fa.step3Desc';
    return {
      setup: 'security.setup2fa.step2Desc',
      regenerate: 'security.setup2fa.regenerateDesc',
      disable: 'security.setup2fa.disableDesc',
    }[this.mode];
  }

  onOtpChange(otp: string): void {
    this.code = otp;
  }

  toggleBackupCode(): void {
    this.useBackupCode = !this.useBackupCode;
    this.code = '';
  }

  continueToVerify(): void {
    this.step = 'verify';
    this.code = '';
  }

  goBack(): void {
    if (this.mode === 'setup' && this.step === 'verify') {
      this.step = 'qr';
      this.code = '';
    }
  }

  submitCode(): void {
    if (!this.codeIsValid || this.busy) {
      this.toast(this.t('security.alerts.enter6digits'), 'error');
      return;
    }
    const code = this.code.trim();
    this.busy = true;

    if (this.mode === 'setup') {
      this.userService.confirm2FA({ code }).subscribe({
        next: (response) => {
          this.busy = false;
          this.backupCodes = response.backup_codes || [];
          this.toast(this.t('security.alerts.codeVerified'), 'success');
          this.step = 'backup';
          this.cdr.markForCheck();
        },
        error: () => this.onWrongCode(),
      });
    } else if (this.mode === 'regenerate') {
      this.userService.regenerateBackupCodes({ code }).subscribe({
        next: (response) => {
          this.busy = false;
          this.backupCodes = response.backup_codes || [];
          this.step = 'backup';
          this.cdr.markForCheck();
        },
        error: () => this.onWrongCode(),
      });
    } else {
      this.userService.disable2FA({ code }).subscribe({
        next: () => {
          this.busy = false;
          this.completed.emit('disable');
          this.close();
        },
        error: () => this.onWrongCode(),
      });
    }
  }

  private onWrongCode(): void {
    this.busy = false;
    this.code = '';
    this.otpInput?.setValue('');
    this.toast(this.t('security.alerts.wrongCode'), 'error');
    this.cdr.markForCheck();
  }

  copySecret(): void {
    navigator.clipboard.writeText(this.secretKey);
    this.copiedSecret = true;
    this.toast(this.t('security.alerts.secretCopied'), 'success');
    setTimeout(() => { this.copiedSecret = false; this.cdr.markForCheck(); }, 2000);
  }

  copyBackupCodes(): void {
    navigator.clipboard.writeText(this.backupCodes.join('\n'));
    this.copiedBackup = true;
    this.toast(this.t('security.alerts.backupCopied'), 'success');
    setTimeout(() => { this.copiedBackup = false; this.cdr.markForCheck(); }, 2000);
  }

  downloadBackupCodes(): void {
    const title = this.t('security.setup2fa.downloadContentTitle');
    const footer = this.t('security.setup2fa.downloadContentFooter');
    const content = `${title}${this.backupCodes.join('\n')}${footer}${new Date().toLocaleString()}`;

    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = this.t('security.setup2fa.downloadFileName');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.toast(this.t('security.alerts.codesDownloaded'), 'success');
  }

  finish(): void {
    this.completed.emit(this.mode);
    this.close();
  }

  /** Cerrar desde el fondo o el botón Cancelar. */
  async requestClose(): Promise<void> {
    // Con los códigos ya mostrados el flujo está terminado: cerrar = finalizar.
    if (this.step === 'backup') { this.finish(); return; }

    if (this.mode === 'setup') {
      const confirmed = await this.alertService.confirm(
        this.t('alerts.confirm'),
        this.t('security.alerts.cancelConfirm')
      );
      if (!confirmed) return;
    }
    this.cancelled.emit(this.mode);
    this.close();
  }

  private close(): void {
    this.openChange.emit(false);
  }

  private t(key: string): string {
    return this.translate.instant(key);
  }

  private toast(message: string, type: 'success' | 'error'): void {
    if (type === 'success') this.alertService.success(this.t('alerts.success'), message);
    else this.alertService.error(this.t('alerts.error'), message);
  }
}

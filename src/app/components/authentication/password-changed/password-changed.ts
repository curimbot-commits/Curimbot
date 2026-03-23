/* eslint-disable @angular-eslint/prefer-inject */


import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertService } from '@shared/components/alert/alert.service';
import { LucideAngularModule } from "lucide-angular";
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-password-changed',
  imports: [LucideAngularModule, TranslateModule],
  templateUrl: './password-changed.html',
  styleUrl: './password-changed.css'
})
export class PasswordChanged {

  constructor(
    private router: Router,
     private alertService: AlertService
  ) {}

  login(): void {
    this.router.navigate(['/login']);
  }
}
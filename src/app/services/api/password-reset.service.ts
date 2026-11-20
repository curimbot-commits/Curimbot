/* eslint-disable @angular-eslint/prefer-inject */
// src/app/core/services/password-reset.service.ts

import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

import {
  PasswordResetRequest,
  PasswordResetConfirm,
  PasswordResetResponse,
} from 'src/app/domain/models/password-reset.model';

/**
 * Servicio para manejar las operaciones de recuperación y restablecimiento de contraseña.
 * 
 * Incluye validaciones de correo, token, fortaleza de contraseña
 * y conexión directa con los endpoints del backend relacionados
 * con recuperación de contraseñas.
 */
@Injectable({
  providedIn: 'root'
})
export class PasswordResetService {

  /** URL base del endpoint de recuperación de contraseñas */
  private readonly API_URL = `${environment.apiUrl}/password-reset`;

  constructor(private http: HttpClient) {}

  // ==================================================================
  // VALIDACIÓN DE CORREO
  // ==================================================================

  /**
   * Verifica si el correo existe antes de enviar el email de recuperación.
   * @param email Correo electrónico del usuario
   * @returns Observable<boolean> indicando si el correo existe
   */
  checkEmailExists(email: string): Observable<boolean> {
    return this.http
      .get<{ exists: boolean }>(`${this.API_URL}/check-email?email=${email}`)
      .pipe(map(response => response.exists));
  }

  // ==================================================================
  // SOLICITUD DE RESTABLECIMIENTO
  // ==================================================================

  /**
   * Solicita el envío del email de recuperación de contraseña.
   * @param email Correo electrónico del usuario
   * @returns Observable con la respuesta del servidor
   */
  requestPasswordReset(email: string): Observable<PasswordResetResponse> {
    const data: PasswordResetRequest = { email };
    return this.http.post<PasswordResetResponse>(`${this.API_URL}/request`, data);
  }

  // ==================================================================
  // RESTABLECIMIENTO DE CONTRASEÑA
  // ==================================================================

  /**
   * Envía el token y la nueva contraseña para actualizar la cuenta.
   * @param token Token de validación
   * @param newPassword Nueva contraseña
   * @returns Observable con la respuesta del servidor
   */
  resetPassword(token: string, newPassword: string): Observable<PasswordResetResponse> {
    const data: PasswordResetConfirm = { token, new_password: newPassword };
    return this.http.post<PasswordResetResponse>(`${this.API_URL}/reset`, data);
  }
}
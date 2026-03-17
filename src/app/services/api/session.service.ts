import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActiveSession, RevokeSessionResponse } from '@domain/models/session.model';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private apiUrl = `${environment.apiUrl}/auth/sessions`;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene la lista de sesiones activas del usuario.
   */
  getActiveSessions(): Observable<ActiveSession[]> {
    return this.http.get<ActiveSession[]>(`${this.apiUrl}/active`);
  }

  /**
   * Revoca una sesión específica por su ID.
   */
  revokeSession(sessionId: number): Observable<RevokeSessionResponse> {
    return this.http.post<RevokeSessionResponse>(`${this.apiUrl}/revoke/${sessionId}`, {});
  }

  /**
   * Revoca todas las sesiones excepto la actual.
   */
  revokeOtherSessions(): Observable<RevokeSessionResponse> {
    return this.http.post<RevokeSessionResponse>(`${this.apiUrl}/revoke-others`, {});
  }
}

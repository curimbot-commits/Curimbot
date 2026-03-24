// src/app/services/interceptors/credentials.interceptor.ts

import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Interceptor que agrega withCredentials: true a todas las requests
 * dirigidas al backend, permitiendo que las cookies HttpOnly
 * (access_token, refresh_token) se envíen automáticamente en cada request.
 *
 * Sin esto, el navegador bloquea el envío de cookies en requests
 * cross-origin (localhost:4200 → localhost:8000) por política SameSite.
 */
@Injectable()
export class CredentialsInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Solo agregar credentials a requests dirigidas al backend propio
    if (req.url.startsWith(environment.apiUrl)) {
      const cloned = req.clone({ withCredentials: true });
      return next.handle(cloned);
    }
    return next.handle(req);
  }
}
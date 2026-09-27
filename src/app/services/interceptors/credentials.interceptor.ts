/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/services/interceptors/credentials.interceptor.ts

import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Interceptor funcional que agrega withCredentials: true a todas las
 * requests dirigidas al backend, permitiendo que las cookies HttpOnly
 * (access_token, refresh_token) se envíen automáticamente.
 *
 * Sin esto, el navegador bloquea el envío de cookies en requests
 * cross-origin (localhost:4200 → localhost:8000).
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith(environment.apiUrl)) {
    const cloned = req.clone({ withCredentials: true });
    return next(cloned);
  }
  return next(req);
};
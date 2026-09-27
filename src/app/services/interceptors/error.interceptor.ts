/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/services/interceptors/error.interceptor.ts

import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AlertService } from '@shared/components/alert/alert.service';

/**
 * Interceptor funcional que captura errores HTTP y muestra alertas al usuario.
 *
 * - Ignora 401 y 403 (los maneja authInterceptor).
 * - Inyecta AlertService de forma diferida dentro del catchError
 *   para evitar ciclos si AlertService usara HttpClient.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const alertService = inject(AlertService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 && error.status !== 403) {
        let errorMessage = 'Ha ocurrido un error inesperado.';
        let errorTitle = 'Error';

        if (error.status === 0) {
          errorMessage =
            'No se ha podido conectar con el servidor. Por favor, revisa tu conexión a internet.';
          errorTitle = 'Error de Conexión';
        } else if (error.error && typeof error.error.detail === 'string') {
          errorMessage = error.error.detail;
        }

        alertService.error(errorTitle, errorMessage, 5000);
      }

      return throwError(() => error);
    })
  );
};
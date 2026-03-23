import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AlertService } from '@shared/components/alert/alert.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  private alertService = inject(AlertService);

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Ignorar 401 y 403, pues de esos se encarga AuthInterceptor (ej. token expirado / sin permisos)
        if (error.status !== 401 && error.status !== 403) {
          let errorMessage = 'Ha ocurrido un error inesperado.';
          let errorTitle = 'Error';

          // Manejo de errores de red o CORS
          if (error.status === 0) {
            errorMessage = 'No se ha podido conectar con el servidor. Por favor, revisa tu conexión a internet.';
            errorTitle = 'Error de Conexión';
          } 
          // Manejo de respuestas HTTP del Backend (estructuradas con detail)
          else if (error.error && typeof error.error.detail === 'string') {
            errorMessage = error.error.detail;
          }

          // Despachar alerta de error a la UI.
          this.alertService.error(errorTitle, errorMessage, 5000);
        }

        return throwError(() => error);
      })
    );
  }
}

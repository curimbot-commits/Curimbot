import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ActivityLog, ChartDataPoint, DashboardStats, StorageStats, UserSummary } from '../../domain/models/document.model';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly API_URL = environment.apiUrl;
  private readonly DOCUMENTS_URL = `${this.API_URL}/documents`;

  private http = inject(HttpClient);

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorKey = 'login.errors.unexpectedErrorTitle';
    if (error.error instanceof ErrorEvent) {
      return throwError(() => new Error(error.error.message));
    }
    switch (error.status) {
      case 0: errorKey = 'login.errors.connectionErrorTitle'; break;
      case 401: errorKey = 'login.errors.invalidCredentialsTitle'; break;
      case 403: errorKey = 'login.errors.forbiddenAccessTitle'; break;
      case 404: errorKey = 'login.errors.resourceNotFoundTitle'; break;
      case 500: case 502: case 503: case 504: errorKey = 'login.errors.serverErrorTitle'; break;
    }
    const customError: any = new Error(errorKey);
    customError.status = error.status;
    customError.originalError = error;
    return throwError(() => customError);
  }

  getDashboardStats(includeAllUsers = false): Observable<DashboardStats> {
    const params = new HttpParams().set('include_all_users', includeAllUsers.toString());
    return this.http.get<DashboardStats>(`${this.DOCUMENTS_URL}/stats/dashboard`, {
      params
    }).pipe(catchError((err) => this.handleError(err)));
  }

  getChartData(period: 'week' | 'month' | 'year' = 'month', includeAllUsers = false): Observable<ChartDataPoint[]> {
    const params = new HttpParams().set('period', period).set('include_all_users', includeAllUsers.toString());
    return this.http.get<ChartDataPoint[]>(`${this.DOCUMENTS_URL}/stats/charts`, {
      params
    }).pipe(catchError((err) => this.handleError(err)));
  }

  getRecentActivities(limit = 20, includeAllUsers = false): Observable<ActivityLog[]> {
    const params = new HttpParams().set('limit', limit.toString()).set('include_all_users', includeAllUsers.toString());
    return this.http.get<ActivityLog[]>(`${this.DOCUMENTS_URL}/activities/recent`, {
      params
    }).pipe(catchError((err) => this.handleError(err)));
  }

  getUserStorageStats(targetUserId?: number): Observable<StorageStats> {
    let params = new HttpParams();
    if (targetUserId !== undefined) {
      params = params.set('target_user_id', targetUserId.toString());
    }
    return this.http.get<StorageStats>(`${this.DOCUMENTS_URL}/stats/storage`, {
      params
    }).pipe(catchError((err) => this.handleError(err)));
  }

  getUserSummary(): Observable<UserSummary> {
    return this.http.get<UserSummary>(`${this.DOCUMENTS_URL}/stats/summary`).pipe(catchError((err) => this.handleError(err)));
  }
}

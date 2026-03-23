import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { DocumentUploadResponse, DocumentWithMetadata, PaginatedDocumentsResponse, DocumentType } from '../../domain/models/document.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
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

  uploadDocuments(files: File[]): Observable<DocumentUploadResponse> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file, file.name));
    return this.http.post<DocumentUploadResponse>(`${this.DOCUMENTS_URL}/upload`, formData)
      .pipe(catchError((err) => this.handleError(err)));
  }

  downloadDocument(docId: number): Observable<Blob> {
    return this.http.get(`${this.DOCUMENTS_URL}/download/${docId}`, {
      responseType: 'blob'
    }).pipe(catchError((err) => this.handleError(err)));
  }

  getDocumentMetadata(docId: number): Observable<Document> {
    return this.http.get<Document>(`${this.DOCUMENTS_URL}/${docId}/metadata`).pipe(catchError((err) => this.handleError(err)));
  }

  getAllDocumentsMetadata(includeAllUsers = true): Observable<DocumentWithMetadata[]> {
    const params = new HttpParams().set('include_all_users', includeAllUsers.toString());
    return this.http.get<any[]>(`${this.DOCUMENTS_URL}/metadata/all`, {
      params
    }).pipe(
      catchError((err) => this.handleError(err)),
      map((documents) => documents.map(doc => ({ ...doc, filename: doc.filename ?? doc.name })))
    );
  }

  searchDocuments(text?: string, fileType?: DocumentType, skip = 0, limit = 20, dateFrom?: string, dateTo?: string): Observable<PaginatedDocumentsResponse> {
    let params = new HttpParams().set('skip', skip.toString()).set('limit', limit.toString());
    if (text && text.trim().length >= 2) params = params.set('text', text.trim());
    if (fileType) params = params.set('file_type', fileType.toString());
    if (dateFrom) params = params.set('date_from', dateFrom);
    if (dateTo) params = params.set('date_to', dateTo);

    return this.http.get<PaginatedDocumentsResponse>(`${this.DOCUMENTS_URL}/search`, {
      params
    }).pipe(catchError((err) => this.handleError(err)));
  }

  deleteDocument(docId: number): Observable<void> {
    return this.http.delete<void>(`${this.DOCUMENTS_URL}/${docId}`).pipe(catchError((err) => this.handleError(err)));
  }

  getDocuments(skip = 0, limit = 20, fileType?: DocumentType): Observable<PaginatedDocumentsResponse> {
    let params = new HttpParams().set('skip', skip.toString()).set('limit', limit.toString());
    if (fileType) params = params.set('file_type', fileType.toString());
    return this.http.get<PaginatedDocumentsResponse>(`${this.DOCUMENTS_URL}/`, {
      params
    }).pipe(catchError((err) => this.handleError(err)));
  }

  listDocuments(options?: { skip?: number; limit?: number; fileType?: string; text?: string }): Observable<PaginatedDocumentsResponse> {
    let params = new HttpParams().set('skip', (options?.skip ?? 0).toString()).set('limit', (options?.limit ?? 20).toString());
    if (options?.fileType) params = params.set('file_type', options.fileType);
    if (options?.text) params = params.set('text', options.text);
    return this.http.get<PaginatedDocumentsResponse>(`${this.DOCUMENTS_URL}/`, { 
      params 
    }).pipe(catchError((err) => this.handleError(err)));
  }

  getDocumentsMetadataById(docId: number): Observable<DocumentWithMetadata[]> {
    return this.http.get<DocumentWithMetadata[]>(`${this.DOCUMENTS_URL}/${docId}/metadata`).pipe(catchError((err) => this.handleError(err)));
  }
}

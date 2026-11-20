/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/services/athenia/athenia.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

/**
 * Solicitud para consultar a ATHENIA.
 */
export interface AtheniaQueryRequest {
  question: string;
  document_ids?: number[];
  use_cache?: boolean;
  /** Conversación a continuar (undefined = nueva) */
  conversation_id?: number;
}

/**
 * Información detallada de fuente.
 */
export interface AtheniaSourceInfo {
  document_id: number;
  filename: string;
  snippet?: string;
  relevance_score?: number;
}

/**
 * Respuesta de ATHENIA.
 */
export interface AtheniaResponse {
  answer: string;
  confidence: number;
  sources: number[];
  sources_info?: AtheniaSourceInfo[];
  from_cache: boolean;
  processing_time_ms: number;
  conversation_id: number;
}

/**
 * Estado del sistema ATHENIA.
 */
export interface AtheniaStatus {
  is_ready: boolean;
  documents_indexed: number;
  cache_size: number;
  semantic_cache_size?: number;
  cache_hit_rate?: number;
  last_sync: string | null;
  vector_db_size_mb: number;
}

/**
 * Mensaje en una conversación con ATHENIA.
 */
export interface ConversationMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: number[];
  sources_info?: AtheniaSourceInfo[];
  confidence?: number;
  from_cache?: boolean;
}

/**
 * Servicio para interactuar con ATHENIA (asistente IA).
 * Soporta consultas, historial, caché y sincronización.
 */
@Injectable({
  providedIn: 'root',
})
export class AtheniaService {
  // ==================================================================
  // CONFIGURACIÓN
  // ==================================================================

  private readonly API_URL = environment.apiUrl;
  private readonly BASE_URL = `${this.API_URL}/assistant`;

  // ==================================================================
  // SERVICIOS
  // ==================================================================

  private http = inject(HttpClient);

  // ==================================================================
  // MÉTODOS PRIVADOS
  // ==================================================================



  /** Maneja errores HTTP */
  private handleError(error: any): Observable<never> {
    return throwError(() => error);
  }

  // ==================================================================
  // CONSULTAS
  // ==================================================================

  askQuestion(request: AtheniaQueryRequest): Observable<AtheniaResponse> {
    return this.http
      .post<AtheniaResponse>(`${this.BASE_URL}/query`, request)
      .pipe(catchError(this.handleError));
  }

  // ==================================================================
  // ESTADO DEL SISTEMA
  // ==================================================================

  /**
   * Obtiene el estado actual de ATHENIA.
   * @returns Estado del sistema
   */
  getStatus(): Observable<AtheniaStatus> {
    return this.http
      .get<AtheniaStatus>(`${this.BASE_URL}/status`)
      .pipe(catchError(this.handleError));
  }
}

import { UserInfoResponse } from "./user.model";

/** -----------------------------------------------------
 * Tipos compartidos y enums
 * ----------------------------------------------------- */
export type DocumentType = "pdf" | "docx" | "txt" | "all";
export type TimeRange = "year" | "week" | "month";

/** Canal por el que el usuario interactuó con la IA */
export enum AIChannel {
  TEXT = "text",
  VOICE = "voice",
}

/** Estado de la respuesta de la IA */
export enum AIInteractionStatus {
  SUCCESS = "success",
  ERROR = "error",
  NO_CONTEXT = "no_context",
}

/** -----------------------------------------------------
 * Documentos
 * ----------------------------------------------------- */

interface BaseDocument {
  filename: string;
  mimetype: string;
  size: number;
  file_type: DocumentType;
  text: string;
  blob_enc: string;
}

export interface Document extends BaseDocument {
  id: number;
  created_at: string;
}

export interface DocumentWithMetadata {
  id: number;
  filename: string;
  file_type: DocumentType;
  size: number;
  created_at: string;
  last_accessed?: string;
  user_id: number;
  user_name: string;
  download_count: number;
  view_count: number;
  tags?: string[];
  matchScore?: number;
  upload_date: string;
  uploaded_by_name: string;
}

export interface PaginatedResponse<T> {
  total_count: number;
  items: T[];
  total: number;
  skip: number;
  limit: number;
  has_next: boolean;
  has_prev: boolean;
  search_params?: Record<string, unknown>;
}

export type PaginatedDocumentsResponse =
  PaginatedResponse<DocumentWithMetadata>;

export interface UserExtended extends UserInfoResponse {
  documentsCount: number;
  lastActivity: string;
  documents: DocumentWithMetadata[];
  status?: "active" | "inactive";
  profile_photo_url?: string | null;
}

/** -----------------------------------------------------
 * Dashboard y estadísticas
 * ----------------------------------------------------- */

export interface DashboardStats {
  totalDocuments: number;
  totalSize: number;
  documentsToday: number;
  documentsThisWeek: number;
  documentsThisMonth: number;
  averagePerDay: number;
  mostActiveUser?: string | null;
  peakUploadTime?: string | null;
  typeBreakdown: TypeBreakdown[];
}

export interface TypeBreakdown {
  file_type: DocumentType;
  count: number;
  size: number;
}

export interface ChartDataPoint {
  value: number;
  label: string;
  date: string;
  pdf: number;
  docx: number;
  txt: number;
  total: number;
}

/** -----------------------------------------------------
 * Usuarios
 * ----------------------------------------------------- */

export interface StorageStats {
  user_id: number;
  total_documents: number;
  total_size: number;
  type_breakdown: TypeBreakdown[];
}

export interface UserSummary {
  user_id: number;
  user_name: string;
  user_email: string;
  storage: StorageStats;
  dashboard: DashboardStats;
  recent_interactions_count: number;
  last_interaction: string | null;
  generated_at: string;
}

/** -----------------------------------------------------
 * Interacciones con la IA (Curim)
 * ----------------------------------------------------- */

/**
 * Información detallada de una fuente usada por la IA.
 * `sources_info` es un array de estos objetos.
 */
export interface AISourceInfo {
  document_id?: number;
  filename?: string;
  snippet?: string;
  relevance_score?: number;
  [key: string]: unknown;
}

/**
 * Registro de una interacción del usuario con la IA.
 * Reemplaza al antiguo `ActivityLog`.
 */
export interface AIInteractionLog {
  id: number;
  user_id: number | null;
  user_name: string;
  question: string;
  answer: string | null;
  channel: AIChannel;
  confidence: number | null;
  status: AIInteractionStatus;
  error_message: string | null;
  sources: number[] | null;
  sources_info: AISourceInfo[] | null;
  processing_time_ms: number | null;
  from_cache: boolean;
  conversation_id: number | null;
  timestamp: string;
}

/**
 * Devuelve un ícono Lucide según el canal.
 */
export function getChannelIcon(channel: string): string {
  return channel === AIChannel.VOICE ? "mic" : "message-square";
}

/**
 * Devuelve la clase CSS de badge según el estado.
 */
export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case AIInteractionStatus.SUCCESS:
      return "text-green-700 bg-green-50 border border-green-200";

    case AIInteractionStatus.ERROR:
      return "text-red-700 bg-red-50 border border-red-200";

    case AIInteractionStatus.NO_CONTEXT:
      return "text-yellow-700 bg-yellow-50 border border-yellow-200";

    default:
      return "text-gray-700 bg-gray-50 border border-gray-200";
  }
}

/**
 * Devuelve la etiqueta legible del canal.
 */
export function getChannelLabel(channel: string): string {
  return channel === AIChannel.VOICE ? "Voz" : "Texto";
}

/**
 * Devuelve la etiqueta legible del estado.
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case AIInteractionStatus.SUCCESS:
      return "Exitosa";

    case AIInteractionStatus.ERROR:
      return "Error";

    case AIInteractionStatus.NO_CONTEXT:
      return "Sin contexto";

    default:
      return "Desconocido";
  }
}

/** -----------------------------------------------------
 * Upload response
 * ----------------------------------------------------- */

export interface DocumentUploadResponse {
  successful_uploads: Document[];
  failed_uploads: Record<string, string>[];
  total_processed: number;
  success_count: number;
  failure_count: number;
}

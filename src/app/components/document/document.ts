import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Auth as AuthService } from '../authentication/auth/auth';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { CommonModule, DecimalPipe } from '@angular/common';
import { DocumentService } from '../../services/api/document.service';
import { DocumentWithMetadata, Document } from '../../domain/models/document.model';
import { Subject } from 'rxjs';
import { takeUntil, switchMap, finalize } from 'rxjs/operators';
import { LucideAngularModule } from 'lucide-angular';
import { AlertService } from '@shared/components/alert/alert.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AtheniaChat } from '../athenia-chat/athenia-chat';
import {  AtheniaVoice } from '../athenia-voice/athenia-voice';



/**
 * Componente principal para gestión de documentos.
 * Soporta: carga, subida (drag & drop), descarga, eliminación, filtrado, paginación y visualización.
 * Integra Athenia (chat y voz) para asistencia IA.
 */
@Component({
  selector: 'app-document',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    DecimalPipe,
    LucideAngularModule,
    TranslateModule,
  ],
  templateUrl: './document.html',
  styleUrl: './document.css',
})
export class DocumentComponent implements OnInit, OnDestroy {
  @ViewChild(AtheniaVoice) atheniaVoice!: AtheniaVoice;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild(AtheniaChat) atheniaChat!: AtheniaChat;

  private destroy$ = new Subject<void>();

  viewedDocuments = new Set<number>();
  activeFilter: 'all' | 'pdf' | 'docx' | 'txt' = 'all';
  documents: DocumentWithMetadata[] = [];
  loading = false;

  // Upload state
  isUploading = false;
  uploadQueue: { name: string; status: 'uploading' | 'done' | 'error'; progress: number }[] = [];

  currentPage = 0;
  itemsPerPage = 5;

  private documentService = inject(DocumentService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private translate = inject(TranslateService);

  // ==================== CICLO DE VIDA ====================

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.loadDocuments();
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== INTERACCIÓN CON ATHENIA ====================

  /** Abre el chat de Athenia */
  openAtheniaText(): void {
    this.atheniaChat?.toggle();
  }

  

  // ==================== SUBIDA DE ARCHIVOS ====================

  /** Abre el selector de archivos nativo */
  openFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  /**
   * Procesa archivos seleccionados desde input file.
   * Sube al backend y recarga la lista.
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.startUpload(Array.from(input.files));
    input.value = ''; // reset so same file can be re-selected
  }

  private startUpload(files: File[]): void {
    this.isUploading = true;
    this.uploadQueue = files.map(f => ({ name: f.name, status: 'uploading', progress: 0 }));

    // Simulate per-file progress animation
    this.uploadQueue.forEach((item, idx) => {
      const interval = setInterval(() => {
        item.progress = Math.min(item.progress + Math.random() * 18 + 5, 90);
      }, 200 + idx * 80);

      setTimeout(() => clearInterval(interval), 2000 + idx * 300);
    });

    this.loading = true;
    this.documentService
      .uploadDocuments(files)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => new Promise(resolve => setTimeout(resolve, 800))),
        switchMap(() => this.documentService.listDocuments()),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (response) => {
          this.documents = response.items;
          this.uploadQueue.forEach(q => { q.progress = 100; q.status = 'done'; });
          this.alertService.success(this.translate.instant('document.alerts.uploadSuccess'), '');
          setTimeout(() => { this.isUploading = false; this.uploadQueue = []; }, 2000);
        },
        error: () => {
          this.uploadQueue.forEach(q => { q.status = 'error'; });
          this.alertService.error(this.translate.instant('document.alerts.uploadError'), '');
          setTimeout(() => { this.isUploading = false; this.uploadQueue = []; }, 3000);
        },
      });
  }


  // ==================== DRAG & DROP ====================

  isDragOver = false;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  /**
   * Procesa archivos soltados en el área de drag & drop.
   * Usa misma lógica que `onFileSelected`.
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    if (!event.dataTransfer?.files.length) return;
    this.startUpload(Array.from(event.dataTransfer.files));
  }

  // ==================== CARGA Y FILTRO ====================

  /** Carga todos los documentos del usuario autenticado */
  loadDocuments(): void {
  this.loading = true; // Activar loading
  
  // Verificar autenticación antes de cargar
  if (!this.authService.isAuthenticated()) {
    this.router.navigate(['/login']);
    return;
  }
  
  this.documentService.listDocuments()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        this.documents = response.items || [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando documentos:', error);
        this.documents = [];
        this.loading = false;
        
        if (error.message.includes('401') || error.message.includes('autenticación')) {
          this.alertService.error(this.translate.instant('document.alerts.sessionExpired'), '');
          setTimeout(() => this.authService.logout(), 2000);
        } else {
          this.alertService.error(this.translate.instant('document.alerts.loadError'), '');
        }
      }
    });
}

  /**
   * Filtra documentos por tipo de archivo.
   */
  filterDocuments(type: 'all' | 'pdf' | 'docx' | 'txt'): void {
    this.activeFilter = type;
    const options = type === 'all' ? {} : { fileType: type };

    this.documentService
      .listDocuments(options)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.documents = response.items;
          this.currentPage = 0;
          this.loading = false;
        },
        error: () => {
          this.alertService.error(this.translate.instant('document.alerts.filterError'), '');
        },
      });
  }

  // ==================== ACCIONES SOBRE DOCUMENTOS ====================

  /**
   * Descarga un documento como archivo.
   */
  downloadDocument(doc: DocumentWithMetadata): void {
    this.documentService
      .downloadDocument(+doc.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = doc.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          this.alertService.success(this.translate.instant('document.alerts.downloadComplete', { name: doc.filename }), '');
        },
        error: () => {
          this.alertService.error(this.translate.instant('document.alerts.downloadError'), '');
        },
      });
  }

  /**
   * Elimina un documento tras confirmación.
   */
  deleteDocument(document: DocumentWithMetadata): void {
    this.alertService.confirm(this.translate.instant('document.alerts.deleteConfirm', { name: document.filename }), '').then((confirmed) => {
      if (!confirmed) return;

      this.documentService
        .deleteDocument(+document.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.documents = this.documents.filter((doc) => +doc.id !== +document.id);
            this.alertService.success(this.translate.instant('document.alerts.deleteSuccess', { name: document.filename }), '');
          },
          error: () => {
            this.alertService.error(this.translate.instant('document.alerts.deleteError'), '');
          },
        });
    });
  }

  /**
   * Visualiza un documento en nueva pestaña.
   */
  viewDocument(doc: DocumentWithMetadata): void {
    this.documentService
      .downloadDocument(+doc.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          // Asegurar que el Blob tenga el MIME type correcto para que el navegador lo abra en el visor
          const mimeType = this.getMimeTypeFromFileType(doc.file_type);
          const typedBlob = new Blob([blob], { type: mimeType });
          const url = window.URL.createObjectURL(typedBlob);
          window.open(url, '_blank');
          this.viewedDocuments.add(+doc.id);
        },
        error: () => {
          this.alertService.error(this.translate.instant('document.alerts.viewError', { name: doc.filename }), '');
        },
      });
  }

  // ==================== ESTILOS Y FORMATOS ====================

  /** Color de fondo según tipo de archivo */
  getDocumentColor(fileType: string): string {
    switch (fileType) {
      case 'pdf':
        return 'bg-danger';
      case 'docx':
        return 'bg-info';
      case 'txt':
        return 'bg-success';
      default:
        return 'bg-secondary';
    }
  }

  /** Clase de ícono según tipo de archivo */
  getDocumentIconClass(document: DocumentWithMetadata): string {
    switch (document.file_type) {
      case 'pdf':
        return 'fas fa-file-pdf text-red-500';
      case 'docx':
        return 'fas fa-file-word text-blue-500';
      case 'txt':
        return 'fas fa-file-alt text-gray-500';
      default:
        return 'fas fa-file text-gray-500';
    }
  }

  getDocumentIconClassFromFileType(fileType: string): string {
    switch (fileType) {
      case 'pdf':
        return 'fas fa-file-pdf';
      case 'docx':
        return 'fas fa-file-word';
      case 'txt':
        return 'fas fa-file-alt';
      default:
        return 'fas fa-file';
    }
  }

  /** Convierte a modelo `Document` interno */
  mapToDocument(doc: DocumentWithMetadata): Document {
    return {
      id: Number(doc.id),
      filename: doc.filename,
      mimetype: this.getMimeTypeFromFileType(doc.file_type),
      size: doc.size,
      file_type: doc.file_type,
      text: '',
      blob_enc: '',
      created_at: new Date(doc.created_at).toISOString(),
    };
  }

  private getMimeTypeFromFileType(fileType: string): string {
    switch (fileType) {
      case 'pdf':
        return 'application/pdf';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }

  // ==================== PAGINACIÓN ====================

  get totalPages(): number {
    return Math.ceil(this.documents.length / this.itemsPerPage);
  }

  getPages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get paginatedDocuments(): DocumentWithMetadata[] {
  if (!this.documents || !Array.isArray(this.documents) || this.documents.length === 0) {
    return [];
  }
  const start = this.currentPage * this.itemsPerPage;
  const end = start + this.itemsPerPage;
  return this.documents.slice(start, end);
}

  onPageChange(page: number): void {
    if (page > 0 && page <= this.totalPages) {
      this.currentPage = page - 1;
    }
  }

  // ==================== FORMATOS ADICIONALES ====================


  /** Convierte bytes a MB con 2 decimales */
  formatBytesToMB(bytes: any): string {
    const numBytes = Number(bytes);
    if (!numBytes) return '0 MB';
    const mb = numBytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }
}

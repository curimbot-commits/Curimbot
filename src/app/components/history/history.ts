/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/features/history/components/history.component.ts

import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Api } from '../../services/api/api';
import { AlertService } from '@shared/components/alert/alert.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ActivityLog } from 'src/app/domain/models/document.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';


/**
 * Estadística mostrada en tarjetas.
 */
interface Stat {
  label: string;
  value: string;
  icon: string;
  color: string;
}

/**
 * Componente para visualizar el historial de actividades del sistema.
 * Incluye filtrado, paginación, estadísticas y exportación.
 */
@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    FormsModule,
    LucideAngularModule,
    TranslateModule
  ],
  templateUrl: './history.html',
  styleUrl: './history.css'
})
export class History implements OnInit {
  // ==================================================================
  // ESTADO REACTIVO
  // ==================================================================

  activities: ActivityLog[] = [];
  filteredActivities: ActivityLog[] = [];
  paginatedActivities: ActivityLog[] = [];

  // Paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  loading = false;
  loadingMore = false;
  errorMessage: string | null = null;
  limit = 100;
  includeAllUsers = false;
  searchQuery = '';
  filterType: 'all' | 'upload' | 'download' | 'process' | 'edit' | 'delete' | 'error' = 'all';

  // ==================================================================
  // ESTADÍSTICAS
  // ==================================================================

  stats: Stat[] = [
    {
      label: 'Total Acciones',
      value: '0',
      icon: 'history',
      color: 'bg-blue-500'
    },
    {
      label: 'Subidos Este Mes',
      value: '0',
      icon: 'upload',
      color: 'bg-purple-500'
    },
    {
      label: 'Errores',
      value: '0',
      icon: 'x-circle',
      color: 'bg-red-500'
    }
  ];

  // ==================================================================
  // SERVICIOS
  // ==================================================================

  private apiService = inject(Api);
  private alertService = inject(AlertService);
  private translate = inject(TranslateService);

  // ==================================================================
  // CONSTANTES VISUALES
  // ==================================================================

  private readonly ACTIVITY_TYPES = {
    upload: ['upload', 'subido', 'document_uploaded'],
    download: ['download', 'descarga'],
    process: ['process', 'procesado'],
    edit: ['edit', 'editado', 'update'],
    delete: ['delete', 'eliminado', 'removed'],
    error: ['error', 'failed']
  } as const;

  private readonly ICON_MAP: Record<keyof typeof this.ACTIVITY_TYPES | 'default', string> = {
    upload: 'upload',
    download: 'download',
    process: 'check-circle',
    edit: 'edit',
    delete: 'trash-2',
    error: 'x-circle',
    default: 'file-text'
  };

  private readonly COLOR_MAP: Record<keyof typeof this.ACTIVITY_TYPES | 'default', string> = {
    upload: 'bg-blue-500',
    download: 'bg-purple-500',
    process: 'bg-[#02ab74]',
    edit: 'bg-orange-500',
    delete: 'bg-gray-500',
    error: 'bg-red-500',
    default: 'bg-gray-500'
  };

  get LABEL_MAP(): Record<keyof typeof this.ACTIVITY_TYPES | 'default', string> {
    return {
      upload: this.translate.instant('history.labels.upload'),
      download: this.translate.instant('history.labels.download'),
      process: this.translate.instant('history.labels.process'),
      edit: this.translate.instant('history.labels.edit'),
      delete: this.translate.instant('history.labels.delete'),
      error: this.translate.instant('history.labels.error'),
      default: this.translate.instant('history.labels.default')
    };
  }

  // ==================================================================
  // CICLO DE VIDA
  // ==================================================================

  ngOnInit(): void {
    this.updateStats(); // Initial stats text mapping
    this.getRecentActivities();
  }

  // ==================================================================
  // CARGA DE DATOS
  // ==================================================================

  /** Carga actividades recientes */
  private getRecentActivities(): void {
    this.loading = true;
    this.errorMessage = null;

    this.apiService.getRecentActivities(this.limit, this.includeAllUsers).subscribe({
      next: data => {
        this.activities = data.map(a => ({
          ...a,
          timestamp: this.convertToUTCMinus5(a.timestamp)
        }));
        this.filterActivities();
        this.updateStats();
        this.loading = false;
      },
      error: () => {
        this.errorMessage = this.translate.instant('history.alerts.loadErrorTitle');
        this.loading = false;
        this.alertService.error(this.translate.instant('history.alerts.loadErrorTitle'), this.translate.instant('history.alerts.loadErrorDesc'));
      }
    });
  }

  // ==================================================================
  // FILTRADO Y PAGINACIÓN
  // ==================================================================

  /** Aplica filtros de búsqueda y tipo */
  filterActivities(): void {
    this.filteredActivities = this.activities.filter(activity => {
      const matchesSearch = !this.searchQuery ||
        activity.document_name?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        this.getActionLabel(activity.action).toLowerCase().includes(this.searchQuery.toLowerCase());

      const matchesFilter = this.filterType === 'all' ||
        this.getActivityType(activity.action) === this.filterType;

      return matchesSearch && matchesFilter;
    });

    this.currentPage = 1;
    this.updatePaginatedActivities();
  }

  updatePaginatedActivities(): void {
    this.totalPages = Math.ceil(this.filteredActivities.length / this.itemsPerPage);
    if (this.totalPages === 0) {
      this.totalPages = 1;
    }
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedActivities = this.filteredActivities.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedActivities();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  // ==================================================================
  // ESTADÍSTICAS
  // ==================================================================

  /** Actualiza tarjetas de estadísticas */
  private updateStats(): void {
    const totalActions = this.activities.length;

    const now = new Date();
    const thisMonthUploads = this.activities.filter(a => {
      const date = new Date(a.timestamp);
      return this.isUploadAction(a.action) &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
    }).length;

    const errors = this.activities.filter(a => this.isErrorAction(a.action)).length;

    this.stats = [
      {
        label: this.translate.instant('history.stats.total'),
        value: totalActions.toLocaleString(),
        icon: 'history',
        color: 'bg-blue-500'
      },
      {
        label: this.translate.instant('history.stats.uploadsThisMonth'),
        value: thisMonthUploads.toLocaleString(),
        icon: 'upload',
        color: 'bg-purple-500'
      },
      {
        label: this.translate.instant('history.stats.errors'),
        value: errors.toLocaleString(),
        icon: 'x-circle',
        color: 'bg-red-500'
      }
    ];
  }

  // ==================================================================
  // UTILIDADES DE ACCIONES
  // ==================================================================

  /** Determina el tipo de actividad */
  private getActivityType(action: string): keyof typeof this.ACTIVITY_TYPES | 'default' {
    const lower = action.toLowerCase();
    for (const [type, keywords] of Object.entries(this.ACTIVITY_TYPES)) {
      if (keywords.some(k => lower.includes(k))) {
        return type as keyof typeof this.ACTIVITY_TYPES;
      }
    }
    return 'default';
  }

  /** Obtiene etiqueta legible */
  getActionLabel(action: string): string {
    const type = this.getActivityType(action);
    return this.LABEL_MAP[type];
  }

  /** Obtiene ícono Lucide */
  getActivityIcon(action: string): string {
    const type = this.getActivityType(action);
    return this.ICON_MAP[type];
  }

  /** Obtiene color de fondo */
  getActivityColor(action: string): string {
    const type = this.getActivityType(action);
    return this.COLOR_MAP[type];
  }

  /** Ícono de estado (éxito/error) */
  getStatusIcon(action: string): string {
    return this.isErrorAction(action) ? 'x-circle' : 'check-circle';
  }

  /** Color de estado */
  getStatusColor(action: string): string {
    return this.isErrorAction(action) ? 'text-red-500' : 'text-green-500';
  }

  /** Verifica si es acción de subida */
  private isUploadAction(action: string): boolean {
    return this.ACTIVITY_TYPES.upload.some(k => action.toLowerCase().includes(k));
  }

  /** Verifica si es acción de error */
  private isErrorAction(action: string): boolean {
    return this.ACTIVITY_TYPES.error.some(k => action.toLowerCase().includes(k));
  }

  // ==================================================================
  // EXPORTACIÓN
  // ==================================================================

  exportPDF(): void {
    if (!this.filteredActivities.length) {
      this.alertService.info(this.translate.instant('history.alerts.noActivities'), '');
      return;
    }

    try {
      const doc = new jsPDF();
      
      doc.setFontSize(16);
      doc.text(this.translate.instant('history.export.title'), 14, 20);
      doc.setFontSize(10);
      doc.text(`${this.translate.instant('history.export.generatedOn')}: ${new Date().toLocaleString()}`, 14, 28);

      const tableData = this.filteredActivities.map(a => [
        a.timestamp || '',
        this.getActionLabel(a.action),
        a.document_name || this.translate.instant('history.unnamedDoc')
      ]);

      autoTable(doc, {
        startY: 35,
        head: [[
          this.translate.instant('history.export.columns.datetime'),
          this.translate.instant('history.export.columns.action'),
          this.translate.instant('history.export.columns.document')
        ]],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [2, 171, 116] } 
      });

      const filename = `historial_actividad_${this.getCurrentTimestampForFilename()}.pdf`;
      doc.save(filename);
      this.alertService.success(this.translate.instant('history.alerts.pdfSuccess'), '');
    } catch (error) {
      console.error('Error exportando PDF:', error);
      this.alertService.error(this.translate.instant('history.alerts.pdfError'), '');
    }
  }

  exportExcel(): void {
    if (!this.filteredActivities.length) {
      this.alertService.info(this.translate.instant('history.alerts.noActivities'), '');
      return;
    }

    try {
      const BOM = '\uFEFF';
      const headers = [
        this.translate.instant('history.export.columns.datetime'),
        this.translate.instant('history.export.columns.action'),
        this.translate.instant('history.export.columns.document')
      ];
      
      const rows = this.filteredActivities.map(a => {
        const date = a.timestamp || '';
        const action = this.getActionLabel(a.action);
        const docName = (a.document_name || this.translate.instant('history.unnamedDoc')).replace(/"/g, '""'); 

        return `"${date}";"${action}";"${docName}"`;
      });

      const csvContent = BOM + headers.join(';') + '\n' + rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `historial_actividad_${this.getCurrentTimestampForFilename()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.alertService.success(this.translate.instant('history.alerts.excelSuccess'), '');
    } catch (error) {
      console.error('Error exportando CSV:', error);
      this.alertService.error(this.translate.instant('history.alerts.excelError'), '');
    }
  }

  // ==================================================================
  // FORMATO DE FECHA
  // ==================================================================

  /**
   * Convierte fecha UTC a UTC-5 (Colombia) con formato legible.
   * @param dateString Fecha en formato ISO
   */
  convertToUTCMinus5(dateString: string): string {
    const date = new Date(dateString);
    const utcMinus5 = new Date(date.getTime() - 5 * 60 * 60 * 1000);

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${utcMinus5.getFullYear()}-${pad(utcMinus5.getMonth() + 1)}-${pad(utcMinus5.getDate())} ` +
           `${pad(utcMinus5.getHours())}:${pad(utcMinus5.getMinutes())}:${pad(utcMinus5.getSeconds())}`;
  }

  /**
   * Obtiene timestamp compacto para nombres de archivo
   */
  private getCurrentTimestampForFilename(): string {
    const now = new Date();
    const utcMinus5 = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    
    return `${utcMinus5.getFullYear()}${pad(utcMinus5.getMonth() + 1)}${pad(utcMinus5.getDate())}_` +
           `${pad(utcMinus5.getHours())}${pad(utcMinus5.getMinutes())}${pad(utcMinus5.getSeconds())}`;
  }
}
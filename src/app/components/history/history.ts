/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/features/history/components/history.component.ts

import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AnalyticsService } from '../../services/api/analytics.service';
import { AlertService } from '@shared/components/alert/alert.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AIInteractionLog,
  AIChannel,
  AIInteractionStatus,
  getChannelIcon,
  getChannelLabel,
  getStatusBadgeClass,
  getStatusLabel,
} from 'src/app/domain/models/document.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface Stat {
  label: string;
  value: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    FormsModule,
    LucideAngularModule,
    TranslateModule,
  ],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class History implements OnInit {
  // ==================================================================
  // ESTADO REACTIVO
  // ==================================================================

  interactions: AIInteractionLog[] = [];
  filteredInteractions: AIInteractionLog[] = [];
  paginatedInteractions: AIInteractionLog[] = [];

  /** IDs de las tarjetas expandidas */
  expandedIds = new Set<number>();

  // Paginación
  currentPage = 1;
  itemsPerPage = 5;
  totalPages = 1;

  loading = false;
  errorMessage: string | null = null;
  limit = 100;
  includeAllUsers = false;
  searchQuery = '';

  // Filtros
  filterChannel: 'all' | AIChannel = 'all';
  filterStatus: 'all' | AIInteractionStatus = 'all';

  // ==================================================================
  // ESTADÍSTICAS
  // ==================================================================

  stats: Stat[] = [
    {
      label: 'Total Consultas',
      value: '0',
      icon: 'message-circle',
      color: 'bg-blue-500',
    },
    {
      label: 'Exitosas',
      value: '0',
      icon: 'check-circle',
      color: 'bg-green-500',
    },
    {
      label: 'Errores',
      value: '0',
      icon: 'x-circle',
      color: 'bg-red-500',
    },
  ];

  // ==================================================================
  // SERVICIOS
  // ==================================================================

  private analyticsService = inject(AnalyticsService);
  private alertService = inject(AlertService);
  private translate = inject(TranslateService);

  // ==================================================================
  // CICLO DE VIDA
  // ==================================================================

  ngOnInit(): void {
    this.loadInteractions();
  }

  // ==================================================================
  // CARGA DE DATOS
  // ==================================================================

  private loadInteractions(): void {
    this.loading = true;
    this.errorMessage = null;

    this.analyticsService
      .getRecentAIInteractions(this.limit, this.includeAllUsers)
      .subscribe({
        next: (data) => {
          this.interactions = data.map((i) => ({
            ...i,
            timestamp: this.convertToUTCMinus5(i.timestamp),
          }));
          this.filterInteractions();
          this.updateStats();
          this.loading = false;
        },
        error: () => {
          this.errorMessage = this.translate.instant(
            'history.alerts.loadErrorTitle'
          );
          this.loading = false;
          this.alertService.error(
            this.translate.instant('history.alerts.loadErrorTitle'),
            this.translate.instant('history.alerts.loadErrorDesc')
          );
        },
      });
  }

  // ==================================================================
  // EXPANDIR / COLAPSAR
  // ==================================================================

  toggleExpand(id: number): void {
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
  }

  isExpanded(id: number): boolean {
    return this.expandedIds.has(id);
  }

  // ==================================================================
  // FILTRADO Y PAGINACIÓN
  // ==================================================================

  filterInteractions(): void {
    this.filteredInteractions = this.interactions.filter((interaction) => {
      const query = this.searchQuery.toLowerCase().trim();

      const matchesSearch =
        !query ||
        interaction.question?.toLowerCase().includes(query) ||
        interaction.answer?.toLowerCase().includes(query) ||
        interaction.user_name?.toLowerCase().includes(query);

      const matchesChannel =
        this.filterChannel === 'all' ||
        interaction.channel === this.filterChannel;

      const matchesStatus =
        this.filterStatus === 'all' ||
        interaction.status === this.filterStatus;

      return matchesSearch && matchesChannel && matchesStatus;
    });

    this.currentPage = 1;
    this.updatePaginatedInteractions();
  }

  updatePaginatedInteractions(): void {
    this.totalPages = Math.ceil(
      this.filteredInteractions.length / this.itemsPerPage
    );
    if (this.totalPages === 0) {
      this.totalPages = 1;
    }
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedInteractions = this.filteredInteractions.slice(
      startIndex,
      endIndex
    );
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedInteractions();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(
      1,
      this.currentPage - Math.floor(maxVisiblePages / 2)
    );
    const endPage = Math.min(
      this.totalPages,
      startPage + maxVisiblePages - 1
    );

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

  private updateStats(): void {
    const total = this.interactions.length;

    const successes = this.interactions.filter(
      (i) => i.status === AIInteractionStatus.SUCCESS
    ).length;

    const errors = this.interactions.filter(
      (i) => i.status === AIInteractionStatus.ERROR
    ).length;

    this.stats = [
      {
        label: this.translate.instant('history.stats.total'),
        value: total.toLocaleString(),
        icon: 'message-circle',
        color: 'bg-blue-500',
      },
      {
        label: this.translate.instant('history.stats.successes'),
        value: successes.toLocaleString(),
        icon: 'check-circle',
        color: 'bg-green-500',
      },
      {
        label: this.translate.instant('history.stats.errors'),
        value: errors.toLocaleString(),
        icon: 'x-circle',
        color: 'bg-red-500',
      },
    ];
  }

  // ==================================================================
  // UTILIDADES VISUALES
  // ==================================================================

  getChannelIcon(channel: string): string {
    return getChannelIcon(channel);
  }

  getChannelLabel(channel: string): string {
    return getChannelLabel(channel);
  }

  getStatusBadgeClass(status: string): string {
    return getStatusBadgeClass(status);
  }

  getStatusLabel(status: string): string {
    return getStatusLabel(status);
  }

  getChannelColorClass(channel: string): string {
    return channel === AIChannel.VOICE
      ? 'bg-purple-500 text-white'
      : 'bg-blue-500 text-white';
  }

  hasAnswer(interaction: AIInteractionLog): boolean {
    return !!interaction.answer && interaction.answer.length > 0;
  }

  hasSources(interaction: AIInteractionLog): boolean {
    return !!interaction.sources && interaction.sources.length > 0;
  }

  getSourcesCount(interaction: AIInteractionLog): number {
    return interaction.sources?.length || 0;
  }

  /** Texto corto para preview (colapsado) */
  getPreview(text: string | null | undefined, max = 100): string {
    if (!text) return '';
    return text.length > max ? text.substring(0, max).trim() + '…' : text;
  }

  // ==================================================================
  // EXPORTACIÓN
  // ==================================================================

  exportPDF(): void {
    if (!this.filteredInteractions.length) {
      this.alertService.info(
        this.translate.instant('history.alerts.noActivities'),
        ''
      );
      return;
    }

    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(this.translate.instant('history.export.title'), 14, 20);
      doc.setFontSize(10);
      doc.text(
        `${this.translate.instant('history.export.generatedOn')}: ${new Date().toLocaleString()}`,
        14,
        28
      );

      const tableData = this.filteredInteractions.map((i) => [
        i.timestamp || '',
        this.getChannelLabel(i.channel),
        this.getStatusLabel(i.status),
        this.truncate(i.question, 60),
      ]);

      autoTable(doc, {
        startY: 35,
        head: [
          [
            this.translate.instant('history.export.columns.datetime'),
            'Canal',
            'Estado',
            'Pregunta',
          ],
        ],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [2, 171, 116] },
      });

      const filename = `historial_interacciones_${this.getCurrentTimestampForFilename()}.pdf`;
      doc.save(filename);
      this.alertService.success(
        this.translate.instant('history.alerts.pdfSuccess'),
        ''
      );
    } catch (error) {
      console.error('Error exportando PDF:', error);
      this.alertService.error(
        this.translate.instant('history.alerts.pdfError'),
        ''
      );
    }
  }

  exportExcel(): void {
    if (!this.filteredInteractions.length) {
      this.alertService.info(
        this.translate.instant('history.alerts.noActivities'),
        ''
      );
      return;
    }

    try {
      const BOM = '\uFEFF';
      const headers = ['Fecha', 'Canal', 'Estado', 'Pregunta', 'Respuesta'];

      const rows = this.filteredInteractions.map((i) => {
        const date = i.timestamp || '';
        const channel = this.getChannelLabel(i.channel);
        const status = this.getStatusLabel(i.status);
        const question = (i.question || '').replace(/"/g, '""');
        const answer = (i.answer || '').replace(/"/g, '""');
        return `"${date}";"${channel}";"${status}";"${question}";"${answer}"`;
      });

      const csvContent =
        BOM + headers.join(';') + '\n' + rows.join('\n');
      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `historial_interacciones_${this.getCurrentTimestampForFilename()}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.alertService.success(
        this.translate.instant('history.alerts.excelSuccess'),
        ''
      );
    } catch (error) {
      console.error('Error exportando CSV:', error);
      this.alertService.error(
        this.translate.instant('history.alerts.excelError'),
        ''
      );
    }
  }

  // ==================================================================
  // FORMATO
  // ==================================================================

  private truncate(text: string, max: number): string {
    if (!text) return '';
    return text.length > max ? text.substring(0, max) + '…' : text;
  }

  convertToUTCMinus5(dateString: string): string {
    // El backend guarda UTC. Si llega sin zona (versiones anteriores), se
    // interpreta como UTC: sin esto, el navegador lo tomaría como hora local.
    const hasZone = /([zZ]|[+-]dd:?dd)$/.test(dateString);
    const iso = hasZone ? dateString : dateString.replace(' ', 'T') + 'Z';
    const utcMinus5 = new Date(new Date(iso).getTime() - 5 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    // Componentes UTC del instante desplazado = hora de Colombia, sin depender
    // de la zona del navegador. Formato ISO (con "T"): el pipe date lo
    // interpreta igual en todos los navegadores (Safari rechaza el espacio).
    return (
      `${utcMinus5.getUTCFullYear()}-${pad(utcMinus5.getUTCMonth() + 1)}-${pad(utcMinus5.getUTCDate())}T` +
      `${pad(utcMinus5.getUTCHours())}:${pad(utcMinus5.getUTCMinutes())}:${pad(utcMinus5.getUTCSeconds())}`
    );
  }

  private getCurrentTimestampForFilename(): string {
    const now = new Date();
    const utcMinus5 = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${utcMinus5.getFullYear()}${pad(utcMinus5.getMonth() + 1)}${pad(utcMinus5.getDate())}_` +
      `${pad(utcMinus5.getHours())}${pad(utcMinus5.getMinutes())}${pad(utcMinus5.getSeconds())}`
    );
  }
}
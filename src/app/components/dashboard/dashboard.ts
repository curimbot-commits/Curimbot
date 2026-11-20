import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  Subject,
  takeUntil,
  finalize,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
} from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AnalyticsService } from '../../services/api/analytics.service';
import { DocumentService } from '../../services/api/document.service';
import { Auth as AuthService } from '../../components/authentication/auth/auth';
import { UserService } from 'src/app/services/api/user-service';
import {
  AIInteractionLog,
  ChartDataPoint,
  DashboardStats,
  DocumentType,
  TimeRange,
  UserExtended,
} from 'src/app/domain/models/document.model';
import { User, UserRole } from 'src/app/domain/models/user.model';

import { DashboardChartsComponent } from './dashboard-charts/dashboard-charts';
import { RecentActivitiesComponent } from './recent-activities/recent-activities';
import { ProfileAvatar } from 'src/app/shared/components/profile-avatar/profile-avatar';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    TranslateModule,
    DashboardChartsComponent,
    RecentActivitiesComponent,
    ProfileAvatar
],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  // ==================== DEPENDENCIAS ====================
  private analyticsService = inject(AnalyticsService);
  private documentService = inject(DocumentService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private userService = inject(UserService);
  private translate = inject(TranslateService);

  // ==================== ESTADO (SIGNALS) ====================
  isAdmin = signal<boolean>(false);
  showContent = signal<boolean>(false);

  activeFilter = signal<DocumentType | 'all'>('all');
  timeRange = signal<TimeRange>('week');
  searchQuery = signal<string>('');

  stats = signal<DashboardStats | null>(null);
  chartData = signal<ChartDataPoint[]>([]);
  recentInteractions = signal<AIInteractionLog[]>([]);
  users = signal<UserExtended[]>([]);

  isLoadingStats = signal<boolean>(false);
  isLoadingChart = signal<boolean>(false);
  isLoadingActivities = signal<boolean>(false);
  isRefreshing = signal<boolean>(false);

  errorStats = signal<string | null>(null);
  errorChart = signal<string | null>(null);
  errorActivities = signal<string | null>(null);

  // ==================== ESTADO DERIVADO ====================

  pieData = computed(() => {
    const s = this.stats();
    const filter = this.activeFilter();
    if (!s?.typeBreakdown) return [];

    if (filter === 'all') {
      return s.typeBreakdown
        .filter((item) => item.count > 0)
        .map((item) => ({
          name: item.file_type.toUpperCase(),
          value: item.count,
          color: this.getColorValue(item.file_type.toLowerCase()),
        }));
    } else {
      const typeData = s.typeBreakdown.find(
        (item) => item.file_type.toLowerCase() === filter.toLowerCase()
      );
      return typeData && typeData.count > 0
        ? [
            {
              name: filter.toUpperCase(),
              value: typeData.count,
              color: this.getColorValue(filter.toLowerCase()),
            },
          ]
        : [];
    }
  });

  filteredInteractions = computed(() => {
    let list = this.recentInteractions();
    const query = this.searchQuery().trim().toLowerCase();

    if (query) {
      list = list.filter(
        (i) =>
          (i.user_name || '').toLowerCase().includes(query) ||
          (i.question || '').toLowerCase().includes(query) ||
          (i.answer || '').toLowerCase().includes(query)
      );
    }
    return list;
  });

  documentTypes: (DocumentType | 'all')[] = ['all', 'pdf', 'txt', 'docx'];
  documentColors: Record<DocumentType | 'all', string> = {
    pdf: 'red',
    txt: 'green',
    docx: 'blue',
    all: 'purple',
  };

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // ==================== LIFECYCLE ====================
  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((query) => {
        this.searchQuery.set(query);
      });

    this.checkAdminStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== CORE ====================
  private checkAdminStatus(): void {
    this.authService
      .getUserProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile) => {
          this.isAdmin.set(profile?.role === UserRole.ADMIN);
          this.showContent.set(true);
          this.loadDashboardData();
        },
        error: () => {
          this.isAdmin.set(false);
          this.showContent.set(true);
          this.loadDashboardData();
        },
      });
  }

  private loadDashboardData(): void {
    this.isLoadingStats.set(true);
    this.isLoadingChart.set(true);
    this.isLoadingActivities.set(true);

    const isAdm = this.isAdmin();

    forkJoin({
      stats: this.analyticsService.getDashboardStats(isAdm),
      chart: this.analyticsService.getChartData('week', isAdm),
      interactions: this.analyticsService.getRecentAIInteractions(100, isAdm),
      users: this.userService.getUsers(),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingStats.set(false);
          this.isLoadingChart.set(false);
          this.isLoadingActivities.set(false);
        })
      )
      .subscribe({
        next: (res) => {
          this.stats.set({
            ...res.stats,
            typeBreakdown:
              res.stats.typeBreakdown?.map((item) => ({
                ...item,
                file_type: item.file_type.toLowerCase() as DocumentType,
              })) ?? [],
          });
          this.chartData.set(res.chart);
          this.recentInteractions.set(res.interactions);
          this.users.set(
            res.users.map((u) => ({
              id: u.id,
              email: u.email,
              name: u.name,
              role: u.role as UserRole,
              created_at: u.created_at || new Date().toISOString(),
              last_login: null,
              is_active: u.is_active ?? true,
              documentsCount: 0,
              lastActivity: 'Sin actividad',
              documents: [],
              profile_photo_url: (u as any).profile_photo_url || null,
            }))
          );
        },
        error: () => {
          this.loadStats();
          this.loadChartData();
          this.loadRecentActivities();
        },
      });
  }

  public loadStats(): void {
    this.isLoadingStats.set(true);
    this.errorStats.set(null);
    this.analyticsService
      .getDashboardStats(this.isAdmin())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingStats.set(false))
      )
      .subscribe({
        next: (data) => this.stats.set(data),
        error: (err) =>
          this.errorStats.set(
            `${this.translate.instant('dashboard.errors.stats')} ${err.message}`
          ),
      });
  }

  private loadChartData(): void {
    this.isLoadingChart.set(true);
    this.errorChart.set(null);
    this.analyticsService
      .getChartData(this.timeRange(), this.isAdmin())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingChart.set(false))
      )
      .subscribe({
        next: (data) => this.chartData.set(data),
        error: (err) =>
          this.errorChart.set(
            `${this.translate.instant('dashboard.errors.chart')} ${err.message}`
          ),
      });
  }

  public loadRecentActivities(): void {
    this.isLoadingActivities.set(true);
    this.errorActivities.set(null);
    this.analyticsService
      .getRecentAIInteractions(100, this.isAdmin())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingActivities.set(false))
      )
      .subscribe({
        next: (data) => this.recentInteractions.set(data),
        error: (err) =>
          this.errorActivities.set(
            `${this.translate.instant('dashboard.errors.activities')} ${err.message}`
          ),
      });
  }

  onSearchInput(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.searchSubject.next(input);
  }

  setActiveFilter(filter: DocumentType | 'all') {
    this.activeFilter.set(filter);
  }

  onTimeRangeChange(range: string) {
    this.timeRange.set(range as TimeRange);
    this.loadChartData();
  }

  getDocumentCountByType(type: DocumentType | 'all'): number {
    const s = this.stats();
    if (!s) return 0;
    if (type === 'all') return s.totalDocuments || 0;
    return (
      s.typeBreakdown?.find(
        (item) => item.file_type.toLowerCase() === type.toLowerCase()
      )?.count ?? 0
    );
  }

  getColorValue(type: string): string {
    const c: Record<string, string> = {
      pdf: '#ef4444',
      txt: '#02ab74',
      docx: '#3b82f6',
      all: '#7209b7',
    };
    return c[type] ?? '#6b7280';
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  }

  exportActivities(): void {
    const headers = this.isAdmin()
      ? ['Usuario', 'Pregunta', 'Canal', 'Estado', 'Confianza', 'Fecha', 'Hora']
      : ['Pregunta', 'Canal', 'Estado', 'Confianza', 'Fecha', 'Hora'];

    const data = this.filteredInteractions().map((i) => {
      const date = new Date(i.timestamp);
      const confidence =
        i.confidence !== null ? `${Math.round(i.confidence * 100)}%` : '—';
      const row = [
        ...(this.isAdmin() ? [i.user_name || ''] : []),
        i.question || '',
        i.channel || '',
        i.status || '',
        confidence,
        i.timestamp ? date.toLocaleDateString() : '',
        i.timestamp ? date.toLocaleTimeString() : '',
      ];
      return row;
    });

    const escapeCSV = (field: any) => {
      if (!field) return '';
      const strField = String(field);
      if (
        strField.includes(';') ||
        strField.includes('"') ||
        strField.includes('\n')
      ) {
        return `"${strField.replace(/"/g, '""')}"`;
      }
      return strField;
    };

    const csvContent = [
      headers.map(escapeCSV).join(';'),
      ...data.map((row) => row.map(escapeCSV).join(';')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `interacciones_ia_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
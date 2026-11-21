import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, takeUntil, finalize, forkJoin } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AnalyticsService } from '../../services/api/analytics.service';
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
import { UserRole } from 'src/app/domain/models/user.model';

import { DashboardChartsComponent } from './dashboard-charts/dashboard-charts';
import { RecentActivitiesComponent } from './recent-activities/recent-activities';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    TranslateModule,
    DashboardChartsComponent,
    RecentActivitiesComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit, OnDestroy {
  // ==================== DEPENDENCIAS ====================
  private analyticsService = inject(AnalyticsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private userService = inject(UserService);
  private translate = inject(TranslateService);

  // ==================== ESTADO (SIGNALS) ====================
  isAdmin = signal<boolean>(false);
  showContent = signal<boolean>(false);

  activeFilter = signal<DocumentType | 'all'>('all');
  timeRange = signal<TimeRange>('week');

  stats = signal<DashboardStats | null>(null);
  chartData = signal<ChartDataPoint[]>([]);
  recentInteractions = signal<AIInteractionLog[]>([]);
  users = signal<UserExtended[]>([]);

  isLoadingStats = signal<boolean>(false);
  isLoadingChart = signal<boolean>(false);
  isLoadingActivities = signal<boolean>(false);

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

  documentTypes: (DocumentType | 'all')[] = ['all', 'pdf', 'txt', 'docx'];
  /** Clases completas y estáticas: Tailwind v4 no genera clases construidas en tiempo de ejecución. */
  readonly typeStyles: Record<DocumentType | 'all', { active: string; icon: string; iconActive: string }> = {
    all: { active: 'border-violet-400 ring-1 ring-violet-200 focus-visible:ring-violet-400', icon: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', iconActive: 'bg-violet-600 text-white' },
    pdf: { active: 'border-red-400 ring-1 ring-red-200 focus-visible:ring-red-400', icon: 'bg-red-50 text-red-600', iconActive: 'bg-red-500 text-white' },
    txt: { active: 'border-emerald-400 ring-1 ring-emerald-200 focus-visible:ring-emerald-400', icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', iconActive: 'bg-emerald-500 text-white' },
    docx: { active: 'border-blue-400 ring-1 ring-blue-200 focus-visible:ring-blue-400', icon: 'bg-blue-50 text-blue-600', iconActive: 'bg-blue-500 text-white' },
  };

  private destroy$ = new Subject<void>();

  // ==================== LIFECYCLE ====================
  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

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
      txt: '#10b981',
      docx: '#3b82f6',
      all: '#7209b7',
    };
    return c[type] ?? '#6b7280';
  }

}

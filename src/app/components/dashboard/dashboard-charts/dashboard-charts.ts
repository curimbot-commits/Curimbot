import { Component, ChangeDetectionStrategy, effect, input, output, ElementRef, ViewChild, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { Chart } from 'chart.js/auto';
import { ChartDataPoint, DocumentType, TimeRange } from 'src/app/domain/models/document.model';

@Component({
  selector: 'app-dashboard-charts',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
      <!-- Distribución por tipo -->
      <section class="lg:col-span-2 flex flex-col rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base sm:text-lg font-semibold text-[#070025]">{{ 'dashboard.distributionTitle' | translate }}</h3>
            <p class="text-sm text-gray-500">
              {{ activeFilter() === 'all' ? ('dashboard.byFileType' | translate) : ('dashboard.filteredBy' | translate) + ' ' + activeFilter().toUpperCase() }}
            </p>
          </div>
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <lucide-angular name="PieChart" class="w-5 h-5"></lucide-angular>
          </span>
        </div>
        @if (isLoadingStats()) {
          <div class="flex h-[260px] items-center justify-center rounded-xl bg-gray-50">
            <lucide-angular name="Loader" class="w-7 h-7 animate-spin text-[#02ab74]"></lucide-angular>
          </div>
        } @else if (pieData().length > 0) {
          <div class="relative h-[260px]">
            <canvas #pieChart [attr.aria-label]="'dashboard.distributionTitle' | translate" role="img"></canvas>
          </div>
          <ul class="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-gray-100 pt-4">
            @for (item of pieData(); track item.name) {
              <li class="flex items-center gap-2 text-sm text-gray-600">
                <span class="h-2.5 w-2.5 rounded-full" [style.background-color]="item.color"></span>
                {{ item.name }} <span class="font-semibold text-[#070025]">{{ item.value }}</span>
              </li>
            }
          </ul>
        } @else {
          <div class="flex h-[260px] flex-col items-center justify-center rounded-xl bg-gray-50 text-center">
            <lucide-angular name="Inbox" class="mb-2 w-10 h-10 text-gray-300"></lucide-angular>
            <p class="text-sm font-medium text-gray-500">{{ 'dashboard.noDataTitle' | translate }}</p>
          </div>
        }
      </section>

      <!-- Tendencia -->
      <section class="lg:col-span-3 flex flex-col rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 class="text-base sm:text-lg font-semibold text-[#070025]">{{ 'dashboard.trendTitle' | translate }}</h3>
            <p class="text-sm text-gray-500">{{ 'dashboard.trendSubtitle' | translate }}</p>
          </div>
          <div class="inline-flex w-fit rounded-xl bg-gray-100 p-1 dark:bg-slate-900" role="group" [attr.aria-label]="'dashboard.trendTitle' | translate">
            @for (range of ranges; track range) {
              <button type="button" (click)="setTimeRange(range)" [attr.aria-pressed]="timeRange() === range"
                [class]="'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ' +
                  (timeRange() === range ? 'bg-white text-[#070025] shadow-sm' : 'text-gray-500 hover:text-[#070025]')">
                {{ 'dashboard.timeRanges.' + range | translate }}
              </button>
            }
          </div>
        </div>
        @if (isLoadingChart()) {
          <div class="flex h-[300px] items-center justify-center rounded-xl bg-gray-50">
            <lucide-angular name="Loader" class="w-7 h-7 animate-spin text-[#02ab74]"></lucide-angular>
          </div>
        } @else if (chartData().length > 0) {
          <div class="relative h-[300px]">
            <canvas #lineChart [attr.aria-label]="'dashboard.trendTitle' | translate" role="img"></canvas>
          </div>
        } @else {
          <div class="flex h-[300px] flex-col items-center justify-center rounded-xl bg-gray-50 text-center">
            <lucide-angular name="Inbox" class="mb-2 w-10 h-10 text-gray-300"></lucide-angular>
            <p class="text-sm font-medium text-gray-500">{{ 'dashboard.noTrendData' | translate }}</p>
          </div>
        }
      </section>
    </div>
  `
})
export class DashboardChartsComponent implements OnDestroy {
  // Inputs as signals (Angular 17+)
  pieData = input<{ name: string; value: number; color: string }[]>([]);
  chartData = input<ChartDataPoint[]>([]);
  activeFilter = input<string>('all');
  timeRange = input<string>('week');
  isAdmin = input<boolean>(false);
  isLoadingStats = input<boolean>(false);
  isLoadingChart = input<boolean>(false);

  // Outputs
  timeRangeChange = output<string>();

  readonly ranges = ['week', 'month', 'year'];

  @ViewChild('pieChart') pieChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('lineChart') lineChartCanvas!: ElementRef<HTMLCanvasElement>;

  private pieChartInstance: Chart | null = null;
  private lineChartInstance: Chart | null = null;

  constructor(private ngZone: NgZone) {
    // Escuchar cambios reactivos a través de effect
    effect(() => {
      const pData = this.pieData();
      if (!this.isLoadingStats() && pData.length > 0) {
        this.ngZone.runOutsideAngular(() => setTimeout(() => this.renderPieChart(pData), 50));
      } else if (this.pieChartInstance) {
        this.pieChartInstance.destroy();
        this.pieChartInstance = null;
      }
    });

    effect(() => {
      const cData = this.chartData();
      if (!this.isLoadingChart() && cData.length > 0) {
        this.ngZone.runOutsideAngular(() => setTimeout(() => this.renderLineChart(cData), 50));
      } else if (this.lineChartInstance) {
        this.lineChartInstance.destroy();
        this.lineChartInstance = null;
      }
    });
  }

  setTimeRange(range: string): void {
    if (this.timeRange() !== range) {
      if (this.lineChartInstance) {
        this.lineChartInstance.destroy();
        this.lineChartInstance = null;
      }
      this.timeRangeChange.emit(range);
    }
  }

  private getColorValue(itemType: string): string {
    const colors: Record<string, string> = { pdf: '#ef4444', txt: '#10b981', docx: '#3b82f6' };
    return colors[itemType] || '#a855f7';
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private renderPieChart(data: { name: string; value: number; color: string }[]): void {
    if (!this.pieChartCanvas?.nativeElement) return;
    if (this.pieChartInstance) {
        this.pieChartInstance.data.labels = data.map(i => i.name);
        this.pieChartInstance.data.datasets[0].data = data.map(i => i.value);
        this.pieChartInstance.data.datasets[0].backgroundColor = data.map(i => i.color);
        this.pieChartInstance.update();
        return;
    }
    
    this.pieChartInstance = new Chart(this.pieChartCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: data.map(i => i.name),
        datasets: [{
          data: data.map(i => i.value),
          backgroundColor: data.map(i => i.color),
          borderWidth: 3, borderColor: '#ffffff', hoverOffset: 8
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } }
    });
  }

  private renderLineChart(data: ChartDataPoint[]): void {
    if (!this.lineChartCanvas?.nativeElement) return;
    const labels = data.map(i => i.label || '');
    const pdfData = data.map(i => i.pdf || 0);
    const docxData = data.map(i => i.docx || 0);
    const txtData = data.map(i => i.txt || 0);

    if (this.lineChartInstance) {
      this.lineChartInstance.data.labels = labels;
      this.lineChartInstance.data.datasets[0].data = pdfData;
      this.lineChartInstance.data.datasets[1].data = docxData;
      this.lineChartInstance.data.datasets[2].data = txtData;
      this.lineChartInstance.update();
      return;
    }

    this.lineChartInstance = new Chart(this.lineChartCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'PDF', data: pdfData, backgroundColor: this.hexToRgba(this.getColorValue('pdf'), 0.85), borderColor: this.getColorValue('pdf'), borderWidth: 0, borderRadius: 6, maxBarThickness: 28 },
          { label: 'DOCX', data: docxData, backgroundColor: this.hexToRgba(this.getColorValue('docx'), 0.85), borderColor: this.getColorValue('docx'), borderWidth: 0, borderRadius: 6, maxBarThickness: 28 },
          { label: 'TXT', data: txtData, backgroundColor: this.hexToRgba(this.getColorValue('txt'), 0.85), borderColor: this.getColorValue('txt'), borderWidth: 0, borderRadius: 6, maxBarThickness: 28 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16 } } },
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' }, border: { display: false } }
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pieChartInstance) this.pieChartInstance.destroy();
    if (this.lineChartInstance) this.lineChartInstance.destroy();
  }
}

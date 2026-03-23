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
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Gráfico Circular -->
      <div class="p-6 border border-gray-200 rounded-xl bg-white shadow-sm card-hover animate-fade-in-up stagger-3">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-[#070025] text-lg font-semibold mb-1">{{ 'dashboard.distributionTitle' | translate }}</h3>
            <p class="text-sm text-gray-600">
              {{ activeFilter() === 'all' ? ('dashboard.byFileType' | translate) : ('dashboard.filteredBy' | translate) + ' ' + activeFilter().toUpperCase() }}
              @if (isAdmin()) {
                <span class="text-purple-600 font-medium">{{ 'dashboard.global' | translate }}</span>
              }
            </p>
          </div>
          <div class="p-2 rounded-lg smooth-transition" style="background: linear-gradient(to bottom right, #02ab74, #7209b7);">
            <lucide-angular name="PieChart" class="w-5 h-5 text-white"></lucide-angular>
          </div>
        </div>
        @if (isLoadingStats()) {
          <div class="h-[280px] bg-gray-50 rounded-lg flex items-center justify-center">
            <lucide-angular name="Loader" class="w-8 h-8 text-[#02ab74] spinner"></lucide-angular>
          </div>
        } @else if (pieData().length > 0) {
          <div class="h-[280px] relative">
            <canvas #pieChart aria-label="Gráfico de distribución"></canvas>
          </div>
          <div class="mt-4 pt-4 border-t border-gray-200">
            <div class="flex justify-center gap-4 flex-wrap">
              @for (item of pieData(); track item) {
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full" [style.background-color]="item.color"></div>
                  <span class="text-sm text-gray-600">{{ item.name }}: {{ item.value }}</span>
                </div>
              }
            </div>
          </div>
        } @else {
          <div class="h-[280px] bg-gray-50 rounded-lg flex items-center justify-center text-center">
            <div>
              <lucide-angular name="Inbox" class="w-12 h-12 text-gray-400 mx-auto mb-2"></lucide-angular>
              <p class="text-gray-500 font-medium">{{ 'dashboard.noDataTitle' | translate }}</p>
            </div>
          </div>
        }
      </div>

      <!-- Gráfico de Líneas -->
      <div class="p-6 border border-gray-200 rounded-xl bg-white shadow-sm card-hover animate-fade-in-up stagger-4">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-[#070025] text-lg font-semibold mb-1">{{ 'dashboard.trendTitle' | translate }}</h3>
            <p class="text-sm text-gray-600">
              {{ 'dashboard.trendSubtitle' | translate }}
              @if (isAdmin()) {
                <span class="text-purple-600 font-medium">{{ 'dashboard.global' | translate }}</span>
              }
            </p>
          </div>
          <div class="p-2 rounded-lg smooth-transition" style="background: linear-gradient(to bottom right, #02ab74, #7209b7);">
            <lucide-angular name="TrendingUp" class="w-5 h-5 text-white"></lucide-angular>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 mb-4">
          @for (range of ['week', 'month', 'year']; track range) {
            <button (click)="setTimeRange(range)" [ngClass]="[
              'px-4 py-2 rounded-lg text-sm smooth-transition',
              timeRange() === range ? 'bg-[#02ab74] text-white shadow-md' : 'border border-gray-300 text-gray-600 hover:border-[#02ab74] hover:text-[#02ab74]'
            ]">{{ 'dashboard.timeRanges.' + range | translate }}</button>
          }
        </div>
        @if (isLoadingChart()) {
          <div class="h-[240px] bg-gray-50 rounded-lg flex items-center justify-center">
            <lucide-angular name="Loader" class="w-8 h-8 text-[#02ab74] spinner"></lucide-angular>
          </div>
        } @else if (chartData().length > 0) {
          <div class="h-[240px]">
             <canvas #lineChart aria-label="Gráfico de tendencia"></canvas>
          </div>
        } @else {
          <div class="h-[240px] bg-gray-50 rounded-lg flex items-center justify-center text-center">
            <div>
              <lucide-angular name="Inbox" class="w-12 h-12 text-gray-400 mx-auto mb-2"></lucide-angular>
              <p class="text-gray-500 font-medium">{{ 'dashboard.noDataTitle' | translate }}</p>
            </div>
          </div>
        }
      </div>
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
    const colors: Record<string, string> = { pdf: '#ef4444', txt: '#22c55e', docx: '#3b82f6' };
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
          borderWidth: 3, borderColor: '#ffffff', hoverOffset: 10
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
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
          { label: 'PDF', data: pdfData, backgroundColor: this.hexToRgba(this.getColorValue('pdf'), 0.85), borderColor: this.getColorValue('pdf'), borderWidth: 1.5, borderRadius: 6 },
          { label: 'DOCX', data: docxData, backgroundColor: this.hexToRgba(this.getColorValue('docx'), 0.85), borderColor: this.getColorValue('docx'), borderWidth: 1.5, borderRadius: 6 },
          { label: 'TXT', data: txtData, backgroundColor: this.hexToRgba(this.getColorValue('txt'), 0.85), borderColor: this.getColorValue('txt'), borderWidth: 1.5, borderRadius: 6 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } } } }
    });
  }

  ngOnDestroy(): void {
    if (this.pieChartInstance) this.pieChartInstance.destroy();
    if (this.lineChartInstance) this.lineChartInstance.destroy();
  }
}

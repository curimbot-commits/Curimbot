import { Component, ChangeDetectionStrategy, input, output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ActivityLog, UserExtended } from 'src/app/domain/models/document.model';
import { ProfileAvatar } from '@shared/components/profile-avatar/profile-avatar';

@Component({
  selector: 'app-recent-activities',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, ProfileAvatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm card-hover animate-fade-in-up stagger-5">
      <div class="p-6 border-b border-gray-200 bg-gray-50">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-[#070025] text-lg font-semibold mb-1">
              {{ 'dashboard.recentActivitiesTitle' | translate }}
              @if (isAdmin()) { <span class="ml-2 text-sm font-normal text-purple-600">{{ 'dashboard.allUsers' | translate }}</span> }
            </h3>
            <p class="text-sm text-gray-600">
              {{ activeFilter() === 'all' ? ('dashboard.showingAllActivities' | translate) + ' (' + filtered().length + ')' : ('dashboard.filteredBy' | translate) + ' ' + activeFilter().toUpperCase() + ' (' + filtered().length + ')' }}
            </p>
          </div>
          <button (click)="refresh.emit()" [disabled]="isLoading()" class="p-2 hover:bg-white rounded-lg smooth-transition disabled:opacity-50">
            <lucide-angular name="RefreshCcw" [class]="isLoading() ? 'w-5 h-5 text-gray-600 spinner' : 'w-5 h-5 text-gray-600'"></lucide-angular>
          </button>
        </div>
      </div>
      
      @if (isLoading()) {
        <div class="p-8 text-center">
          <lucide-angular name="Loader" class="w-8 h-8 text-[#02ab74] spinner mx-auto mb-2"></lucide-angular>
          <p class="text-gray-600">{{ 'dashboard.loadingActivities' | translate }}</p>
        </div>
      } @else {
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{{ 'dashboard.table.user' | translate }}</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{{ 'dashboard.table.document' | translate }}</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{{ 'dashboard.table.type' | translate }}</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{{ 'dashboard.table.action' | translate }}</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{{ 'dashboard.table.dateTime' | translate }}</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              @for (activity of paginated(); track activity) {
                <tr class="hover:bg-gray-50 smooth-transition">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                      @if (getUserById(activity.user_id); as user) {
                        <app-profile-avatar [size]="2.5" [showEditControls]="false" [userData]="user" [userPhotoUrl]="user.profile_photo_url"></app-profile-avatar>
                      } @else {
                        <div class="rounded-full flex items-center justify-center text-white text-sm font-semibold" style="width: 2.5rem; height: 2.5rem; background: linear-gradient(to bottom right, #02ab74, #7209b7);">
                          {{ getUserInitials(activity.user_name) }}
                        </div>
                      }
                      <div>
                        <span class="text-[#070025] font-medium">{{ activity.user_name }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                      <lucide-angular name="FileText" class="w-4 h-4 text-gray-400"></lucide-angular>
                      <span class="text-gray-900">{{ activity.document_name }}</span>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span [ngClass]="getFileTypeColorClass(activity.document_type)" class="px-3 py-1 rounded-full text-sm font-medium">
                      {{ activity.document_type.toUpperCase() }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div [ngClass]="['inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium', getActionColorClass(activity.action)]">
                      <lucide-angular [name]="getActionIcon(activity.action)" class="w-4 h-4"></lucide-angular>
                      <span class="capitalize">{{ activity.action }}</span>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div>
                      <div>{{ formatDate(activity.timestamp) }}</div>
                      <div class="text-xs text-gray-500">{{ formatTime(activity.timestamp) }}</div>
                    </div>
                  </td>
                </tr>
              }
              @if (filtered().length === 0) {
                <tr>
                  <td colspan="5" class="px-6 py-8 text-center">
                    <lucide-angular name="Inbox" class="w-12 h-12 text-gray-300 mx-auto mb-2"></lucide-angular>
                    <p class="text-gray-500">{{ 'dashboard.noRecentActivitiesTitle' | translate }}</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (!isLoading() && filtered().length > 0) {
        <div class="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="text-sm text-gray-600">
            {{ 'dashboard.pagination.showing' | translate }} 
            <span class="font-medium">{{ pageStart() }}</span> - <span class="font-medium">{{ pageEnd() }}</span> 
            {{ 'dashboard.pagination.of' | translate }} <span class="font-medium">{{ filtered().length }}</span>
          </div>
          <div class="flex gap-2">
            <button (click)="changePage(currentPage() - 1)" [disabled]="currentPage() === 1" class="px-3 py-2 rounded-lg border border-gray-300 smooth-transition disabled:opacity-50">
              <lucide-angular name="ChevronLeft" class="w-5 h-5"></lucide-angular>
            </button>
            <button (click)="changePage(currentPage() + 1)" [disabled]="currentPage() >= totalPages()" class="px-3 py-2 rounded-lg border border-gray-300 smooth-transition disabled:opacity-50">
              <lucide-angular name="ChevronRight" class="w-5 h-5"></lucide-angular>
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class RecentActivitiesComponent {
  activities = input<ActivityLog[]>([]);
  searchQuery = input<string>('');
  activeFilter = input<string>('all');
  isAdmin = input<boolean>(false);
  isLoading = input<boolean>(false);
  usersList = input<UserExtended[]>([]);

  refresh = output<void>();

  currentPage = signal(1);
  itemsPerPage = 6;

  // Computed state
  filtered = computed(() => {
    let result = this.activities();
    const filter = this.activeFilter();
    const query = this.searchQuery().toLowerCase().trim();

    if (filter !== 'all') {
      result = result.filter(a => a.document_type === filter);
    }
    if (query) {
      result = result.filter(a => 
        a.document_name?.toLowerCase().includes(query) || 
        a.user_name?.toLowerCase().includes(query) || 
        a.action?.toLowerCase().includes(query)
      );
    }
    // Si cambia el filtro, forzamos la página a 1 indirectamente reseteando cuando llamemos al effect en el padre, pero aquí lo haremos simple.
    return result;
  });

  paginated = computed(() => {
    const list = this.filtered();
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    return list.slice(start, start + this.itemsPerPage);
  });

  totalPages = computed(() => Math.ceil(this.filtered().length / this.itemsPerPage));
  pageStart = computed(() => this.filtered().length === 0 ? 0 : ((this.currentPage() - 1) * this.itemsPerPage) + 1);
  pageEnd = computed(() => Math.min(this.currentPage() * this.itemsPerPage, this.filtered().length));

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  // Métodos de ayuda visual
  getUserById(id: number | undefined): UserExtended | undefined {
    return id ? this.usersList().find(u => u.id === id) : undefined;
  }

  getUserInitials(name: string | undefined): string {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  getFileTypeColorClass(type: string | undefined): string {
    switch(type) {
      case 'pdf': return 'bg-red-100 text-red-800 border border-red-200';
      case 'docx': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'txt': return 'bg-green-100 text-green-800 border border-green-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  }

  getActionColorClass(action: string | undefined): string {
    switch (action?.toLowerCase()) {
      case 'upload': return 'text-blue-700 bg-blue-50 border border-blue-100';
      case 'view': return 'text-purple-700 bg-purple-50 border border-purple-100';
      case 'download': return 'text-[#02ab74] bg-[#02ab74]/10 border border-[#02ab74]/20';
      case 'delete': return 'text-red-700 bg-red-50 border border-red-100';
      default: return 'text-gray-700 bg-gray-50 border border-gray-100';
    }
  }

  getActionIcon(action: string | undefined): string {
    switch (action?.toLowerCase()) {
      case 'upload': return 'UploadCloud';
      case 'view': return 'Eye';
      case 'download': return 'DownloadCloud';
      case 'delete': return 'Trash2';
      default: return 'Activity';
    }
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatTime(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
}

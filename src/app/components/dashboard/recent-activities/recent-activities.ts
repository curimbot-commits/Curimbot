import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  AIInteractionLog,
  AIChannel,
  UserExtended,
  getChannelIcon,
  getChannelLabel,
  getStatusBadgeClass,
  getStatusLabel,
} from 'src/app/domain/models/document.model';
import { ProfileAvatar } from '@shared/components/profile-avatar/profile-avatar';

@Component({
  selector: 'app-recent-activities',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, ProfileAvatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm card-hover animate-fade-in-up stagger-5">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200 bg-gray-50">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-[#070025] text-lg font-semibold mb-1">
              Interacciones IA recientes
              @if (isAdmin()) {
                <span class="ml-2 text-sm font-normal text-purple-600">(todos los usuarios)</span>
              }
            </h3>
            <p class="text-sm text-gray-600">
              Mostrando {{ filtered().length }} interacciones
            </p>
          </div>
          <button
            (click)="refresh.emit()"
            [disabled]="isLoading()"
            class="p-2 hover:bg-white rounded-lg smooth-transition disabled:opacity-50">
            <lucide-angular
              name="RefreshCcw"
              [class]="isLoading() ? 'w-5 h-5 text-gray-600 spinner' : 'w-5 h-5 text-gray-600'">
            </lucide-angular>
          </button>
        </div>
      </div>

      @if (isLoading()) {
        <div class="p-8 text-center">
          <lucide-angular name="Loader" class="w-8 h-8 text-[#02ab74] spinner mx-auto mb-2"></lucide-angular>
          <p class="text-gray-600">Cargando interacciones...</p>
        </div>
      } @else {
        <!-- ===================== DESKTOP TABLE ===================== -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Usuario</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Pregunta</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Canal</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Estado</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Fecha</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              @for (interaction of paginated(); track interaction.id) {
                <tr class="hover:bg-gray-50 smooth-transition">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                      @if (getUserById(interaction.user_id); as user) {
                        <app-profile-avatar
                          [size]="2.5"
                          [showEditControls]="false"
                          [userData]="user"
                          [userPhotoUrl]="user.profile_photo_url">
                        </app-profile-avatar>
                      } @else {
                        <div
                          class="rounded-full flex items-center justify-center text-white text-sm font-semibold"
                          style="width: 2.5rem; height: 2.5rem; background: linear-gradient(to bottom right, #02ab74, #7209b7);">
                          {{ getUserInitials(interaction.user_name) }}
                        </div>
                      }
                      <div>
                        <span class="text-[#070025] font-medium">{{ interaction.user_name }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 max-w-md">
                    <div class="flex items-start gap-2">
                      <lucide-angular name="MessageCircle" class="w-4 h-4 text-gray-400 flex-shrink-0 mt-1"></lucide-angular>
                      <span class="text-gray-900 text-sm line-clamp-2">
                        {{ truncate(interaction.question, 80) }}
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span [ngClass]="getChannelBadgeClass(interaction.channel)"
                          class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium">
                      <lucide-angular [name]="getChannelIcon(interaction.channel)" class="w-4 h-4"></lucide-angular>
                      {{ getChannelLabel(interaction.channel) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span [ngClass]="getStatusBadgeClass(interaction.status)"
                          class="px-3 py-1 rounded-full text-sm font-medium">
                      {{ getStatusLabel(interaction.status) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div>
                      <div>{{ formatDate(interaction.timestamp) }}</div>
                      <div class="text-xs text-gray-500">{{ formatTime(interaction.timestamp) }}</div>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- ===================== MOBILE CARDS ===================== -->
        <div class="md:hidden divide-y divide-gray-100">
          @for (interaction of paginated(); track interaction.id) {
            <div class="p-4 hover:bg-gray-50 transition-colors">
              <div class="flex items-start gap-3">
                <!-- Avatar -->
                 
                @if (getUserById(interaction.user_id); as user) {
                  <app-profile-avatar
                    [size]="2.5"
                    [userData]="user"
                    [userPhotoUrl]="user.profile_photo_url">
                  </app-profile-avatar>
                } @else {
                  <div
                    class="rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                    style="width: 2.5rem; height: 2.5rem; background: linear-gradient(to bottom right, #02ab74, #7209b7);">
                    {{ getUserInitials(interaction.user_name) }}
                  </div>
                }

                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="font-medium text-[#070025] truncate">{{ interaction.user_name }}</span>
                    <span class="text-xs text-gray-500 whitespace-nowrap">
                      {{ formatDate(interaction.timestamp) }}
                    </span>
                  </div>

                  <p class="text-sm text-gray-800 line-clamp-2 mb-2">
                    {{ interaction.question }}
                  </p>

                  <div class="flex flex-wrap items-center gap-2">
                    <span [ngClass]="getChannelBadgeClass(interaction.channel)"
                          class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium">
                      <lucide-angular [name]="getChannelIcon(interaction.channel)" class="w-3.5 h-3.5"></lucide-angular>
                      {{ getChannelLabel(interaction.channel) }}
                    </span>
                    <span [ngClass]="getStatusBadgeClass(interaction.status)"
                          class="px-2.5 py-0.5 rounded-full text-xs font-medium">
                      {{ getStatusLabel(interaction.status) }}
                    </span>
                    <span class="text-xs text-gray-500 ml-auto">
                      {{ formatTime(interaction.timestamp) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Empty state (works for both mobile & desktop) -->
        @if (filtered().length === 0) {
          <div class="px-6 py-12 text-center">
            <lucide-angular name="Inbox" class="w-12 h-12 text-gray-300 mx-auto mb-2"></lucide-angular>
            <p class="text-gray-500">No hay interacciones IA recientes</p>
          </div>
        }
      }

      <!-- Pagination -->
      @if (!isLoading() && filtered().length > 0) {
        <div class="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="text-sm text-gray-600">
            Mostrando
            <span class="font-medium">{{ pageStart() }}</span> -
            <span class="font-medium">{{ pageEnd() }}</span>
            de <span class="font-medium">{{ filtered().length }}</span>
          </div>
          <div class="flex gap-2">
            <button
              (click)="changePage(currentPage() - 1)"
              [disabled]="currentPage() === 1"
              class="px-3 py-2 rounded-lg border border-gray-300 smooth-transition disabled:opacity-50">
              <lucide-angular name="ChevronLeft" class="w-5 h-5"></lucide-angular>
            </button>
            <button
              (click)="changePage(currentPage() + 1)"
              [disabled]="currentPage() >= totalPages()"
              class="px-3 py-2 rounded-lg border border-gray-300 smooth-transition disabled:opacity-50">
              <lucide-angular name="ChevronRight" class="w-5 h-5"></lucide-angular>
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class RecentActivitiesComponent {
  interactions = input<AIInteractionLog[]>([]);
  searchQuery = input<string>('');
  activeFilter = input<string>('all');          // now used
  isAdmin = input<boolean>(false);
  isLoading = input<boolean>(false);
  usersList = input<UserExtended[]>([]);

  refresh = output<void>();

  currentPage = signal(1);
  itemsPerPage = 6;

  // Reset page when filters change
  constructor() {
    effect(() => {
      // track the signals that should reset pagination
      this.searchQuery();
      this.activeFilter();
      this.interactions();
      this.currentPage.set(1);
    });
  }

  filtered = computed(() => {
    let result = this.interactions();
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.activeFilter();

    // Search
    if (query) {
      result = result.filter(
        (i) =>
          i.question?.toLowerCase().includes(query) ||
          i.answer?.toLowerCase().includes(query) ||
          i.user_name?.toLowerCase().includes(query)
      );
    }

    // Active filter (channel / status / etc.)
    if (filter && filter !== 'all') {
      result = result.filter((i) => {
        // Adjust according to the real values you use for activeFilter
        if (filter === 'voice' || filter === 'text') {
          return i.channel === filter;
        }
        // status filter example
        return i.status === filter;
      });
    }

    return result;
  });

  paginated = computed(() => {
    const list = this.filtered();
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    return list.slice(start, start + this.itemsPerPage);
  });

  totalPages = computed(() =>
    Math.ceil(this.filtered().length / this.itemsPerPage) || 1
  );

  pageStart = computed(() =>
    this.filtered().length === 0
      ? 0
      : (this.currentPage() - 1) * this.itemsPerPage + 1
  );

  pageEnd = computed(() =>
    Math.min(this.currentPage() * this.itemsPerPage, this.filtered().length)
  );

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  getUserById(id: number | null | undefined): UserExtended | undefined {
    return id ? this.usersList().find((u) => u.id === id) : undefined;
  }

  getUserInitials(name: string | undefined): string {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  getChannelIcon(channel: string): string {
    return getChannelIcon(channel);
  }

  getChannelLabel(channel: string): string {
    return getChannelLabel(channel);
  }

  getChannelBadgeClass(channel: string): string {
    return channel === AIChannel.VOICE
      ? 'text-purple-700 bg-purple-50 border border-purple-100'
      : 'text-blue-700 bg-blue-50 border border-blue-100';
  }

  getStatusBadgeClass(status: string): string {
    return getStatusBadgeClass(status);
  }

  getStatusLabel(status: string): string {
    return getStatusLabel(status);
  }

  truncate(text: string | undefined, max: number): string {
    if (!text) return '';
    return text.length > max ? text.substring(0, max) + '…' : text;
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatTime(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }


  
}
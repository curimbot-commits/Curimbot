import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  AIInteractionLog,
  AIChannel,
  AIInteractionStatus,
  UserExtended,
  getChannelIcon,
  getStatusBadgeClass,
} from 'src/app/domain/models/document.model';
import { ProfileAvatar } from '@shared/components/profile-avatar/profile-avatar';

@Component({
  selector: 'app-recent-activities',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, ProfileAvatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <!-- Encabezado -->
      <div class="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
        <div class="min-w-0">
          <h3 class="text-base sm:text-lg font-semibold text-[#070025]">{{ 'dashboard.activity.title' | translate }}</h3>
          <p class="text-sm text-gray-500">
            {{ 'dashboard.activity.count' | translate: { count: interactions().length } }}
            @if (isAdmin()) {
              <span class="text-gray-400">·</span> {{ 'dashboard.activity.allUsers' | translate }}
            }
          </p>
        </div>
        <button type="button" (click)="refresh.emit()" [disabled]="isLoading()"
          [attr.aria-label]="'dashboard.activity.refresh' | translate" [title]="'dashboard.activity.refresh' | translate"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-[#070025] disabled:opacity-50">
          <lucide-angular name="RefreshCcw" [class]="isLoading() ? 'w-4 h-4 animate-spin' : 'w-4 h-4'"></lucide-angular>
        </button>
      </div>

      @if (isLoading()) {
        <div class="px-6 py-12 text-center">
          <lucide-angular name="Loader" class="mx-auto mb-2 w-7 h-7 animate-spin text-[#02ab74]"></lucide-angular>
          <p class="text-sm text-gray-500">{{ 'dashboard.activity.loading' | translate }}</p>
        </div>
      } @else if (interactions().length === 0) {
        <div class="px-6 py-12 text-center">
          <lucide-angular name="Inbox" class="mx-auto mb-2 w-10 h-10 text-gray-300"></lucide-angular>
          <p class="text-sm text-gray-500">{{ 'dashboard.activity.empty' | translate }}</p>
        </div>
      } @else {
        <!-- Escritorio -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th class="px-6 py-3 font-medium">{{ 'dashboard.activity.cols.user' | translate }}</th>
                <th class="px-6 py-3 font-medium">{{ 'dashboard.activity.cols.question' | translate }}</th>
                <th class="px-6 py-3 font-medium">{{ 'dashboard.activity.cols.channel' | translate }}</th>
                <th class="px-6 py-3 font-medium">{{ 'dashboard.activity.cols.status' | translate }}</th>
                <th class="px-6 py-3 font-medium text-right">{{ 'dashboard.activity.cols.date' | translate }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (interaction of paginated(); track interaction.id) {
                <tr class="transition-colors hover:bg-gray-50/70">
                  <td class="px-6 py-3.5 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                      <ng-container *ngTemplateOutlet="avatar; context: { $implicit: interaction }"></ng-container>
                      <span class="font-medium text-[#070025]">{{ interaction.user_name }}</span>
                    </div>
                  </td>
                  <td class="px-6 py-3.5 max-w-md">
                    <span class="line-clamp-2 text-gray-700" [title]="interaction.question">{{ interaction.question }}</span>
                  </td>
                  <td class="px-6 py-3.5 whitespace-nowrap">
                    <span [class]="'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ' + getChannelBadgeClass(interaction.channel)">
                      <lucide-angular [name]="getChannelIcon(interaction.channel)" class="w-3.5 h-3.5"></lucide-angular>
                      {{ channelKey(interaction.channel) | translate }}
                    </span>
                  </td>
                  <td class="px-6 py-3.5 whitespace-nowrap">
                    <span [class]="'rounded-full px-2.5 py-0.5 text-xs font-medium ' + getStatusBadgeClass(interaction.status)">
                      {{ statusKey(interaction.status) | translate }}
                    </span>
                  </td>
                  <td class="px-6 py-3.5 whitespace-nowrap text-right">
                    <div class="text-gray-700">{{ formatDate(interaction.timestamp) }}</div>
                    <div class="text-xs text-gray-400">{{ formatTime(interaction.timestamp) }}</div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Móvil -->
        <ul class="md:hidden divide-y divide-gray-100">
          @for (interaction of paginated(); track interaction.id) {
            <li class="flex items-start gap-3 px-4 py-4">
              <ng-container *ngTemplateOutlet="avatar; context: { $implicit: interaction }"></ng-container>
              <div class="min-w-0 flex-1">
                <div class="mb-1 flex items-center justify-between gap-2">
                  <span class="truncate font-medium text-[#070025]">{{ interaction.user_name }}</span>
                  <span class="whitespace-nowrap text-xs text-gray-400">{{ formatDate(interaction.timestamp) }} · {{ formatTime(interaction.timestamp) }}</span>
                </div>
                <p class="mb-2 line-clamp-2 text-sm text-gray-700">{{ interaction.question }}</p>
                <div class="flex flex-wrap items-center gap-2">
                  <span [class]="'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ' + getChannelBadgeClass(interaction.channel)">
                    <lucide-angular [name]="getChannelIcon(interaction.channel)" class="w-3.5 h-3.5"></lucide-angular>
                    {{ channelKey(interaction.channel) | translate }}
                  </span>
                  <span [class]="'rounded-full px-2.5 py-0.5 text-xs font-medium ' + getStatusBadgeClass(interaction.status)">
                    {{ statusKey(interaction.status) | translate }}
                  </span>
                </div>
              </div>
            </li>
          }
        </ul>

        <!-- Paginación -->
        <div class="flex items-center justify-between gap-4 border-t border-gray-100 px-5 py-3 sm:px-6">
          <p class="text-sm text-gray-500">
            {{ 'dashboard.activity.range' | translate: { start: pageStart(), end: pageEnd(), total: interactions().length } }}
          </p>
          <div class="flex gap-2">
            <button type="button" (click)="changePage(currentPage() - 1)" [disabled]="currentPage() === 1"
              [attr.aria-label]="'dashboard.activity.prev' | translate"
              class="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent">
              <lucide-angular name="ChevronLeft" class="w-4 h-4"></lucide-angular>
            </button>
            <button type="button" (click)="changePage(currentPage() + 1)" [disabled]="currentPage() >= totalPages()"
              [attr.aria-label]="'dashboard.activity.next' | translate"
              class="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent">
              <lucide-angular name="ChevronRight" class="w-4 h-4"></lucide-angular>
            </button>
          </div>
        </div>
      }
    </section>

    <ng-template #avatar let-interaction>
      @if (getUserById(interaction.user_id); as user) {
        <app-profile-avatar [size]="2.25" [showEditControls]="false" [userData]="user" [userPhotoUrl]="user.profile_photo_url">
        </app-profile-avatar>
      } @else {
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style="background: linear-gradient(to bottom right, #02ab74, #7209b7);">
          {{ getUserInitials(interaction.user_name) }}
        </div>
      }
    </ng-template>
  `,
})
export class RecentActivitiesComponent {
  private translate = inject(TranslateService);

  interactions = input<AIInteractionLog[]>([]);
  isAdmin = input<boolean>(false);
  isLoading = input<boolean>(false);
  usersList = input<UserExtended[]>([]);

  refresh = output<void>();

  currentPage = signal(1);
  readonly itemsPerPage = 6;

  constructor() {
    // Nueva lista: volver a la primera página.
    effect(() => {
      this.interactions();
      this.currentPage.set(1);
    });
  }

  paginated = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    return this.interactions().slice(start, start + this.itemsPerPage);
  });

  totalPages = computed(() => Math.ceil(this.interactions().length / this.itemsPerPage) || 1);

  pageStart = computed(() =>
    this.interactions().length === 0 ? 0 : (this.currentPage() - 1) * this.itemsPerPage + 1
  );

  pageEnd = computed(() => Math.min(this.currentPage() * this.itemsPerPage, this.interactions().length));

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

  channelKey(channel: string): string {
    return `dashboard.activity.channel.${channel === AIChannel.VOICE ? 'voice' : 'text'}`;
  }

  statusKey(status: string): string {
    const known = Object.values(AIInteractionStatus) as string[];
    return `dashboard.activity.status.${known.includes(status) ? status : 'unknown'}`;
  }

  getChannelBadgeClass(channel: string): string {
    return channel === AIChannel.VOICE
      ? 'text-purple-700 bg-purple-50 border border-purple-100'
      : 'text-blue-700 bg-blue-50 border border-blue-100';
  }

  getStatusBadgeClass(status: string): string {
    return getStatusBadgeClass(status);
  }

  private get locale(): string {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'es';
    return lang.startsWith('en') ? 'en-US' : 'es-ES';
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatTime(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString(this.locale, { hour: '2-digit', minute: '2-digit' });
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @angular-eslint/prefer-inject */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertConfig, AlertService } from '@shared/components/alert/alert.service';
import { LucideAngularModule } from 'lucide-angular';
import { Observable, Subject, takeUntil } from 'rxjs';
import { UserService } from 'src/app/services/api/user-service';
import { DocumentService } from '../../services/api/document.service';
import { DocumentWithMetadata, UserExtended } from 'src/app/domain/models/document.model';
import { UserRole, User } from 'src/app/domain/models/user.model';
import { ProfileAvatar } from '@shared/components/profile-avatar/profile-avatar';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

/**
 * Componente de administración de usuarios.
 * Soporta: listado, filtrado, cambio de rol, activación/desactivación,
 * eliminación, visualización de documentos, estadísticas y paginación.
 */
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ProfileAvatar, TranslateModule],
  templateUrl: './users.html',
  styleUrl: './users.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Users implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ==================== FILTROS DE BÚSQUEDA ====================
  private _searchQuery = '';
  get searchQuery() { return this._searchQuery; }
  set searchQuery(v: string) { this._searchQuery = v; this.currentPage = 1; }

  private _roleFilter: 'all' | UserRole = 'all';
  get roleFilter() { return this._roleFilter; }
  set roleFilter(v: 'all' | UserRole) { this._roleFilter = v; this.currentPage = 1; }

  private _statusFilter: 'all' | 'active' | 'inactive' = 'all';
  get statusFilter() { return this._statusFilter; }
  set statusFilter(v: 'all' | 'active' | 'inactive') { this._statusFilter = v; this.currentPage = 1; }

  UserRole = UserRole;

  // ==================== PAGINACIÓN ====================
  readonly pageSize = 8;
  currentPage = 1;

  // ==================== ESTADO DE UI ====================
  selectedUser: UserExtended | null = null;
  userToDelete: UserExtended | null = null;
  viewedDocuments = new Set<number>();
  showDocumentsDialog = false;
  showDeleteDialog = false;
  openMenuId: number | null = null;

  // Coordenadas del menú flotante (position: fixed)
  menuPosition = { top: 0, left: 0, openUpward: false };
  private readonly menuHeight = 180;
  private readonly menuWidth = 208;

  // ==================== DATOS ====================
  users: UserExtended[] = [];
  isLoading = false;

  // ==================== SERVICIOS ====================
  private documentService = inject(DocumentService);
  private alertService = inject(AlertService);
  private userService = inject(UserService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);

  constructor() { }

  // ==================== CICLO DE VIDA ====================

  ngOnInit(): void {
    this.loadUsers();
    window.addEventListener('scroll', this.onScrollClose, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScrollClose, true);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private onScrollClose = (): void => {
    if (this.openMenuId !== null) {
      this.closeMenu();
    }
  };

  // ==================== CARGA DE DATOS ====================

  loadUsers(): void {
    this.isLoading = true;

    this.userService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users: User[]) => {
          this.users = users.map(user => this.convertToUserExtended(user));
          this.isLoading = false;
          this.cdr.markForCheck();
          this.loadUserDocuments();
        },
        error: () => {
          this.alertService.error(this.translate.instant('users.alerts.error'), this.translate.instant('users.alerts.loadErrorDesc'), 5000);
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private convertToUserExtended(user: User): UserExtended {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      created_at: user.created_at || new Date().toISOString(),
      last_login: null,
      is_active: user.is_active ?? true,
      documentsCount: 0,
      lastActivity: this.translate.instant('users.status.noActivity'),
      documents: [],
      profile_photo_url: (user as any).profile_photo_url || null
    };
  }

  private loadUserDocuments(): void {
    this.documentService.getAllDocumentsMetadata(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (documents: DocumentWithMetadata[]) => {
          this.users = this.users.map(user => {
            const userDocs = documents.filter(doc => doc.user_id === user.id);
            const lastActivity = userDocs.length > 0
              ? this.formatLastActivity(userDocs.reduce((latest, current) =>
                new Date(current.upload_date) > new Date(latest.upload_date) ? current : latest
              ).upload_date)
              : this.translate.instant('users.status.noActivity');

            return { ...user, documents: userDocs, documentsCount: userDocs.length, lastActivity };
          });
          this.cdr.markForCheck();
        },
        error: () => { /* Silencioso */ }
      });
  }

  // ==================== FORMATEO DE TIEMPO ====================

  private pluralize(value: number, singular: string): string {
    return `${value} ${singular}${value !== 1 ? 's' : ''}`;
  }

  private formatLastActivity(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return this.translate.instant('users.time.justNow');
    if (diffMins < 60) return `${this.translate.instant('users.time.ago')} ${this.pluralize(diffMins, this.translate.instant('users.time.minute'))}`;
    if (diffHours < 24) return `${this.translate.instant('users.time.ago')} ${this.pluralize(diffHours, this.translate.instant('users.time.hour'))}`;
    if (diffDays === 1) return this.translate.instant('users.time.yesterday');
    if (diffDays < 30) return `${this.translate.instant('users.time.ago')} ${this.pluralize(diffDays, this.translate.instant('users.time.day'))}`;

    return date.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  // ==================== FILTRADO DINÁMICO ====================

  get filteredUsers(): UserExtended[] {
    return this.users.filter(user => {
      const matchesSearch =
        user.name.toLowerCase().includes(this._searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(this._searchQuery.toLowerCase());

      const matchesRole = this._roleFilter === 'all' || user.role === this._roleFilter;
      const matchesStatus =
        this._statusFilter === 'all' ||
        (this._statusFilter === 'active' && user.is_active) ||
        (this._statusFilter === 'inactive' && !user.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  // ==================== PAGINACIÓN ====================

  get paginatedUsers(): UserExtended[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
  }

  get pageStart(): number {
    return this.filteredUsers.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredUsers.length);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.closeMenu();
    this.cdr.markForCheck();
  }

  // ==================== ESTADÍSTICAS ====================

  get stats() {
    return [
      { label: this.translate.instant('users.stats.total'), value: this.users.length, icon: 'User', color: 'bg-blue-500' },
      { label: this.translate.instant('users.stats.active'), value: this.users.filter(u => u.is_active).length, icon: 'UserCheck', color: 'bg-[#02ab74]' },
      { label: this.translate.instant('users.stats.inactive'), value: this.users.filter(u => !u.is_active).length, icon: 'UserX', color: 'bg-orange-500' },
      { label: this.translate.instant('users.stats.admins'), value: this.users.filter(u => u.role === 'admin').length, icon: 'Shield', color: 'bg-[#7209b7]' }
    ];
  }

  // ==================== ACCIONES DE USUARIO ====================

  handleChangeRole(userId: number, newRole: UserRole): void {
    this.userService.updateUserRole(userId, { new_role: newRole })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedUser) => {
          const index = this.users.findIndex(u => u.id === userId);
          if (index !== -1) {
            this.users[index] = { ...this.users[index], role: updatedUser.new_role as UserRole };
          }
          this.alertService.success(this.translate.instant('users.alerts.roleUpdated', { name: this.users[index].name, role: this.getRoleLabel(updatedUser.new_role) }), '', 3000);
          this.cdr.markForCheck();
        },
        error: () => {
          const user = this.users.find(u => u.id === userId);
          this.alertService.error(this.translate.instant('users.alerts.error'), this.translate.instant('users.alerts.roleErrorDesc', { name: user?.name || 'Usuario' }), 3000);
          this.loadUsers();
        }
      });
  }

  handleToggleStatus(userId: number): void {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    const newStatus = !user.is_active;
    const update$ = newStatus
      ? this.userService.activateUser(userId)
      : this.userService.deactivateUser(userId);

    update$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.users = this.users.map(u =>
            u.id === userId ? { ...u, is_active: newStatus } : u
          );
          this.alertService[newStatus ? 'success' : 'warning'](
            newStatus ? this.translate.instant('users.alerts.userActivated', { name: user.name }) : this.translate.instant('users.alerts.userDeactivated', { name: user.name }), '', 3000
          );
          this.cdr.markForCheck();
        },
        error: () => {
          this.alertService.error(this.translate.instant('users.alerts.error'), this.translate.instant('users.alerts.statusErrorDesc'), 3000);
        }
      });
  }

  handleViewDocuments(user: UserExtended): void {
    this.selectedUser = user;
    this.showDocumentsDialog = true;
  }

  openDeleteDialog(user: UserExtended): void {
    this.userToDelete = user;
    this.showDeleteDialog = true;
  }

  handleDeleteUser(): void {
    if (!this.userToDelete) return;

    this.userService.deleteUser(this.userToDelete.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.users = this.users.filter(u => u.id !== this.userToDelete!.id);
          this.alertService.success(this.translate.instant('users.alerts.deletedTitle'), this.translate.instant('users.alerts.deletedDesc', { name: this.userToDelete?.name }), 3000);
          this.userToDelete = null;
          this.showDeleteDialog = false;

          if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages;
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.alertService.error(this.translate.instant('users.alerts.error'), this.translate.instant('users.alerts.deleteErrorDesc', { name: this.userToDelete?.name }), 5000);
          this.showDeleteDialog = false;
        }
      });
  }

  // ==================== UI Y ESTILOS ====================

  /** Abre/cierra el menú de acciones con posicionamiento dinámico (fixed) */
  toggleMenu(userId: number, event?: MouseEvent): void {
    if (this.openMenuId === userId) {
      this.openMenuId = null;
      this.cdr.markForCheck();
      return;
    }

    this.openMenuId = userId;

    if (event) {
      const btn = event.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < this.menuHeight + 16;

      // Clamp horizontal: nunca sale del viewport
      let left = rect.right - this.menuWidth;
      if (left < 8) left = 8;
      if (left + this.menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - this.menuWidth - 8;
      }

      // Clamp vertical
      let top = openUpward ? rect.top - this.menuHeight - 8 : rect.bottom + 8;
      if (top < 8) top = 8;
      if (top + this.menuHeight > window.innerHeight - 8) {
        top = window.innerHeight - this.menuHeight - 8;
      }

      this.menuPosition = { top, left, openUpward };
    }
    this.cdr.markForCheck();
  }

  closeMenu(): void {
    this.openMenuId = null;
    this.cdr.markForCheck();
  }

  /** Devuelve el usuario del menú abierto */
  get openMenuUser(): UserExtended | null {
    if (this.openMenuId === null) return null;
    return this.paginatedUsers.find(u => u.id === this.openMenuId) ?? null;
  }

  getDefaultIcon(type: string): string {
    const icons: Record<string, string> = {
      success: 'CheckCircle', error: 'XCircle', warning: 'AlertTriangle', info: 'Info'
    };
    return icons[type] || 'Info';
  }

  getUserInitials(name: string): string {
    if (!name) return '??';
    const names = name.split(' ');
    return names.length >= 2
      ? (names[0][0] + names[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  }

  /** Clases CSS tipo Badge para el rol (estilo React) */
  getRoleBadgeClasses(role: string): string {
    const map: Record<string, string> = {
      admin: 'bg-[#7209b7] text-white hover:bg-[#5f0899] focus:ring-[#7209b7]',
      user: 'bg-[#02ab74] text-white hover:bg-[#028a5f] focus:ring-[#02ab74]',
      editor: 'bg-blue-100 text-blue-700 hover:bg-blue-200 focus:ring-blue-400'
    };
    return map[role] || 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400';
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      admin: this.translate.instant('users.filters.admin'),
      user: this.translate.instant('users.filters.user'),
      editor: this.translate.instant('users.filters.editor')
    };
    return labels[role] || 'Desconocido';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  viewDocument(doc: DocumentWithMetadata): void {
    this.documentService.downloadDocument(+doc.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
          this.viewedDocuments.add(+doc.id);
        },
        error: () => {
          this.alertService.error(this.translate.instant('users.alerts.viewDocErrorTitle'), '');
        }
      });
  }
}
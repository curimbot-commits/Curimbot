/* eslint-disable @typescript-eslint/no-explicit-any*/

import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild, SecurityContext } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { AtheniaService, ConversationMessage, AtheniaQueryRequest, AtheniaResponse } from 'src/app/services/api/athenia.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-athenia-chat',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, TranslateModule],
  templateUrl: './athenia-chat.html',
  styleUrl: './athenia-chat.css'
})
export class AtheniaChat implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('questionInput') questionInput!: ElementRef;

  private atheniaService = inject(AtheniaService);
  private translate = inject(TranslateService);
  private destroy$ = new Subject<void>();

  messages: ConversationMessage[] = [];
  question = '';
  isLoading = false;
  isVisible = false;
  currentConversationId?: number;

  // Estadísticas
  atheniaStatus: any = {
    is_ready: true,  
    documents_indexed: 0,
    cache_size: 0
  };

  ngOnInit(): void {
    this.loadStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Abrir/cerrar modal
  **/
  toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      setTimeout(() => this.questionInput?.nativeElement.focus(), 100);
    }
  }

  /**
   * Cargar estado de ATHENIA
  **/
  loadStatus(): void {
    this.atheniaService.getStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.atheniaStatus = status;
        },
        error: () => {
          // El usuario verá un mensaje si no hay documentos
          this.atheniaStatus = {
            is_ready: true,
            documents_indexed: 0,
            cache_size: 0
          };
        }
      });
  }

  /**
   * Enviar pregunta
  **/
  sendQuestion(): void {
    if (!this.question.trim()) return;
    // Permitir enviar aunque no haya status
    const userMessage: ConversationMessage = {
      id: Date.now(),
      role: 'user',
      content: this.question,
      timestamp: new Date().toISOString()
    };
    this.messages.push(userMessage);

    const questionText = this.question;
    this.question = '';
    this.isLoading = true;

    // Preparar request
    const request: AtheniaQueryRequest = {
      question: questionText,
      use_cache: true
    };

    // Llamar a ATHENIA
    this.atheniaService.askQuestion(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: AtheniaResponse) => {
          const assistantMessage: ConversationMessage = {
            id: response.conversation_id,
            role: 'assistant',
            content: response.answer,
            timestamp: new Date().toISOString(),
            sources: response.sources,
            confidence: response.confidence,
            from_cache: response.from_cache
          };

          this.messages.push(assistantMessage);
          this.currentConversationId = response.conversation_id;
          this.isLoading = false;

          setTimeout(() => this.scrollToBottom(), 100);
        },
        error: () => {
          // Mostrar mensaje de error en el chat
          const errorMessage: ConversationMessage = {
            id: Date.now(),
            role: 'assistant',
            content: this.translate.instant('chat.errorMessage'),
            timestamp: new Date().toISOString()
          };
          this.messages.push(errorMessage);

          this.isLoading = false;
          setTimeout(() => this.scrollToBottom(), 100);
        }
      });
  }


  /**
   * Scroll al final del chat
  **/
  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  /**
   * Formatea contenido Markdown básico a HTML
   * Angular sanitiza automáticamente cuando se usa [innerHTML]
  **/
  formatContent(content: string): string {
    if (!content) return '';
    
    // Escapar HTML básico para seguridad inicial y visualizar tags
    let html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Negritas: **texto** or __texto__
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Itálica: *texto* or _texto_
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    // Listas: - item or * item
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gms, '<ul class="list-disc ml-4 my-2">$1</ul>');

    // Saltos de línea
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  /**
   * Manejar Enter para enviar
  **/
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendQuestion();
    }
  }
}
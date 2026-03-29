/* eslint-disable @typescript-eslint/no-explicit-any*/

import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { AtheniaService, ConversationMessage, AtheniaQueryRequest, AtheniaResponse } from 'src/app/services/api/athenia.service';
import { DocumentService } from 'src/app/services/api/document.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

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
  private documentService = inject(DocumentService);
  private translate = inject(TranslateService);
  private sanitizer = inject(DomSanitizer);
  private destroy$ = new Subject<void>();

  messages: ConversationMessage[] = [];
  question = '';
  isLoading = false;
  isVisible = false;
  currentConversationId?: number;

  // Sugerencias actualizadas
  suggestions = [
    { key: 'chat.suggestions.summary', query: '¿Me puedes dar un resumen de mis documentos?' },
    { key: 'chat.suggestions.uninsurable', query: '¿Cuáles son los riesgos no asegurables?' },
    { key: 'chat.suggestions.claim', query: '¿Cómo realizar un reclamo?' }
  ];

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
   * Se usa DomSanitizer para permitir que las clases de Tailwind funcionen
  **/
  formatContent(content: string): SafeHtml {
    if (!content) return '';

    // 1. Escapar HTML básico
    let html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Bloques de código (antes de cualquier otra transformación)
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 rounded-lg p-3 my-2 text-xs overflow-x-auto font-mono"><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-[#02ab74]">$1</code>');

    // 3. Encabezados
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-[#070025] mt-3 mb-1">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-[#070025] mt-4 mb-1.5 border-b border-gray-100 pb-1">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-[#070025] mt-4 mb-2">$1</h1>');

    // 4. Negritas e itálicas (en orden: primero ** para no interferir con *)
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_\n]+?)_/g, '<em>$1</em>');

    // 5. Listas con soporte para anidación (2 niveles)
    // Primero procesamos las listas: separamos bloques de lista del resto del texto
    const lines = html.split('\n');
    const result: string[] = [];
    let inList = false;
    let inSubList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isSubItem = /^\s{2,}[-*]\s+(.+)$/.exec(line);
      const isItem    = /^\s*[-*]\s+(.+)$/.exec(line);

      if (isSubItem) {
        if (!inSubList) { result.push('<ul class="list-disc ml-8 my-1 space-y-0.5">'); inSubList = true; }
        result.push(`<li class="text-sm leading-relaxed">${isSubItem[1]}</li>`);
      } else if (isItem) {
        if (inSubList) { result.push('</ul>'); inSubList = false; }
        if (!inList) { result.push('<ul class="list-disc ml-5 my-2 space-y-1">'); inList = true; }
        result.push(`<li class="text-sm leading-relaxed">${isItem[1]}</li>`);
      } else {
        if (inSubList) { result.push('</ul>'); inSubList = false; }
        if (inList)    { result.push('</ul>'); inList = false; }
        result.push(line);
      }
    }
    if (inSubList) result.push('</ul>');
    if (inList)    result.push('</ul>');

    html = result.join('\n');

    // 6. Saltos de línea: solo los que estén fuera de tags HTML
    html = html.replace(/\n(?!<[/]?(ul|ol|li|h1|h2|h3|pre|code))/g, '<br>');
    // Limpiar <br> redundantes justo antes/después de listas y encabezados
    html = html.replace(/<br>(<\/?(?:ul|ol|li|h[123]|pre))/g, '$1');
    html = html.replace(/(<\/(?:ul|ol|li|h[123]|pre)>)<br>/g, '$1');

    return this.sanitizer.bypassSecurityTrustHtml(html);
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

  /**
   * Abre o descarga un documento fuente
  **/
  viewSource(docId: number): void {
    this.documentService.downloadDocument(docId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          // Intentar determinar el tipo MIME si es posible (por defecto usamos PDF para visor si el backend no lo da)
          // Nota: El backend suele devolver el blob con el tipo correcto si está configurado.
          // Si no, podemos intentar obtener el metadato primero, pero para velocidad abrimos el blob directamente.
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
          
          // Liberar memoria después de un tiempo
          setTimeout(() => window.URL.revokeObjectURL(url), 10000);
        },
        error: () => {
          // Si falla, podríamos mostrar una alerta, pero por simplicidad logueamos
          console.error('Error al abrir el documento fuente');
        }
      });
  }
}
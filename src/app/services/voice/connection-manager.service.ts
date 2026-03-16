import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import {
  ConnectionState,
  ConnectionStatus,
  INITIAL_CONNECTION_STATE,
} from './connection-state';

export interface RawSocketMessage {
  data: string | ArrayBuffer;
}

@Injectable({ providedIn: 'root' })
export class ConnectionManagerService implements OnDestroy {
  private socket: WebSocket | null = null;

  private connectionState$ = new BehaviorSubject<ConnectionState>(
    INITIAL_CONNECTION_STATE
  );

  private incomingMessages$ = new Subject<RawSocketMessage>();

  // Configuración de reconexión con backoff exponencial
  private readonly MAX_RETRIES = 5;
  private readonly BASE_RETRY_DELAY_MS = 1000;
  private readonly MAX_RETRY_DELAY_MS = 30000;
  private readonly CONNECT_TIMEOUT_MS = 8000;

  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  // Promesa que resuelve cuando el socket abre, para await externo
  private connectResolver: (() => void) | null = null;
  private connectRejecter: ((reason: Error) => void) | null = null;

  // Indica si debe reconectar cuando se cierre inesperadamente
  private persistConnection = false;

  public readonly state$: Observable<ConnectionState> =
    this.connectionState$.asObservable();

  public readonly messages$: Observable<RawSocketMessage> =
    this.incomingMessages$.asObservable();

  constructor(private ngZone: NgZone) {}

  /**
   * Conecta al WebSocket. Retorna una Promise que resuelve cuando el socket
   * está en estado OPEN o rechaza si no logra conectar en el timeout.
   */
  connect(url: string): Promise<void> {
    const currentStatus = this.connectionState$.value.status;

    if (currentStatus === 'CONNECTED') {
      return Promise.resolve();
    }

    if (currentStatus === 'CONNECTING' || currentStatus === 'RECONNECTING') {
      // Ya hay un intento en curso — esperar a que resuelva
      return new Promise<void>((resolve, reject) => {
        this.connectionState$
          .pipe(
            filter(
              (s) => s.status === 'CONNECTED' || s.status === 'FAILED'
            ),
            take(1)
          )
          .subscribe((s) => {
            if (s.status === 'CONNECTED') resolve();
            else reject(new Error(s.lastError ?? 'Connection failed'));
          });
      });
    }

    this.persistConnection = true;
    return this.attemptConnect(url);
  }

  /**
   * Cierra el WebSocket de forma limpia y definitiva.
   * No reconectará después.
   */
  disconnect(): void {
    this.persistConnection = false;
    this.clearRetryTimer();
    this.clearConnectTimeout();
    this.closeSocket(1000, 'Client requested disconnect');
    this.transitionTo('DISCONNECTED', 0, null);
  }

  /**
   * Envía un mensaje de texto por el WebSocket.
   * Lanza error si el socket no está abierto.
   */
  sendText(data: string): void {
    this.assertOpen();
    this.socket!.send(data);
  }

  /**
   * Envía datos binarios por el WebSocket.
   */
  sendBinary(data: ArrayBuffer | ArrayBufferView): void {
    this.assertOpen();
    this.socket!.send(data);
  }

  get isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  get currentState(): ConnectionState {
    return this.connectionState$.value;
  }

  // ─────────────────────────────────────────────
  // Implementación privada
  // ─────────────────────────────────────────────

  private attemptConnect(url: string, isRetry = false): Promise<void> {
    const retryCount = this.connectionState$.value.retryCount;

    this.transitionTo(
      isRetry ? 'RECONNECTING' : 'CONNECTING',
      isRetry ? retryCount : 0,
      null
    );

    return new Promise<void>((resolve, reject) => {
      this.connectResolver = resolve;
      this.connectRejecter = reject;

      this.connectTimeoutTimer = setTimeout(() => {
        if (this.connectionState$.value.status !== 'CONNECTED') {
          this.handleConnectFailure(
            url,
            new Error(`Connection timeout after ${this.CONNECT_TIMEOUT_MS}ms`)
          );
          reject(new Error('Connection timeout'));
        }
      }, this.CONNECT_TIMEOUT_MS);

      try {
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
          this.ngZone.run(() => {
            this.clearConnectTimeout();
            this.transitionTo('CONNECTED', 0, null);
            this.connectResolver?.();
            this.connectResolver = null;
            this.connectRejecter = null;
          });
        };

        this.socket.onmessage = (event: MessageEvent) => {
          this.ngZone.run(() => {
            this.incomingMessages$.next({ data: event.data });
          });
        };

        this.socket.onerror = () => {
          this.ngZone.run(() => {
            // onerror siempre va seguido de onclose — manejar en onclose
          });
        };

        this.socket.onclose = (event: CloseEvent) => {
          this.ngZone.run(() => {
            this.clearConnectTimeout();
            const wasConnected =
              this.connectionState$.value.status === 'CONNECTED';
            const errorMsg = event.reason || `Code ${event.code}`;

            if (this.persistConnection && !event.wasClean) {
              // Cierre inesperado — intentar reconectar
              this.scheduleRetry(url);
            } else {
              const nextStatus: ConnectionStatus =
                this.persistConnection ? 'FAILED' : 'DISCONNECTED';
              this.transitionTo(
                nextStatus,
                this.connectionState$.value.retryCount,
                wasConnected ? null : errorMsg
              );

              if (!wasConnected) {
                this.connectRejecter?.(new Error(errorMsg));
                this.connectRejecter = null;
                this.connectResolver = null;
              }
            }
          });
        };
      } catch (error) {
        this.clearConnectTimeout();
        const err = error instanceof Error ? error : new Error(String(error));
        this.handleConnectFailure(url, err);
        reject(err);
      }
    });
  }

  private scheduleRetry(url: string): void {
    const currentRetry = this.connectionState$.value.retryCount;

    if (currentRetry >= this.MAX_RETRIES) {
      this.transitionTo('FAILED', currentRetry, 'Max retries exceeded');
      this.persistConnection = false;
      return;
    }

    // Backoff exponencial con jitter
    const delay = Math.min(
      this.BASE_RETRY_DELAY_MS * Math.pow(2, currentRetry) +
        Math.random() * 500,
      this.MAX_RETRY_DELAY_MS
    );

    this.transitionTo('RECONNECTING', currentRetry + 1, null);

    this.retryTimer = setTimeout(() => {
      this.attemptConnect(url, true).catch(() => {
        // La próxima iteración de scheduleRetry lo manejará
      });
    }, delay);
  }

  private handleConnectFailure(url: string, error: Error): void {
    const retryCount = this.connectionState$.value.retryCount;
    if (this.persistConnection && retryCount < this.MAX_RETRIES) {
      this.scheduleRetry(url);
    } else {
      this.transitionTo('FAILED', retryCount, error.message);
    }
  }

  private transitionTo(
    status: ConnectionStatus,
    retryCount: number,
    lastError: string | null
  ): void {
    this.connectionState$.next({ status, retryCount, lastError });
  }

  private closeSocket(code: number, reason: string): void {
    if (this.socket) {
      try {
        if (
          this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING
        ) {
          this.socket.close(code, reason);
        }
      } catch {}
      this.socket = null;
    }
  }

  private assertOpen(): void {
    if (!this.isOpen) {
      throw new Error(
        `Cannot send: WebSocket is not open (state: ${this.connectionState$.value.status})`
      );
    }
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private clearConnectTimeout(): void {
    if (this.connectTimeoutTimer !== null) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.incomingMessages$.complete();
    this.connectionState$.complete();
  }
}
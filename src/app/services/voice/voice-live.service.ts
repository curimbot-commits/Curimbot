import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

export type ConnectionStatus =
  | 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'FAILED';

export interface LiveVoiceState {
  status: ConnectionStatus;
  isListening: boolean;
  isSpeaking: boolean;
  error: string | null;
  audioLevel: number;
}

interface VoiceSource { document_id: number; filename: string; }

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const INITIAL_STATE: LiveVoiceState = {
  status: 'DISCONNECTED', isListening: false,
  isSpeaking: false, error: null, audioLevel: 0,
};

// Endpoint "Constrained": acepta tokens efímeros emitidos por el backend
// (/api/v1/voice/token). La API key real de Gemini nunca llega al navegador.
const GEMINI_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
// Respaldo si el backend no envía el modelo. El modelo real lo decide el
// backend (GEMINI_LIVE_MODEL) y llega con el token: el token solo permite ese.
const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

const BASE_SYSTEM = `Eres Curim, un asistente de voz inteligente especializado en documentos.

REGLA CRÍTICA DE IDIOMA:
Responde OBLIGATORIAMENTE en el mismo idioma en el que el usuario te hable.
1. Si el usuario habla en Inglés, responde 100% en Inglés.
2. Si el usuario habla en Español, responde 100% en Español.
No mezcles idiomas en una misma respuesta.

REGLAS PARA PREGUNTAS SOBRE DOCUMENTOS:
1. Si el usuario pregunta por información concreta (normas, datos, procesos, contenido de sus documentos), llama a la herramienta buscar_documentos con la pregunta completa y clara. No respondas de memoria.
2. Llama a la herramienta directamente, sin anunciarlo: no digas "buscando" ni frases de espera.
3. Cuando recibas el resultado, responde UNA sola vez, de forma completa, fluida y precisa, usando solo esa información. El resultado suele estar en español: si el usuario habla en inglés, tradúcelo y responde en inglés.
4. Si el resultado indica que no hay información, dilo en una frase breve y ofrece reformular la pregunta. No inventes.
5. Si es un saludo o charla general, responde normalmente sin usar la herramienta.
6. No repitas una respuesta que ya diste.`;

/** Herramienta que Gemini Live llama para buscar en los documentos del usuario. */
const SEARCH_TOOL = {
  functionDeclarations: [{
    name: 'buscar_documentos',
    description:
      'Busca en los documentos del usuario y devuelve los fragmentos relevantes para responder su pregunta.',
    parameters: {
      type: 'OBJECT',
      properties: {
        consulta: {
          type: 'STRING',
          description: 'La pregunta del usuario, completa y en su idioma.',
        },
      },
      required: ['consulta'],
    },
  }],
};

const NO_RESULTS = 'No se encontró información sobre esto en los documentos del usuario.';

@Injectable({ providedIn: 'root' })
export class VoiceLiveService implements OnDestroy {
  /** Modelo de Gemini Live autorizado por el último token. */
  private liveModel = DEFAULT_MODEL;


  private stateSubject      = new BehaviorSubject<LiveVoiceState>(INITIAL_STATE);
  private transcriptSubject = new ReplaySubject<TranscriptEntry>(50);

  public readonly state$:      Observable<LiveVoiceState>  = this.stateSubject.asObservable();
  public readonly transcript$: Observable<TranscriptEntry> = this.transcriptSubject.asObservable();

  private ws:           WebSocket | null = null;
  private recordingCtx: AudioContext | null = null;
  private mediaStream:  MediaStream | null = null;
  private processor:    ScriptProcessorNode | null = null;
  private micSource:    MediaStreamAudioSourceNode | null = null;
  private playbackCtx:  AudioContext | null = null;
  private nextPlayTime  = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private rafId         = 0;
  private analyser:     AnalyserNode | null = null;
  private analyserData: Uint8Array | null = null;
  private smoothedLevel = 0;
  private intentActive  = false;
  private retryCount    = 0;
  private readonly MAX_RETRIES = 5;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Transcripción del usuario ─────────────────────────────
  // Lo que dice el usuario en el turno actual; se muestra en el transcript
  // cuando Gemini empieza a responder (o llama a la herramienta).
  private userTranscriptBuffer = '';
  /** Llamadas a herramientas que Gemini canceló (el usuario lo interrumpió). */
  private cancelledToolCalls = new Set<string>();

  constructor(private ngZone: NgZone, private http: HttpClient) {
    this.startLevelLoop();
  }

  // ─── API pública ───────────────────────────────────────────

  async start(): Promise<void> {
    if (this.intentActive) return;
    this.intentActive = true;
    this.retryCount   = 0;
    try {
      await this.openSession();
    } catch (err) {
      this.handleError((err as Error).message ?? 'Error al iniciar');
    }
  }

  stop(): void {
    this.intentActive = false;
    this.clearRetryTimer();
    this.closeSession();
    this.teardownAudio();
    this.patch({ status: 'DISCONNECTED', isListening: false, isSpeaking: false, error: null });
  }

  // ─── Token ─────────────────────────────────────────────────

  /**
   * Pide al backend un token efímero de un solo uso (válido 1 min para abrir
   * la sesión). Se llama en cada conexión y reconexión: un token ya usado
   * no sirve para reintentar.
   */
  private async fetchVoiceToken(): Promise<string> {
    const r = await firstValueFrom(
      this.http.get<{ token: string; expire_time: string; model?: string }>(`${environment.apiUrl}/api/v1/voice/token`)
    );
    if (!r?.token) throw new Error('No se pudo obtener el token de voz');
    this.liveModel = r.model || DEFAULT_MODEL;
    return r.token;
  }

  // ─── Transcripción del usuario ─────────────────────────────

  /**
   * inputTranscription puede llegar acumulada (cada mensaje trae la frase
   * completa hasta ese momento) o por fragmentos: si el texto nuevo empieza
   * por el anterior se reemplaza; si no, se añade.
   */
  private onUserTranscript(text: string): void {
    const prev = this.userTranscriptBuffer;
    this.userTranscriptBuffer = prev && text.startsWith(prev) ? text : prev + text;
  }

  /** Muestra en el transcript lo que dijo el usuario en este turno (una vez). */
  private flushUserTranscript(): void {
    const text = this.userTranscriptBuffer.trim();
    this.userTranscriptBuffer = '';
    if (text) this.transcriptSubject.next({ role: 'user', text, timestamp: new Date() });
  }

  // ─── RAG por function calling ──────────────────────────────

  /**
   * Gemini decide cuándo buscar: llama a buscar_documentos, espera la
   * respuesta y contesta una sola vez con el contexto. Así no hay frase de
   * espera sin respuesta ni respuesta nativa duplicada.
   */
  private async handleToolCall(toolCall: any): Promise<void> {
    this.flushUserTranscript();
    const calls: any[] = toolCall?.functionCalls ?? [];
    const responses = await Promise.all(calls.map(async (call) => {
      if (call.name !== 'buscar_documentos') {
        return { id: call.id, name: call.name, response: { error: 'Herramienta desconocida' } };
      }
      return { id: call.id, name: call.name, response: { result: await this.searchDocuments(call.args?.consulta) } };
    }));

    const pending = responses.filter(r => !this.cancelledToolCalls.has(r.id));
    responses.forEach(r => this.cancelledToolCalls.delete(r.id));
    if (!pending.length) return;
    this.wsSend(JSON.stringify({ toolResponse: { functionResponses: pending } }));
  }

  private async searchDocuments(query: unknown): Promise<string> {
    const q = typeof query === 'string' ? query.trim() : '';
    if (!q) return NO_RESULTS;
    try {
      const resp = await firstValueFrom(
        this.http.post<{ context: string | null; found: boolean; sources_info?: VoiceSource[] }>(
          `${environment.apiUrl}/api/v1/voice/context`,
          { query: q }
        )
      );
      return resp.found && resp.context ? resp.context : NO_RESULTS;
    } catch (err) {
      console.error('[RAG] Error buscando contexto:', err);
      return 'La búsqueda en los documentos falló. Pide al usuario que lo intente de nuevo.';
    }
  }

  // ─── WebSocket ─────────────────────────────────────────────

  private async openSession(): Promise<void> {
    this.patch({ status: 'CONNECTING', error: null });

    const token = await this.fetchVoiceToken();
    this.ws = new WebSocket(`${GEMINI_WS_URL}?access_token=${encodeURIComponent(token)}`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen    = () => this.ngZone.run(() => { this.retryCount = 0; this.sendSetup(); });
    this.ws.onmessage = (e) => this.ngZone.run(() => this.handleMessage(e.data));
    this.ws.onerror   = () => this.ngZone.run(() => this.handleError('Error de conexión con Gemini'));
    this.ws.onclose   = () => this.ngZone.run(() => {
      if (this.intentActive) this.scheduleRetry();
      else this.patch({ status: 'DISCONNECTED', isListening: false });
    });
  }

  private sendSetup(): void {
    this.wsSend(JSON.stringify({
      setup: {
        model: `models/${this.liveModel.replace('models/', '')}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        },
        systemInstruction: { parts: [{ text: BASE_SYSTEM }] },
        tools: [SEARCH_TOOL],
        inputAudioTranscription: {},   // transcripción de lo que dice el usuario
        outputAudioTranscription: {},  // transcripción de lo que responde Gemini
      },
    }));
  }

  private closeSession(): void {
    if (this.ws) { try { this.ws.close(1000); } catch {} this.ws = null; }
  }

  // ─── Mensajes Gemini ───────────────────────────────────────

  private handleMessage(raw: string | ArrayBuffer): void {
    let msg: any;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch { return; }

    if (msg.setupComplete !== undefined) { this.onReady(); return; }

    if (msg.toolCall) { this.handleToolCall(msg.toolCall); return; }

    if (msg.toolCallCancellation) {
      // El usuario interrumpió mientras se buscaba: no enviar esa respuesta.
      for (const id of msg.toolCallCancellation.ids ?? []) this.cancelledToolCalls.add(id);
      return;
    }

    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.interrupted) {
      // El usuario habló encima de la respuesta: cortar el audio en curso.
      this.stopAllSources(); this.nextPlayTime = 0;
      this.patch({ isSpeaking: false });
      return;
    }

    if (sc.turnComplete) {
      this.flushUserTranscript();
      this.patch({ isSpeaking: false, isListening: true });
      return;
    }

    // Audio de respuesta de Gemini
    for (const part of sc.modelTurn?.parts ?? []) {
      if (part.inlineData?.data && part.inlineData?.mimeType?.includes('audio')) {
        this.scheduleAudio(part.inlineData.data);
        this.patch({ isSpeaking: true });
      }
    }

    // Transcripción de lo que dice el usuario
    const inputText = sc.inputTranscription?.text;
    if (inputText?.trim()) {
      this.onUserTranscript(inputText);
    }

    // Transcripción de lo que dijo Gemini (texto de su respuesta en audio)
    const outputText = sc.outputTranscription?.text;
    if (outputText?.trim()) {
      this.flushUserTranscript();
      this.transcriptSubject.next({ role: 'assistant', text: outputText, timestamp: new Date() });
    }
  }

  private onReady(): void {
    this.patch({ status: 'CONNECTED', error: null });
    this.startMicrophone();
  }

  // ─── Micrófono ─────────────────────────────────────────────

  private async startMicrophone(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, sampleRate: 16000,
          echoCancellation: true, noiseSuppression: true, autoGainControl: true,
        },
      });

      this.recordingCtx = new AudioContext({ sampleRate: 16000 });
      this.micSource    = this.recordingCtx.createMediaStreamSource(this.mediaStream);
      this.processor    = this.recordingCtx.createScriptProcessor(256, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          int16[i] = s < 0 ? s * 32768 : s * 32767;
        }
        this.wsSend(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: this.toBase64(int16.buffer as ArrayBuffer) }],
          },
        }));
        this.updateInputLevel(int16);
      };

      this.micSource.connect(this.processor);
      const silent = this.recordingCtx.createGain();
      silent.gain.value = 0;
      this.processor.connect(silent);
      silent.connect(this.recordingCtx.destination);
      this.patch({ isListening: true });

    } catch {
      this.handleError('No se pudo acceder al micrófono');
    }
  }

  // ─── Reproducción ──────────────────────────────────────────

  private async scheduleAudio(base64: string): Promise<void> {
    try {
      const ctx     = await this.ensurePlayback();
      const int16   = new Int16Array(this.b64ToBuffer(base64));
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

      const buf = ctx.createBuffer(1, float32.length, 24000);
      buf.copyToChannel(float32, 0);

      const now = ctx.currentTime;
      if (this.nextPlayTime < now + 0.02) this.nextPlayTime = now + 0.02;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (this.analyser) { src.connect(this.analyser); this.analyser.connect(ctx.destination); }
      else src.connect(ctx.destination);

      src.start(this.nextPlayTime);
      this.nextPlayTime += buf.duration;
      this.activeSources.add(src);
      src.addEventListener('ended', () => {
        this.activeSources.delete(src);
        if (this.activeSources.size === 0)
          this.ngZone.run(() => this.patch({ isSpeaking: false }));
      });
    } catch {}
  }

  private async ensurePlayback(): Promise<AudioContext> {
    if (!this.playbackCtx || this.playbackCtx.state === 'closed') {
      this.playbackCtx  = new AudioContext({ sampleRate: 24000 });
      this.analyser     = this.playbackCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.85;
      this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.playbackCtx.state === 'suspended') await this.playbackCtx.resume();
    return this.playbackCtx;
  }

  private stopAllSources(): void {
    this.activeSources.forEach(s => { try { s.stop(); } catch {} });
    this.activeSources.clear();
  }

  // ─── Nivel ─────────────────────────────────────────────────

  private startLevelLoop(): void {
    const tick = () => {
      if (this.analyser && this.analyserData) {
        this.analyser.getByteFrequencyData(this.analyserData as any);
        const bins = Math.min(64, this.analyserData.length);
        let sum = 0; for (let i = 0; i < bins; i++) sum += this.analyserData[i];
        const raw = Math.min(1, (sum / (bins * 255)) * 2.5);
        this.smoothedLevel = raw > this.smoothedLevel
          ? this.smoothedLevel + (raw - this.smoothedLevel) * 0.35
          : this.smoothedLevel + (raw - this.smoothedLevel) * 0.12;
      } else {
        this.smoothedLevel += (0 - this.smoothedLevel) * 0.08;
      }
      if (Math.abs(this.smoothedLevel - this.stateSubject.value.audioLevel) > 0.005)
        this.ngZone.run(() => this.patch({ audioLevel: this.smoothedLevel }));
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private updateInputLevel(int16: Int16Array): void {
    if (this.stateSubject.value.isSpeaking) return;
    let sum = 0; for (let i = 0; i < int16.length; i++) sum += int16[i] * int16[i];
    this.smoothedLevel = Math.sqrt(sum / int16.length) / 32768;
  }

  // ─── Reconexión ────────────────────────────────────────────

  private scheduleRetry(): void {
    if (this.retryCount >= this.MAX_RETRIES) { this.handleError('No se pudo reconectar'); return; }
    this.retryCount++;
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1) + Math.random() * 300, 15000);
    this.patch({ status: 'RECONNECTING' });
    this.retryTimer = setTimeout(async () => {
      if (!this.intentActive) return;
      try { await this.openSession(); } catch { this.scheduleRetry(); }
    }, delay);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
  }

  // ─── Cleanup ───────────────────────────────────────────────

  private teardownAudio(): void {
    this.mediaStream?.getTracks().forEach(t => t.stop()); this.mediaStream = null;
    this.processor?.disconnect(); this.processor = null;
    this.micSource?.disconnect(); this.micSource = null;
    this.recordingCtx?.close().catch(() => {}); this.recordingCtx = null;
    this.stopAllSources();
    this.analyser?.disconnect(); this.analyser = null; this.analyserData = null;
    this.playbackCtx?.close().catch(() => {}); this.playbackCtx = null;
    this.nextPlayTime     = 0;
    this.smoothedLevel    = 0;
    this.userTranscriptBuffer = '';
    this.cancelledToolCalls.clear();
  }

  private handleError(msg: string): void {
    this.intentActive = false;
    this.teardownAudio(); this.closeSession();
    this.patch({ status: 'FAILED', error: msg, isListening: false, isSpeaking: false });
  }

  // ─── Utils ─────────────────────────────────────────────────

  private wsSend(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) { try { this.ws.send(data); } catch {} }
  }

  private toBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let s = ''; for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  private b64ToBuffer(b64: string): ArrayBuffer {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer as ArrayBuffer;
  }

  private patch(p: Partial<LiveVoiceState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...p });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.stop();
    this.stateSubject.complete();
    this.transcriptSubject.complete();
  }

}
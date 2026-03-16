import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs';
import { firstValueFrom } from 'rxjs';

export type ConnectionStatus =
  | 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'FAILED';

export interface LiveVoiceState {
  status: ConnectionStatus;
  isListening: boolean;
  isSpeaking: boolean;
  error: string | null;
  audioLevel: number;
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const INITIAL_STATE: LiveVoiceState = {
  status: 'DISCONNECTED', isListening: false,
  isSpeaking: false, error: null, audioLevel: 0,
};

const GEMINI_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
const MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';

const BASE_SYSTEM = `Eres Curim, un asistente de voz inteligente especializado en documentos.

REGLA CRÍTICA PARA RESPUESTAS:
Cuando el usuario te pregunte sobre información específica o de sus documentos, el sistema realizará una búsqueda y te enviará los resultados en un mensaje que comenzará con [CONTEXTO].
Por lo tanto:
1. NUNCA digas "no tengo esa información" ni "según el documento" de forma introductoria negativa.
2. Si te hacen una pregunta de documentos y aún no tienes el [CONTEXTO], tu primera respuesta debe ser ÚNICAMENTE una frase muy breve, natural y conversacional como "Buscando esa información..." o "Revisando el documento...".
3. Inmediatamente después, el sistema te enviará el [CONTEXTO]. Cuando lo recibas, da la respuesta completa, fluida y precisa.
4. Si la interacción es solo un saludo o charla general que no requiere buscar en documentos, responde de manera normal al instante sin mencionar contextos.`;

@Injectable({ providedIn: 'root' })
export class VoiceLiveService implements OnDestroy {

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
  private apiKey:       string | null = null;
  private intentActive  = false;
  private retryCount    = 0;
  private readonly MAX_RETRIES = 5;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  // ── RAG ────────────────────────────────────────────────────
  // Buffer que ACUMULA todos los chunks de transcripción del usuario
  // Gemini envía la transcripción de forma incremental, ej:
  //   chunk 1: "Háblame sobre"
  //   chunk 2: "Háblame sobre los casos"
  //   chunk 3: "Háblame sobre los casos de trabajo"
  // Cada chunk es la frase completa hasta ese momento (no solo el delta)
  // Por eso simplemente sobreescribimos con el último chunk recibido.
  private userTranscriptBuffer = '';
  private ragTimer: ReturnType<typeof setTimeout> | null = null;
  private ragInFlight = false;
  // Guardar último query enviado para evitar duplicados
  private lastRagQuery = '';

  constructor(private ngZone: NgZone, private http: HttpClient) {
    this.startLevelLoop();
  }

  // ─── API pública ───────────────────────────────────────────

  async start(): Promise<void> {
    if (this.intentActive) return;
    this.intentActive = true;
    this.retryCount   = 0;
    try {
      this.apiKey = await this.fetchApiKey();
      await this.openSession();
    } catch (err) {
      this.handleError((err as Error).message ?? 'Error al iniciar');
    }
  }

  stop(): void {
    this.intentActive = false;
    this.clearRetryTimer();
    this.clearRagTimer();
    this.closeSession();
    this.teardownAudio();
    this.patch({ status: 'DISCONNECTED', isListening: false, isSpeaking: false, error: null });
  }

  interrupt(): void {
    this.stopAllSources();
    this.nextPlayTime = 0;
    this.patch({ isSpeaking: false });
  }

  // ─── Token ─────────────────────────────────────────────────

  private async fetchApiKey(): Promise<string> {
    const r = await firstValueFrom(
      this.http.get<{ api_key: string }>('/api/v1/voice/token')
    );
    if (!r?.api_key) throw new Error('No se pudo obtener el token de voz');
    return r.api_key;
  }

  // ─── RAG ───────────────────────────────────────────────────

  private clearRagTimer(): void {
    if (this.ragTimer) { clearTimeout(this.ragTimer); this.ragTimer = null; }
  }

  /**
   * Gemini Live envía inputAudioTranscription de forma acumulativa:
   * cada mensaje contiene la frase COMPLETA hasta ese momento.
   * Por eso simplemente guardamos el último valor recibido.
   *
   * Iniciamos un timer de 1.5s. Si en 1.5s no llega nada nuevo
   * = el usuario terminó de hablar → disparamos RAG con la frase completa.
   */
  private onTranscriptChunk(fullTextSoFar: string): void {
    // Guardar el texto completo acumulado (Gemini ya lo acumula por nosotros)
    this.userTranscriptBuffer = fullTextSoFar;

    // Reiniciar timer — si el usuario sigue hablando, se cancela y reinicia
    this.clearRagTimer();
    this.ragTimer = setTimeout(() => this.fireRag(), 400);
  }

  private async fireRag(): Promise<void> {
    this.clearRagTimer();

    const query = this.userTranscriptBuffer.trim();
    this.userTranscriptBuffer = '';

    // Ignorar frases muy cortas o duplicadas
    if (!query || query.split(/\s+/).length < 3) return;
    if (query === this.lastRagQuery) return;
    if (this.ragInFlight) return;

    this.lastRagQuery = query;
    this.ragInFlight  = true;

    // Interrumpir cualquier respuesta nativa de Gemini (sin contexto) antes de inyectar RAG
    this.stopAllSources();
    this.nextPlayTime = 0;
    this.patch({ isSpeaking: false });

    // Mostrar en transcript lo que dijo el usuario
    this.ngZone.run(() =>
      this.transcriptSubject.next({ role: 'user', text: query, timestamp: new Date() })
    );

    console.log('[RAG] Buscando contexto para:', query);

    try {
      const resp = await firstValueFrom(
        this.http.post<{ context: string | null; found: boolean }>(
          '/api/v1/voice/context',
          { query }
        )
      );

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      // Construir el mensaje que Gemini recibirá
      const text = resp.found && resp.context
        ? `[CONTEXTO]\n${resp.context}\n[/CONTEXTO]\n\n${query}`
        : query;

      if (resp.found) {
        console.log('[RAG] ✅ Contexto encontrado, inyectando', resp.context!.length, 'chars');
      } else {
        console.log('[RAG] ⚠️ Sin contexto, respondiendo sin documento');
      }

      // Enviar a Gemini como turno completo del usuario
      this.wsSend(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true,
        },
      }));

    } catch (err) {
      console.error('[RAG] Error:', err);
      // Fallback sin contexto
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.wsSend(JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: query }] }],
            turnComplete: true,
          },
        }));
      }
    } finally {
      this.ragInFlight = false;
    }
  }

  // ─── WebSocket ─────────────────────────────────────────────

  private async openSession(): Promise<void> {
    this.patch({ status: 'CONNECTING', error: null });

    this.ws = new WebSocket(`${GEMINI_WS_URL}?key=${this.apiKey}`);
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
        model: MODEL,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        },
        systemInstruction: { parts: [{ text: BASE_SYSTEM }] },
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

    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.interrupted) {
      this.stopAllSources(); this.nextPlayTime = 0;
      this.patch({ isSpeaking: false });
      return;
    }

    if (sc.turnComplete) {
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

    // ── TRANSCRIPCIÓN DEL USUARIO ──
    // inputAudioTranscription llega con la frase acumulada hasta ese momento
    const inputText = sc.inputTranscription?.text;
    if (inputText?.trim()) {
      this.onTranscriptChunk(inputText);
    }

    // Transcripción de lo que dijo Gemini (texto de su respuesta en audio)
    const outputText = sc.outputTranscription?.text;
    if (outputText?.trim()) {
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
    this.ragInFlight      = false;
    this.lastRagQuery     = '';
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
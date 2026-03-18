/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import {
  VoiceLiveService,
  LiveVoiceState,
  TranscriptEntry,
} from '../../services/voice/voice-live.service';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Api as DocumentService } from '../../services/api/api';
declare const THREE: any;
// ─── Types ─────────────────────────────────────────────────────────────────

export type ChatMode = 'text' | 'voice';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  time: string;
}

//
@Component({
  selector: 'app-athenia-voice',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './athenia-voice.html',
  styleUrls: ['./athenia-voice.css'],
})
export class AtheniaVoice implements OnInit, OnDestroy {
  @ViewChild('threeCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('messagesList') messagesListRef!: ElementRef<HTMLDivElement>;
  @ViewChild('textInput') textInputRef!: ElementRef<HTMLTextAreaElement>;

  // ─── Services ──────────────────────────────────────────────────────────────
  voiceService = inject(VoiceLiveService);
  private ngZone = inject(NgZone);
  private destroy$ = new Subject<void>();
  private documentService = inject(DocumentService);
  private translate = inject(TranslateService);

  // ─── UI state ──────────────────────────────────────────────────────────────
  currentMode = signal<ChatMode>('text');
  inputValue = '';
  inputFocused = false;
  isTyping = signal(false);

  // ─── Voice state ───────────────────────────────────────────────────────────
  state = signal<LiveVoiceState>({
    status: 'DISCONNECTED',
    isListening: false,
    isSpeaking: false,
    error: null,
    audioLevel: 0,
  });
  transcript = signal<TranscriptEntry[]>([]);

  // ─── Text chat messages ────────────────────────────────────────────────────
  messages = signal<ChatMessage[]>([]);

  // ─── Hint chips ────────────────────────────────────────────────────────────
  readonly hintKeys: string[] = ['voice.hints.hint1', 'voice.hints.hint2', 'voice.hints.hint3'];

  // ─── AI demo replies ───────────────────────────────────────────────────────


  // ─── Computed signals ──────────────────────────────────────────────────────

  isActive = computed(() => {
    const s = this.state().status;
    return s === 'CONNECTED' || s === 'CONNECTING' || s === 'RECONNECTING';
  });

  hasMessages = computed(() => this.messages().length > 0);

  statusLabel = computed(() => {
    const s = this.state();
    if (s.status === 'CONNECTING' || s.status === 'RECONNECTING') return 'voice.connecting';
    if (s.status === 'FAILED') return 'voice.error';
    if (s.isSpeaking) return 'voice.speaking';
    if (s.isListening) return 'voice.listening';
    return 'voice.waiting';
  });

  badgeClass = computed(() => {
    const s = this.state();
    if (s.status === 'CONNECTING' || s.status === 'RECONNECTING') return 'status-badge connecting';
    if (s.status === 'FAILED') return 'status-badge error';
    if (s.isSpeaking) return 'status-badge speaking';
    if (s.isListening) return 'status-badge listening';
    return 'status-badge';
  });

  // ─── Three.js internals ────────────────────────────────────────────────────
  private renderer: any;
  private scene: any;
  private camera: any;
  private particlesMesh: any;
  private ring1: any;
  private ring2: any;
  private coreMesh: any;
  private rafId = 0;
  private time = 0;
  private smoothedLevel = 0;
  private threeReady = false;
  private currentOrbState = 'idle';

  private readonly N_RING = 700;
  private readonly N_ORBIT = 280;
  private readonly N_INNER = 180;
  private get N_TOTAL() {
    return this.N_RING + this.N_ORBIT + this.N_INNER;
  }

  private pAngles!: Float32Array;
  private pRadii!: Float32Array;
  private pElevations!: Float32Array;
  private pPhases!: Float32Array;
  private pSpeeds!: Float32Array;
  private pBaseSizes!: Float32Array;
  private pTypes!: Float32Array;

  private currentPalette: number[][] = [];
  private targetPalette: number[][] = [];

  private readonly palettes: Record<string, number[][]> = {
    idle: [
      [0.1, 0.42, 0.94],
      [0.48, 0.18, 1.0],
      [0.0, 0.7, 1.0],
    ],
    listening: [
      [0.0, 0.9, 1.0],
      [0.0, 1.0, 0.62],
      [0.2, 0.8, 0.9],
    ],
    speaking: [
      [0.94, 0.67, 0.99],
      [1.0, 0.24, 0.67],
      [0.8, 0.4, 1.0],
    ],
    connecting: [
      [0.66, 0.33, 0.97],
      [0.23, 0.51, 0.96],
      [0.8, 0.2, 1.0],
    ],
  };

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.voiceService.state$.pipe(takeUntil(this.destroy$)).subscribe((s) => {
      this.state.set(s);
      this.syncOrbState(s);
    });

    this.voiceService.transcript$
      .pipe(takeUntil(this.destroy$))
      .subscribe((entry) => this.transcript.update((list) => [...list.slice(-20), entry]));
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    cancelAnimationFrame(this.rafId);
    this.renderer?.dispose();
  }

  // ─── Mode switching ────────────────────────────────────────────────────────

  setMode(mode: ChatMode): void {
    if (mode === this.currentMode()) return;
    this.currentMode.set(mode);

    if (mode === 'voice') {
      // Boot Three.js lazily, after the panel renders
      setTimeout(() => this.bootThreeIfNeeded(), 50);
    } else {
      // Stop voice when switching to text
      if (this.isActive()) this.voiceService.stop();
    }
  }

  // ─── Voice actions ─────────────────────────────────────────────────────────

  toggleVoice(): void {
    if (this.isActive()) {
      this.voiceService.stop();
    } else {
      this.transcript.set([]);
      this.voiceService.start();
    }
  }

  clearTranscript(): void {
    this.transcript.set([]);
  }

  // ─── Text chat actions ─────────────────────────────────────────────────────

  sendText(): void {
  const text = this.inputValue.trim(); 
  if (!text) return;

  this.addMessage('user', text);
  this.inputValue = '';

  if (this.textInputRef?.nativeElement) {
    this.textInputRef.nativeElement.style.height = 'auto';
  }

  this.askBackend(text); 
}

  sendHint(hintKey: string): void {
  const translatedHint = this.translate.instant(hintKey);
  this.addMessage('user', translatedHint);
  this.askBackend(translatedHint);   
}

  private askBackend(question: string): void {
  this.isTyping.set(true);

  this.documentService.askCurim({
    question,
    document_ids: null, // busca en todos
    use_cache: true
  })
  .pipe(takeUntil(this.destroy$))
  .subscribe({
    next: (response) => {
      this.isTyping.set(false);

      this.addMessage('ai', response.answer);

      console.log('Confidence:', response.confidence);
      console.log('Processing time:', response.processing_time_ms);
      console.log('From cache:', response.from_cache);
    },
    error: (error: unknown) => {
      this.isTyping.set(false);
      console.error(error);
      this.addMessage('ai', this.translate.instant('voice.errorConsulting'));
    }
  });
}

  clearMessages(): void {
    this.messages.set([]);
    this.isTyping.set(false);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendText();
    }
  }

  autoResize(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  trackMsg(_: number, msg: ChatMessage): string {
    return msg.id;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private addMessage(role: 'user' | 'ai', text: string): void {
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      role,
      text,
      time: this.nowString(),
    };
    this.messages.update((list) => [...list, msg]);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesListRef?.nativeElement) {
        const el = this.messagesListRef.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 30);
  }

  private nowString(): string {
    const d = new Date();
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private syncOrbState(s: LiveVoiceState): void {
    if (s.status === 'CONNECTING' || s.status === 'RECONNECTING') {
      this.setOrbState('connecting');
    } else if (s.isSpeaking) {
      this.setOrbState('speaking');
    } else if (s.isListening) {
      this.setOrbState('listening');
    } else {
      this.setOrbState('idle');
    }
  }

  private setOrbState(state: string): void {
    this.currentOrbState = state;
    if (this.palettes[state]) {
      this.targetPalette = this.palettes[state].map((c) => [...c]);
    }
  }

  // ─── Three.js bootstrap ────────────────────────────────────────────────────

  private bootThreeIfNeeded(): void {
    if (this.threeReady) return;

    const init = () => this.ngZone.runOutsideAngular(() => this.initThree());

    if (typeof THREE === 'undefined') {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.onload = init;
      document.head.appendChild(s);
    } else {
      init();
    }
  }

  private initThree(): void {
    if (this.threeReady || !this.canvasRef?.nativeElement) return;
    this.threeReady = true;

    const canvas = this.canvasRef.nativeElement;
    const size = 140;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(size, size);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.z = 260;

    this.currentPalette = this.palettes['idle'].map((c) => [...c]);
    this.targetPalette = this.palettes['idle'].map((c) => [...c]);

    this.buildParticles();
    this.buildRings();
    this.renderLoop();
  }

  // ─── Three.js: particles ───────────────────────────────────────────────────

  private buildParticles(): void {
    const N = this.N_TOTAL;
    this.pAngles = new Float32Array(N);
    this.pRadii = new Float32Array(N);
    this.pElevations = new Float32Array(N);
    this.pPhases = new Float32Array(N);
    this.pSpeeds = new Float32Array(N);
    this.pBaseSizes = new Float32Array(N);
    this.pTypes = new Float32Array(N);

    // Ring particles
    for (let i = 0; i < this.N_RING; i++) {
      this.pAngles[i] = (i / this.N_RING) * Math.PI * 2;
      this.pRadii[i] = 85 + (Math.random() - 0.5) * 8;
      this.pElevations[i] = (Math.random() - 0.5) * 6;
      this.pPhases[i] = Math.random() * Math.PI * 2;
      this.pSpeeds[i] = 0.0008 + Math.random() * 0.0004;
      this.pBaseSizes[i] = 1.2 + Math.random() * 1.8;
      this.pTypes[i] = 0;
    }
    // Orbit particles
    for (let i = 0; i < this.N_ORBIT; i++) {
      const ix = this.N_RING + i;
      this.pAngles[ix] = Math.random() * Math.PI * 2;
      this.pRadii[ix] = 105 + Math.random() * 35;
      this.pElevations[ix] = (Math.random() - 0.5) * 28;
      this.pPhases[ix] = Math.random() * Math.PI * 2;
      this.pSpeeds[ix] = 0.0003 + Math.random() * 0.0005;
      this.pBaseSizes[ix] = 0.6 + Math.random() * 1.2;
      this.pTypes[ix] = 1;
    }
    // Inner core particles
    for (let i = 0; i < this.N_INNER; i++) {
      const ix = this.N_RING + this.N_ORBIT + i;
      this.pAngles[ix] = Math.random() * Math.PI * 2;
      this.pRadii[ix] = Math.random() * 28;
      this.pElevations[ix] = (Math.random() - 0.5) * 28;
      this.pPhases[ix] = Math.random() * Math.PI * 2;
      this.pSpeeds[ix] = 0.001 + Math.random() * 0.002;
      this.pBaseSizes[ix] = 0.5 + Math.random() * 0.8;
      this.pTypes[ix] = 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(N), 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float size; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (280.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;
          vAlpha = smoothstep(400.0, 80.0, -mv.z);
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float core = 1.0 - smoothstep(0.0, 0.22, d);
          float glow = 1.0 - smoothstep(0.0, 0.5,  d);
          gl_FragColor = vec4(vColor, (core * 0.9 + glow * 0.4) * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    this.particlesMesh = new THREE.Points(geo, mat);
    this.scene.add(this.particlesMesh);
  }

  // ─── Three.js: decorative rings ────────────────────────────────────────────

  private buildRings(): void {
    const mkRing = (r: number, tube: number, color: number, opacity: number) => {
      const g = new THREE.TorusGeometry(r, tube, 8, 200);
      const m = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      return new THREE.Mesh(g, m);
    };

    this.ring1 = mkRing(85, 0.35, 0x1a6cf0, 0.15);
    this.ring2 = mkRing(85, 0.18, 0x7b2fff, 0.1);
    const cg = new THREE.SphereGeometry(10, 32, 32);
    const cm = new THREE.MeshBasicMaterial({
      color: 0x1a6cf0,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.coreMesh = new THREE.Mesh(cg, cm);
    this.scene.add(this.ring1, this.ring2, this.coreMesh);
  }

  // ─── Three.js: render loop ─────────────────────────────────────────────────

  private renderLoop(): void {
    this.rafId = requestAnimationFrame(() => this.renderLoop());
    this.time += 0.016;
    const t = this.time;

    // Smooth audio level
    this.smoothedLevel += (this.state().audioLevel - this.smoothedLevel) * 0.12;

    // Lerp palette
    for (let p = 0; p < 3; p++) {
      for (let ch = 0; ch < 3; ch++) {
        this.currentPalette[p][ch] +=
          (this.targetPalette[p][ch] - this.currentPalette[p][ch]) * 0.025;
      }
    }

    const vs = this.currentOrbState;
    let ringScale = 1;
    let rotSpeed = 0.0005;
    let breathAmp = 5;
    let waveAmp = 0;
    let spreadExtra = 0;

    switch (vs) {
      case 'idle':
        breathAmp = 5 + Math.sin(t * 0.6) * 2;
        ringScale = 1 + Math.sin(t * 0.5) * 0.01;
        break;
      case 'listening':
        breathAmp = 6 + this.smoothedLevel * 20;
        rotSpeed = 0.001;
        ringScale = 1 + this.smoothedLevel * 0.08 + Math.sin(t * 1.5) * 0.015;
        spreadExtra = this.smoothedLevel * 12;
        break;
      case 'connecting':
        rotSpeed = 0.003 + Math.sin(t * 2) * 0.001;
        waveAmp = 8;
        breathAmp = 3;
        ringScale = 1 + Math.sin(t * 3) * 0.02;
        break;
      case 'speaking':
        breathAmp = 8 + this.smoothedLevel * 35;
        rotSpeed = 0.001;
        ringScale = 1 + this.smoothedLevel * 0.18 + Math.sin(t * 8) * 0.02 * this.smoothedLevel;
        spreadExtra = this.smoothedLevel * 25;
        waveAmp = this.smoothedLevel * 15;
        break;
    }

    // Update particle positions / colors / sizes
    const pos = this.particlesMesh.geometry.attributes.position.array as Float32Array;
    const col = this.particlesMesh.geometry.attributes.color.array as Float32Array;
    const sz = this.particlesMesh.geometry.attributes.size.array as Float32Array;

    for (let i = 0; i < this.N_TOTAL; i++) {
      const ph = this.pPhases[i];
      const type = this.pTypes[i];
      const spd = type === 0 ? 1 : type === 1 ? 0.6 : 2;
      this.pAngles[i] += rotSpeed * spd;

      const a = this.pAngles[i];
      const breath = Math.sin(t * 0.8 + ph) * breathAmp;
      const wave = Math.sin(t * 2.5 + a * 3 + ph) * waveAmp;
      const r = this.pRadii[i] * ringScale + breath + wave + spreadExtra * Math.sin(ph);

      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = this.pElevations[i] + Math.sin(t * 0.4 + ph) * 3;
      pos[i * 3 + 2] = Math.sin(a) * r;

      const mix = Math.sin(ph + t * 0.5) * 0.5 + 0.5;
      const pi = type === 0 ? 0 : type === 1 ? 1 : 2;
      const pi2 = (pi + 1) % 3;

      col[i * 3] =
        this.currentPalette[pi][0] +
        (this.currentPalette[pi2][0] - this.currentPalette[pi][0]) * mix;
      col[i * 3 + 1] =
        this.currentPalette[pi][1] +
        (this.currentPalette[pi2][1] - this.currentPalette[pi][1]) * mix;
      col[i * 3 + 2] =
        this.currentPalette[pi][2] +
        (this.currentPalette[pi2][2] - this.currentPalette[pi][2]) * mix;

      sz[i] = this.pBaseSizes[i];
      if (vs === 'speaking' && type === 0)
        sz[i] += this.smoothedLevel * 3 * (Math.sin(ph + t * 6) * 0.5 + 0.5);
      if (vs === 'connecting' && type === 0) sz[i] *= 1 + Math.sin(a * 8 + t * 5) * 0.3;
    }

    this.particlesMesh.geometry.attributes.position.needsUpdate = true;
    this.particlesMesh.geometry.attributes.color.needsUpdate = true;
    this.particlesMesh.geometry.attributes.size.needsUpdate = true;

    // Ring animation
    const p0 = this.currentPalette[0];
    const p1 = this.currentPalette[1];

    this.ring1.scale.setScalar(ringScale);
    this.ring2.scale.setScalar(ringScale * 1.002);
    this.ring1.material.color.setRGB(p0[0], p0[1], p0[2]);
    this.ring2.material.color.setRGB(p1[0], p1[1], p1[2]);
    this.ring1.material.opacity = 0.12 + this.smoothedLevel * 0.25;
    this.ring2.material.opacity = 0.08 + this.smoothedLevel * 0.15;
    this.ring1.rotation.x = Math.sin(t * 0.12) * 0.1;
    this.ring2.rotation.x = Math.sin(t * 0.1 + 1) * 0.12;

    this.coreMesh.material.color.setRGB(p0[0], p0[1], p0[2]);
    this.coreMesh.material.opacity = 0.06 + this.smoothedLevel * 0.12;
    this.coreMesh.scale.setScalar(1 + this.smoothedLevel * 0.5);

    this.particlesMesh.rotation.x = Math.sin(t * 0.15) * 0.07;
    this.particlesMesh.rotation.y += 0.0002;

    this.renderer.render(this.scene, this.camera);
  }
}

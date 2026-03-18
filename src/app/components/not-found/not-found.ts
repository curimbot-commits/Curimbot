import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans relative overflow-hidden text-white">
      
      <!-- Hyper-Premium Dynamic Background -->
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[160px] animate-float"></div>
        <div class="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[160px] animate-float-delayed"></div>
        <!-- Grid/Tech Pattern Overlay -->
        <div class="absolute inset-0 opacity-[0.03]" 
             style="background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px); background-size: 50px 50px;">
        </div>
      </div>

      <!-- Main Cinematic Container -->
      <div class="relative z-10 max-w-5xl w-full flex flex-col md:flex-row items-center gap-12 md:gap-24 animate-reveal">
        
        <!-- Deep Perspective Illustration -->
        <div class="relative w-full md:w-1/2 flex justify-center items-center">
          <div class="absolute w-[120%] h-[120%] bg-white/5 rounded-full blur-3xl animate-pulse"></div>
          
          <!-- Large Background 404 Number - Increased visibility -->
          <div class="absolute -top-24 md:-top-32 -left-4 md:-left-12 text-[25vw] font-black text-white/[0.05] dark:text-emerald-500/[0.07] select-none tracking-tighter drop-shadow-2xl">
            404
          </div>

          <!-- The Illustration as a Floating HUD Element -->
          <div class="relative group">
            <div class="absolute -inset-4 bg-emerald-500/20 rounded-[2.5rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div class="relative bg-white p-2 rounded-[3rem] shadow-2xl transform transition-all duration-700 group-hover:rotate-2 group-hover:scale-110">
              <img src="https://cdn.dribbble.com/users/285475/screenshots/2083086/dribbble_1.gif" 
                   alt="System Anomaly" 
                   class="w-full max-w-[320px] md:max-w-[400px] rounded-[2.5rem] mix-blend-multiply">
              <!-- Animated Scanline effect over image -->
              <div class="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent h-12 w-full animate-scanline pointer-events-none"></div>
            </div>
          </div>
        </div>

        <!-- High-Precision Typography & Action -->
        <div class="w-full md:w-1/2 text-center md:text-left space-y-8">
          <div class="space-y-4">
            <span class="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-[0.2em] uppercase">
              System Anomaly Detected
            </span>
            <h1 class="text-6xl md:text-8xl font-black leading-none tracking-tight">
              Lost in <br>
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">Silence.</span>
            </h1>
            <p class="text-slate-400 text-xl font-medium leading-relaxed max-w-md mx-auto md:mx-0">
              The coordinate you are looking for has been purged or never existed in this dimension.
            </p>
          </div>

          <div class="flex flex-col sm:flex-row items-center gap-6 pt-4">
            <a routerLink="/" 
               class="relative group overflow-hidden px-10 py-5 bg-white text-black font-black text-lg rounded-2xl transition-all duration-300 hover:pr-14 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.2)]">
               <span class="relative z-10 flex items-center shadow-emerald-500/20">
                 INITIATE RETURN
                 <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 absolute -right-8 opacity-0 group-hover:right-[-24px] group-hover:opacity-100 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                 </svg>
               </span>
            </a>
            <p class="text-slate-500 text-sm font-mono tracking-tighter uppercase flex items-center gap-2">
              <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Core System Monitoring
            </p>
          </div>
        </div>
      </div>

      <!-- Ultra-Subtle Peripheral Elements -->
      <div class="absolute top-12 left-12 flex items-center gap-3 opacity-20 hover:opacity-100 transition-opacity duration-500 cursor-default">
         <div class="w-2 h-2 bg-emerald-500 rounded-full"></div>
         <span class="text-[10px] tracking-[0.3em] font-bold uppercase">Base Security Protocol Active</span>
      </div>

    </div>
  `,
  styles: [`
    @keyframes reveal {
      from { opacity: 0; filter: blur(20px); transform: scale(1.1); }
      to { opacity: 1; filter: blur(0); transform: scale(1); }
    }
    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(20px, -20px) scale(1.05); }
    }
    @keyframes float-delayed {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(-20px, 20px) scale(1.05); }
    }
    @keyframes scanline {
      0% { top: -10%; }
      100% { top: 110%; }
    }
    .animate-reveal { animation: reveal 1.2s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
    .animate-float { animation: float 10s ease-in-out infinite; }
    .animate-float-delayed { animation: float-delayed 12s ease-in-out infinite; animation-delay: -3s; }
    .animate-scanline { animation: scanline 3s linear infinite; }
    
    :host { display: block; }
  `]
})
export class NotFoundComponent {}

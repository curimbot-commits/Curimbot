import { Component } from '@angular/core';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
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
          <div class="absolute w-[120%] h-[120%] bg-emerald-500/5 rounded-full blur-3xl animate-pulse"></div>
          
          <!-- Extremely Prominent 404 - Centered behind illustration -->
          <div class="absolute inset-0 flex items-center justify-center text-[35vw] md:text-[25vw] font-black text-white/[0.07] dark:text-emerald-500/[0.08] select-none tracking-tighter drop-shadow-[0_0_40px_rgba(16,185,129,0.1)] pointer-events-none z-0">
            404
          </div>

          <!-- The Illustration as a Floating HUD Element -->
          <div class="relative group z-10 transition-transform duration-1000 hover:scale-105">
            <div class="absolute -inset-8 bg-emerald-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
            <div class="relative bg-white p-3 rounded-[3.5rem] shadow-2xl transform transition-all duration-700 group-hover:rotate-1">
              <img src="https://cdn.dribbble.com/users/285475/screenshots/2083086/dribbble_1.gif" 
                   alt="System Anomaly" 
                   class="w-full max-w-[320px] md:max-w-[420px] rounded-[3rem] mix-blend-multiply">
              <div class="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent h-16 w-full animate-scanline pointer-events-none"></div>
            </div>
          </div>
        </div>

        <!-- High-Precision Typography & Action -->
        <div class="w-full md:w-1/2 text-center md:text-left space-y-10">
          <div class="space-y-6">
            <h1 class="text-7xl md:text-9xl font-black leading-none tracking-tight">
              Lost in <br>
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">Silence.</span>
            </h1>
            <p class="text-slate-400 text-xl md:text-2xl font-medium leading-relaxed max-w-md mx-auto md:mx-0">
              The coordinate you are looking for has been purged or never existed in this dimension.
            </p>
          </div>

          <div class="flex justify-center md:justify-start pt-6">
            <a routerLink="/" 
               class="relative group overflow-hidden px-14 py-6 bg-white text-black font-black text-xl rounded-2xl transition-all duration-300 hover:bg-emerald-50 shadow-[0_0_50px_rgba(255,255,255,0.1)] active:scale-95">
               <span class="relative z-10 flex items-center">
                 INITIATE RETURN
                 <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 ml-3 transition-transform duration-300 group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                 </svg>
               </span>
            </a>
          </div>
        </div>
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

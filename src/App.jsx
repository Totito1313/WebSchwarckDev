import React, { useState, useRef } from 'react';
import {
  Button,
  Card,
  Chip,
  Tooltip,
  Modal
} from '@heroui/react';

// Community stories data
const COMMUNITY_STORIES = [
  {
    id: 1,
    name: "Elena Rostova",
    role: "Marathon Runner & Coach",
    metric: "94% Recovery",
    metricColor: "var(--color-recovery-green)",
    tag: "Sleep & HRV",
    quote: "Bevel showed me that my hardest training sessions were failing because of fragmented REM sleep. After 3 weeks of morning metrics, my pace jumped 12 seconds per km.",
    stat: "42.2 km / week",
    avatar: "🏃‍♀️"
  },
  {
    id: 2,
    name: "Marcus Vance",
    role: "Powerlifter & Software Architect",
    metric: "18.4k kg",
    metricColor: "var(--color-metric-blue)",
    tag: "Tonnage & Strain",
    quote: "Lion Fitness is the first mobile tool that respects offline gym basements. The haptic rest timer pulses through my wrist without requiring me to unlock the phone.",
    stat: "+35 kg Deadlift 1RM",
    avatar: "🏋️‍♂️"
  },
  {
    id: 3,
    name: "Dr. Sofia Chen",
    role: "Sports Cardiologist",
    metric: "52 BPM",
    metricColor: "var(--color-coral-signal)",
    tag: "Cardiovascular Health",
    quote: "The clinical clarity of the cloudlight journal makes biometric adherence effortless. It feels like an editorial art piece rather than a stressful clinical monitor.",
    stat: "Resting HR -6 BPM",
    avatar: "🩺"
  },
  {
    id: 4,
    name: "David Morales",
    role: "CrossFit Competitor",
    metric: "8.8 Strain",
    metricColor: "var(--color-sleep-lilac)",
    tag: "Recovery Autopilot",
    quote: "Zero subscription bloat, zero cloud latency. Having 120 FPS Frame 0 responsiveness on an Android device feels as buttery as native iOS hardware.",
    stat: "100% Offline Data",
    avatar: "🧗‍♂️"
  },
  {
    id: 5,
    name: "Camila Ortiz",
    role: "Triathlete & Founder",
    metric: "98% Efficiency",
    metricColor: "var(--color-recovery-green)",
    tag: "Circadian Rhythm",
    quote: "Both Lion Fitness and CeroFiao prove that mobile apps can be blisteringly fast, sovereign, and stunningly minimal.",
    stat: "Sub-10h Ironman",
    avatar: "🚴‍♀️"
  }
];

export default function App() {
  const [activeMetricTab, setActiveMetricTab] = useState('recovery'); // 'recovery' | 'strain' | 'sleep' | 'workout'
  const [selectedStory, setSelectedStory] = useState(null);
  const [toast, setToast] = useState({ show: false, text: '' });
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const carouselRef = useRef(null);

  const showToast = (text) => {
    setToast({ show: true, text });
    setTimeout(() => setToast({ show: false, text: '' }), 2600);
  };

  const copyEmail = () => {
    navigator.clipboard.writeText('alanleones2013@gmail.com').then(() => {
      showToast('Copied to clipboard: alanleones2013@gmail.com');
    });
  };

  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const offset = direction === 'left' ? -320 : 320;
      carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="bevel-app-container min-h-screen bg-white text-[#222326]">
      
      {/* ==============================================================
          1. FLOATING CAPSULE NAVIGATION
          ============================================================== */}
      <nav className="floating-capsule-nav" aria-label="Main Navigation">
        {/* Brand */}
        <a href="#hero" className="flex items-center gap-2.5 text-decoration-none">
          <div className="w-7 h-7 rounded-full bg-[#1f2025] flex items-center justify-center p-1">
            <img src="/assets/schwarckdev-logo.svg" alt="SchwarckDev" className="w-full h-full object-contain invert" />
          </div>
          <span className="text-brand-nav-item font-semibold text-[#222326]">
            SchwarckDev
          </span>
        </a>

        {/* Links */}
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-nav-item hover:text-[#222326] transition-colors">
            Apps & Metrics
          </a>
          <a href="#lionfitness" className="text-nav-item hover:text-[#222326] transition-colors">
            Lion Fitness
          </a>
          <a href="#cerofiao" className="text-nav-item hover:text-[#222326] transition-colors">
            CeroFiao
          </a>
          <a href="#architecture" className="text-nav-item hover:text-[#222326] transition-colors">
            120 FPS Architecture
          </a>
          <a href="#community" className="text-nav-item hover:text-[#222326] transition-colors">
            Community
          </a>
          <a href="#contact" className="text-nav-item hover:text-[#222326] transition-colors">
            Engineering
          </a>
        </div>

        {/* Charcoal Download Pill */}
        <button
          className="charcoal-download-pill"
          onClick={() => setQrModalOpen(true)}
          aria-label="Download App"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.56.64-1.06 1.7-0.93 2.73 1.02.08 2.05-.48 2.66-1.23z"/>
          </svg>
          <span>Get Bevel</span>
        </button>
      </nav>

      {/* ==============================================================
          2. CLOUDLIGHT DEVICE HERO
          ============================================================== */}
      <header id="hero" className="relative pt-28 pb-16 px-4 sm:px-8 overflow-hidden">
        {/* Top Hero Atmosphere (Hero Sky gradient fading into paper white) */}
        <div 
          className="max-w-7xl mx-auto rounded-[32px] sm:rounded-[48px] pt-16 sm:pt-24 pb-12 sm:pb-20 px-6 sm:px-12 text-center relative overflow-hidden"
          style={{ background: 'var(--gradient-hero-sky)' }}
        >
          {/* Subtle Ambient Rings */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-white/40 blur-3xl pointer-events-none" />

          {/* Recognition Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-md shadow-xs mb-6 border border-white/60">
            <span className="text-xs font-semibold text-[#1f2025]">Editorial Showcase 2026</span>
            <span className="w-1 h-1 rounded-full bg-[#747679]"></span>
            <span className="text-xs text-[#747679]">Native Mobile Health</span>
          </div>

          {/* Ink Display Headline: 80px/80px, weight 600, -2.4px tracking */}
          <h1 className="text-hero-display max-w-4xl mx-auto mb-6">
            Morning metrics in cloudlight.
          </h1>

          {/* Body Gray Copy: 24px/31.2px, weight 400 */}
          <p className="text-body-lead max-w-2xl mx-auto mb-8">
            Build screens as a bright white health journal punctuated by a softly glowing wearable dashboard. Zero cloud friction, 120 FPS native reactivity, and sovereign biometrics.
          </p>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <button
              className="charcoal-download-pill text-base py-3 px-6 shadow-md"
              onClick={() => setQrModalOpen(true)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.56.64-1.06 1.7-0.93 2.73 1.02.08 2.05-.48 2.66-1.23z"/>
              </svg>
              <span>Download for iOS & Android</span>
            </button>

            <a
              href="#lionfitness"
              className="px-6 py-3 rounded-full text-base font-medium text-[#1f2025] bg-white/70 hover:bg-white backdrop-blur-md transition-all border border-white/60"
            >
              Explore Native Apps ↓
            </a>
          </div>

          {/* Hero Rating Strip: Signal Gold stars + Body Gray metadata */}
          <div className="flex items-center justify-center gap-2 mb-12">
            <div className="flex text-[#ffca00] text-sm">
              <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
            </div>
            <span className="text-caption-item font-medium">
              4.9 out of 5 from 14,000+ athletes & health thinkers
            </span>
          </div>

          {/* Realistic Overlapping Phone & Wearable Watch Renders */}
          <div className="relative max-w-4xl mx-auto pt-6 flex items-end justify-center">
            
            {/* Center iPhone Dashboard (Paper White / Glass surface) */}
            <div className="relative z-10 w-full max-w-[340px] sm:max-w-[380px] bg-white rounded-[44px] p-3.5 shadow-2xl border-4 border-white/90">
              
              {/* Dynamic Island / Speaker */}
              <div className="w-24 h-5 rounded-full bg-[#1f2025] mx-auto mb-3 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-[#2b2c33] ml-auto mr-2"></div>
              </div>

              {/* In-device UI: Bright White Health Journal */}
              <div className="rounded-[32px] bg-[#f8fafc] p-4 text-left border border-slate-100 space-y-4">
                
                {/* Journal Date & Status */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-[#747679] uppercase tracking-wider block">Today, Oct 09</span>
                    <h3 className="text-lg font-bold text-[#222326]">Morning Journal</h3>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white shadow-xs flex items-center justify-center">
                    <img src="/assets/lionfitness-logo.png" alt="Lion" className="w-5 h-5 object-contain" />
                  </div>
                </div>

                {/* Primary Metric Ring: Recovery Score (Recovery Green #31ce01) */}
                <div className="p-4 rounded-2xl bg-white shadow-xs border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#747679] block">Recovery Score</span>
                    <span className="text-3xl font-extrabold text-[#222326] tracking-tight">92%</span>
                    <span className="text-xs text-[#31ce01] font-semibold block mt-0.5">Optimal Readiness</span>
                  </div>
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-16 h-16 metric-ring-svg" viewBox="0 0 36 36">
                      <path
                        className="text-slate-100"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        style={{ stroke: 'var(--color-recovery-green)' }}
                        strokeDasharray="92, 100"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-xs font-bold text-[#222326]">92</span>
                  </div>
                </div>

                {/* Secondary Inset Metrics: Strain & Sleep */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-2xl bg-white shadow-xs border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-metric-blue)' }} />
                      <span className="text-[11px] font-semibold text-[#747679]">Strain Volume</span>
                    </div>
                    <span className="text-base font-bold text-[#222326]">18.4k kg</span>
                    <span className="text-[10px] text-[#415eee] font-medium block">Lion Tonelaje</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white shadow-xs border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-sleep-lilac)' }} />
                      <span className="text-[11px] font-semibold text-[#747679]">Sleep & REM</span>
                    </div>
                    <span className="text-base font-bold text-[#222326]">8h 42m</span>
                    <span className="text-[10px] text-[#b9a6ff] font-medium block">98% Efficiency</span>
                  </div>
                </div>

                {/* Haptic Timer Simulation Chip */}
                <div className="p-3 rounded-2xl bg-[#ebf0f8] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#31ce01] animate-pulse"></span>
                    <span className="font-semibold text-[#222326]">Haptic Rest Pulse</span>
                  </div>
                  <span className="font-mono font-bold text-[#415eee]">01:30 left</span>
                </div>

              </div>

              {/* Home Indicator */}
              <div className="w-32 h-1 rounded-full bg-slate-300 mx-auto mt-3"></div>
            </div>

            {/* Overlapping Wearable Watch Render (Positioned to the right with lift shadow) */}
            <div className="hidden sm:block absolute -right-6 lg:right-6 bottom-8 z-20 w-48 bg-[#1f2025] rounded-[36px] p-2.5 shadow-2xl border-2 border-slate-800 text-left">
              <div className="rounded-[28px] bg-black p-3.5 text-white space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>10:42 AM</span>
                  <span className="text-[#31ce01] font-mono">92%</span>
                </div>

                {/* Concentric Watch Health Rings */}
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center my-1">
                  <svg className="w-20 h-20 metric-ring-svg" viewBox="0 0 36 36">
                    <path
                      style={{ stroke: 'var(--color-recovery-green)' }}
                      strokeDasharray="85, 100"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      style={{ stroke: 'var(--color-metric-blue)' }}
                      strokeDasharray="65, 100"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                      d="M18 5.0845 a 12.9155 12.9155 0 0 1 0 25.831 a 12.9155 12.9155 0 0 1 0 -25.831"
                    />
                  </svg>
                  <span className="absolute text-[11px] font-bold text-white font-mono">88 HRV</span>
                </div>

                <div className="text-center pt-1">
                  <span className="text-[10px] font-semibold text-slate-300 block">Rest Complete</span>
                  <span className="text-[9px] text-[#31ce01] font-mono">Haptic Buzz Triggered</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </header>

      {/* ==============================================================
          3. WEARABLE PARTNER ROW (Paper White #ffffff, 24px/21.6px heading)
          ============================================================== */}
      <section className="py-16 px-6 max-w-6xl mx-auto text-center">
        {/* Ink 24px/21.6px, weight-600 heading with -0.24px tracking */}
        <h2 className="text-section-label mb-8">
          Designed for modern health hardware & open ecosystems
        </h2>

        {/* Monochrome partner wordmark row with generous 24px gaps, no enclosing cards */}
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-80">
          {[
            'Apple HealthKit',
            'Android Health Connect',
            'Wear OS',
            'WHOOP 4.0',
            'Garmin Connect',
            'Samsung Health',
            'Oura Ring Gen 3',
            'Polar Flow'
          ].map((partner, idx) => (
            <span
              key={idx}
              className="font-semibold text-lg tracking-tight text-[#1f2025] hover:opacity-100 transition-opacity"
            >
              {partner}
            </span>
          ))}
        </div>
      </section>

      {/* ==============================================================
          4. RECOGNITION LAUREL PAIR & DISPLAY STATEMENT
          ============================================================== */}
      <section className="pt-16 pb-8 px-6 max-w-4xl mx-auto text-center">
        {/* Two small neutral-gray laurel marks and award labels centered */}
        <div className="flex items-center justify-center gap-6 mb-8">
          <div className="flex items-center gap-2 text-[#747679] text-xs font-semibold uppercase tracking-wider">
            <span>🌿</span>
            <span>App Store Editorial Choice 2026</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <div className="flex items-center gap-2 text-[#747679] text-xs font-semibold uppercase tracking-wider">
            <span>🌿</span>
            <span>Google Play Best Native Architecture</span>
          </div>
        </div>

        {/* Display Statement: 64px, weight 600, -1.92px tracking */}
        <h2 className="text-display mb-6">
          A calmer lens on your daily human potential.
        </h2>

        <p className="text-body-lead max-w-2xl mx-auto">
          Health data should not feel like an overwhelming cockpit of alarms. Bevel and SchwarckDev distill high-frequency biometrics and financial balance into quiet, tactile insights.
        </p>
      </section>

      {/* ==============================================================
          5. THREE CLOUD FEATURE CARDS (#ebf0f8, 24px radius, 32px padding)
          ============================================================== */}
      <section id="features" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* FEATURE CARD 1: LION FITNESS */}
          <article id="lionfitness" className="cloud-feature-card">
            <div>
              {/* Badge */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold uppercase tracking-wider text-[#415eee] bg-white/70 px-3 py-1 rounded-full">
                  Kinematic Performance
                </span>
                <img src="/assets/lionfitness-logo.png" alt="Lion" className="w-7 h-7 object-contain" />
              </div>

              {/* Ink 40px/40px, weight 600, -1.2px tracking */}
              <h3 className="text-card-heading mb-4">
                Kinematic strength & haptic recovery.
              </h3>

              {/* Body Gray 24px/31.2px, weight 400 */}
              <p className="text-body-lead mb-8">
                Tracks progressive overload, tonnage volume, and calculates real-time 1RM with clinical precision. Haptic pulses notify your rest completion without ever turning on the screen.
              </p>
            </div>

            {/* Inset Metric Visualization: Recovery Green & Metric Blue */}
            <div className="rounded-2xl bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-recovery-green)' }}></span>
                  <span className="text-sm font-bold text-[#222326]">Autonomic Recovery</span>
                </div>
                <span className="text-sm font-bold text-[#31ce01] font-mono">94%</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#747679] block">Total Workout Tonnage</span>
                  <span className="text-xl font-bold text-[#222326] font-mono">18,420 kg</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ebf0f8] text-xs font-semibold text-[#415eee]">
                  <span>⚡ 1RM Brzycki</span>
                </div>
              </div>

              {/* Rest Timer Visual */}
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full w-3/4" style={{ backgroundColor: 'var(--color-metric-blue)' }}></div>
              </div>
            </div>
          </article>

          {/* FEATURE CARD 2: CEROFIAO */}
          <article id="cerofiao" className="cloud-feature-card">
            <div>
              {/* Badge */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold uppercase tracking-wider text-[#31ce01] bg-white/70 px-3 py-1 rounded-full">
                  Financial Equilibrium
                </span>
                <img src="/assets/cerofiao-logo.svg" alt="CeroFiao" className="w-7 h-7 object-contain" />
              </div>

              {/* Ink 40px/40px, weight 600, -1.2px tracking */}
              <h3 className="text-card-heading mb-4">
                Triple-currency ledger in real time.
              </h3>

              {/* Body Gray 24px/31.2px, weight 400 */}
              <p className="text-body-lead mb-8">
                Eliminates multi-currency friction with automatic BCV official triangulation, double-entry ledger architecture, and 26 sequential Room SQLite migrations without a single byte lost.
              </p>
            </div>

            {/* Inset Metric Visualization: Metric Blue & Coral Signal */}
            <div className="rounded-2xl bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-metric-blue)' }}></span>
                  <span className="text-sm font-bold text-[#222326]">Triangulated Balance</span>
                </div>
                <span className="text-sm font-bold text-[#222326] font-mono">$3,840.50</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-[#ebf0f8]">
                  <span className="text-[10px] text-[#747679] font-semibold block uppercase">Official Rate</span>
                  <span className="text-xs font-bold text-[#222326] font-mono">BCV Live Sync</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#ebf0f8]">
                  <span className="text-[10px] text-[#747679] font-semibold block uppercase">Ledger Integrity</span>
                  <span className="text-xs font-bold text-[#31ce01] font-mono">v26 Verified</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#747679] pt-1">
                <span>Partida Doble Inmutable</span>
                <span className="text-[#ffab94] font-semibold font-mono">0.00 Float Drift</span>
              </div>
            </div>
          </article>

          {/* FEATURE CARD 3: ARCHITECTURE */}
          <article id="architecture" className="cloud-feature-card">
            <div>
              {/* Badge */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold uppercase tracking-wider text-[#b9a6ff] bg-white/70 px-3 py-1 rounded-full">
                  Native Engineering
                </span>
                <div className="w-7 h-7 rounded-full bg-[#1f2025] flex items-center justify-center p-1">
                  <img src="/assets/schwarckdev-logo.svg" alt="SchwarckDev" className="w-full h-full object-contain invert" />
                </div>
              </div>

              {/* Ink 40px/40px, weight 600, -1.2px tracking */}
              <h3 className="text-card-heading mb-4">
                Zero cloud lag. 120 FPS reactivity.
              </h3>

              {/* Body Gray 24px/31.2px, weight 400 */}
              <p className="text-body-lead mb-8">
                Built with pure Kotlin 2.0 and Jetpack Compose. Frame 0 reactivity, dual-spring physics, and 100% offline data sovereignty. Your biometric and financial data never leaves your device.
              </p>
            </div>

            {/* Inset Metric Visualization: Sleep Lilac & Recovery Green */}
            <div className="rounded-2xl bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-sleep-lilac)' }}></span>
                  <span className="text-sm font-bold text-[#222326]">Compose Render Loop</span>
                </div>
                <span className="text-sm font-bold text-[#31ce01] font-mono">120 FPS</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#747679] block">Memory Leaks</span>
                  <span className="text-xl font-bold text-[#222326] font-mono">0 Detected</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ebf0f8] text-xs font-semibold text-[#1f2025]">
                  <span>🛡️ LeakCanary Clean</span>
                </div>
              </div>

              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full w-full" style={{ backgroundColor: 'var(--color-recovery-green)' }}></div>
              </div>
            </div>
          </article>

        </div>
      </section>

      {/* ==============================================================
          6. COMMUNITY STORY CAROUSEL
          ============================================================== */}
      <section id="community" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#747679] block mb-2">Member Transformations</span>
            <h2 className="text-display">
              Real members. Real data.
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollCarousel('left')}
              className="w-11 h-11 rounded-full bg-[#ebf0f8] hover:bg-slate-200 flex items-center justify-center text-[#1f2025] transition-colors"
              aria-label="Previous story"
            >
              ←
            </button>
            <button
              onClick={() => scrollCarousel('right')}
              className="w-11 h-11 rounded-full bg-[#ebf0f8] hover:bg-slate-200 flex items-center justify-center text-[#1f2025] transition-colors"
              aria-label="Next story"
            >
              →
            </button>
          </div>
        </div>

        {/* Horizontal Carousel with faded outer edges and 16px radius tiles */}
        <div 
          ref={carouselRef}
          className="carousel-scroll-container"
        >
          {COMMUNITY_STORIES.map((story) => (
            <div
              key={story.id}
              className="community-story-card p-6 flex flex-col justify-between cursor-pointer"
              onClick={() => setSelectedStory(story)}
            >
              <div>
                {/* Header with Avatar & Metric Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{story.avatar}</span>
                    <div>
                      <h4 className="text-sm font-bold text-[#222326]">{story.name}</h4>
                      <span className="text-xs text-[#747679]">{story.role}</span>
                    </div>
                  </div>
                </div>

                <div className="inline-block px-2.5 py-1 rounded-full text-xs font-bold mb-4" style={{ backgroundColor: '#ebf0f8', color: story.metricColor }}>
                  {story.metric} • {story.tag}
                </div>

                <p className="text-sm text-[#747679] leading-relaxed italic mb-6">
                  "{story.quote}"
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#1f2025]">
                <span>Result: {story.stat}</span>
                <span className="text-blue-600">Details →</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==============================================================
          7. ELEVATED QR DOWNLOAD CARD (#1f2025 card, #ebf0f8 text, 16px radius)
          ============================================================== */}
      <section className="py-20 px-4 sm:px-8 max-w-5xl mx-auto">
        <div className="elevated-qr-card flex flex-col md:flex-row items-center justify-between gap-8 p-8 md:p-12">
          <div className="max-w-lg">
            <span className="text-xs font-bold uppercase tracking-wider text-[#ffab94] block mb-2">Immediate Access</span>
            <h3 className="text-3xl sm:text-4xl font-bold text-[#ebf0f8] tracking-tight mb-4">
              Take Bevel & SchwarckDev anywhere.
            </h3>
            <p className="text-base text-slate-300 leading-relaxed mb-6">
              Scan the high-contrast code with your iPhone or Android camera to install the latest production builds directly from TestFlight, Google Play, or standalone APKs.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => setQrModalOpen(true)}
                className="px-5 py-2.5 rounded-full bg-[#ebf0f8] text-[#1f2025] font-semibold text-sm hover:bg-white transition-colors flex items-center gap-2"
              >
                <span>View Direct Links</span>
                <span>→</span>
              </button>
              <span className="text-xs text-slate-400">iOS 17+ • Android 14+</span>
            </div>
          </div>

          {/* High-Contrast QR Code Artwork */}
          <div className="bg-white p-5 rounded-2xl shadow-xl flex flex-col items-center flex-shrink-0">
            <div className="w-36 h-36 bg-slate-900 rounded-xl p-3 flex flex-col justify-between">
              <div className="flex justify-between">
                <div className="w-8 h-8 border-4 border-white bg-black"></div>
                <div className="w-8 h-8 border-4 border-white bg-black"></div>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center text-xs font-bold text-black">
                  SD
                </div>
              </div>
              <div className="flex justify-between">
                <div className="w-8 h-8 border-4 border-white bg-black"></div>
                <div className="w-8 h-8 bg-white/80"></div>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-800 mt-2">SCAN TO INSTALL</span>
          </div>
        </div>
      </section>

      {/* ==============================================================
          8. ABOUT ALAN / SCHWARCKDEV & DIRECT CONTACT
          ============================================================== */}
      <section id="contact" className="py-20 px-4 sm:px-8 max-w-4xl mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-[#ebf0f8] p-2 mx-auto mb-6 flex items-center justify-center">
          <img src="/assets/schwarckdev-logo.svg" alt="Alan" className="w-full h-full object-contain" />
        </div>

        <h2 className="text-display mb-4">
          Engineered by Alan / SchwarckDev
        </h2>

        <p className="text-body-lead max-w-2xl mx-auto mb-8">
          Independent mobile software engineer building native tools with uncompromising performance. Available for mobile architecture contracts, consulting, and end-to-end Kotlin/Compose development.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={copyEmail}
            className="charcoal-download-pill text-sm py-2.5 px-6"
          >
            <span>✉️ alanleones2013@gmail.com</span>
            <span className="text-xs text-slate-300 ml-1">Copy</span>
          </button>

          <a
            href="https://github.com/Totito1313"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 rounded-full text-sm font-semibold text-[#1f2025] bg-[#ebf0f8] hover:bg-slate-200 transition-colors flex items-center gap-2"
          >
            <span>GitHub Profile (@Totito1313)</span>
            <span>↗</span>
          </a>
        </div>
      </section>

      {/* ==============================================================
          9. FOOTER LINK GROUP (Paper White #ffffff, 160px section padding)
          ============================================================== */}
      <footer className="bg-white border-t border-slate-100 pt-36 pb-20 px-6 sm:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-12 mb-20 text-left">
          
          {/* Col 1 */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-[#747679] mb-6">Applications</h5>
            <ul className="space-y-4">
              <li><a href="#lionfitness" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">Lion Fitness</a></li>
              <li><a href="#cerofiao" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">CeroFiao Financial</a></li>
              <li><a href="#hero" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">Morning Metrics</a></li>
              <li><a href="#hero" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">Wearable Sync</a></li>
            </ul>
          </div>

          {/* Col 2 */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-[#747679] mb-6">Architecture</h5>
            <ul className="space-y-4">
              <li><a href="#architecture" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">Clean Architecture</a></li>
              <li><a href="#architecture" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">Jetpack Compose UI</a></li>
              <li><a href="#architecture" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">Room SQLite v26</a></li>
              <li><a href="#architecture" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">120 FPS Reactivity</a></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-[#747679] mb-6">Ecosystem</h5>
            <ul className="space-y-4">
              <li><a href="#community" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">Apple HealthKit</a></li>
              <li><a href="#community" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">Health Connect</a></li>
              <li><a href="#community" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">Wear OS Dial</a></li>
              <li><a href="#community" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">Community Stories</a></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-[#747679] mb-6">SchwarckDev</h5>
            <ul className="space-y-4">
              <li><a href="#contact" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">About Alan</a></li>
              <li><a href="mailto:alanleones2013@gmail.com" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">Direct Inquiries</a></li>
              <li><a href="https://github.com/Totito1313" target="_blank" rel="noopener noreferrer" className="text-brand-nav-item hover:text-[#415eee] transition-colors block">GitHub Code</a></li>
              <li><span className="text-brand-nav-item text-slate-400 block">Sovereign & Offline</span></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#747679]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1f2025]">SchwarckDev</span>
            <span>•</span>
            <span>Morning metrics in cloudlight.</span>
          </div>
          <span>© 2026 SchwarckDev. Crafted with clinical precision.</span>
        </div>
      </footer>

      {/* ==============================================================
          MODALS & TOASTS
          ============================================================== */}
      
      {/* QR / Download Direct Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setQrModalOpen(false)}>
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xl font-bold text-[#1f2025]">Download & Install</h3>
              <button onClick={() => setQrModalOpen(false)} className="text-slate-400 hover:text-black text-2xl font-light">&times;</button>
            </div>

            <div className="space-y-3">
              <a 
                href="mailto:alanleones2013@gmail.com?subject=TestFlight%20Beta%20Access"
                className="p-4 rounded-2xl bg-[#ebf0f8] hover:bg-slate-200 transition-colors flex items-center justify-between text-decoration-none group"
              >
                <div>
                  <span className="text-sm font-bold text-[#1f2025] block">Apple TestFlight (iOS)</span>
                  <span className="text-xs text-[#747679]">Direct beta invite via email</span>
                </div>
                <span className="text-sm font-semibold text-blue-600 group-hover:translate-x-1 transition-transform">Get Access →</span>
              </a>

              <a 
                href="https://github.com/Totito1313" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-4 rounded-2xl bg-[#ebf0f8] hover:bg-slate-200 transition-colors flex items-center justify-between text-decoration-none group"
              >
                <div>
                  <span className="text-sm font-bold text-[#1f2025] block">Android APK Releases</span>
                  <span className="text-xs text-[#747679]">GitHub Releases & Open Artifacts</span>
                </div>
                <span className="text-sm font-semibold text-blue-600 group-hover:translate-x-1 transition-transform">Explore →</span>
              </a>
            </div>

            <button 
              onClick={() => setQrModalOpen(false)}
              className="w-full py-3 rounded-full bg-[#1f2025] text-white font-medium text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Member Story Modal */}
      {selectedStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedStory(null)}>
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedStory.avatar}</span>
                <div>
                  <h3 className="text-lg font-bold text-[#1f2025]">{selectedStory.name}</h3>
                  <span className="text-xs text-[#747679]">{selectedStory.role}</span>
                </div>
              </div>
              <button onClick={() => setSelectedStory(null)} className="text-slate-400 hover:text-black text-2xl font-light">&times;</button>
            </div>

            <div className="p-4 rounded-2xl bg-[#ebf0f8] space-y-1">
              <span className="text-xs font-semibold text-[#747679] block">Measured Outcome</span>
              <span className="text-2xl font-bold text-[#222326] font-mono">{selectedStory.stat}</span>
            </div>

            <p className="text-base text-[#747679] leading-relaxed">
              "{selectedStory.quote}"
            </p>

            <button 
              onClick={() => setSelectedStory(null)}
              className="w-full py-3 rounded-full bg-[#1f2025] text-white font-medium text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1f2025] text-[#ebf0f8] px-5 py-2.5 rounded-full shadow-xl text-xs font-medium flex items-center gap-2">
          <span>✨</span>
          <span>{toast.text}</span>
        </div>
      )}

    </div>
  );
}

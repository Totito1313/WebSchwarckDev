import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  ButtonGroup,
  Card,
  Chip,
  Badge,
  Avatar,
  AvatarGroup,
  Tooltip,
  Accordion,
  Kbd,
  ProgressBar,
  Alert,
  Separator,
  ScrollShadow,
  Switch
} from '@heroui/react';

// Channel definitions
const CHANNELS = {
  inicio: {
    name: 'inicio',
    topic: 'Bienvenida, bio profesional y filosofía de desarrollo móvil nativo.',
    title: 'SchwarckDev — #inicio'
  },
  apps: {
    name: 'apps',
    topic: 'Showcase oficial de aplicaciones Android: CeroFiao & Lion Fitness.',
    title: 'SchwarckDev — #apps'
  },
  arquitectura: {
    name: 'arquitectura',
    topic: 'Clean Architecture, MVI, Compose Design Systems y persistencia Room v26.',
    title: 'SchwarckDev — #arquitectura'
  },
  servicios: {
    name: 'servicios',
    topic: 'Desarrollo de aplicaciones Android nativas de punta a punta y consultoría.',
    title: 'SchwarckDev — #servicios'
  },
  dms: {
    name: 'dms',
    topic: 'Mensajes directos privados con Alan / SchwarckDev.',
    title: 'SchwarckDev — DMs'
  }
};

// Available fonts for the interactive typography config
const FONT_OPTIONS = [
  { id: 'outfit', name: 'Outfit', label: 'Outfit (Predeterminada)', css: "'Outfit', sans-serif" },
  { id: 'inter', name: 'Inter', label: 'Inter (Limpia & Cupertino)', css: "'Inter', sans-serif" },
  { id: 'space', name: 'Space Grotesk', label: 'Space Grotesk (Tech & Cyber)', css: "'Space Grotesk', sans-serif" },
  { id: 'mono', name: 'JetBrains Mono', label: 'JetBrains Mono (Developer)', css: "'JetBrains Mono', monospace" }
];

// Specs database for modal deep-dives
const SPECS = {
  cerofiao: {
    badge: 'SISTEMA FINANCIERO ANDROID',
    title: 'CeroFiao Architecture & Modules (v26)',
    icon: '/assets/cerofiao-logo.svg',
    subtitle: '18 Módulos de Feature • 26 Migraciones de Base de Datos',
    desc: 'CeroFiao es una solución financiera integral concebida para economías multi-moneda. Implementa un sistema de partida doble (Ledger Snapshot inmutable) y sincronización de tasas oficiales en tiempo real.',
    modules: [
      { name: 'feature-transactions', desc: 'Libro mayor inmutable, gastos, ingresos, transferencias y pagos periódicos.' },
      { name: 'feature-debt', desc: 'Control exhaustivo de cuentas por cobrar y pagar con amortizaciones automáticas.' },
      { name: 'feature-exchange-rates', desc: 'Triangulación cambiaria automática con tasas oficiales (BCV, paralelo, EUR).' },
      { name: 'feature-budget & analytics', desc: 'Presupuestos por categoría, gauge cinemático y reporte de flujo de caja.' },
      { name: 'feature-shopping-cart', desc: 'Listas de compras con historial de variación de precio y cálculo de recibo.' }
    ],
    stack: ['Kotlin 2.0', 'Jetpack Compose', 'Room SQLite (v26)', 'StateFlow', 'Hilt DI', 'Clean Architecture'],
    code: `@Entity(tableName = "ledger_transactions")
data class LedgerTransactionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val amount: BigDecimal,
    val currency: String,
    val categoryId: Long,
    val timestamp: Long = System.currentTimeMillis(),
    val exchangeRateSnapshot: BigDecimal
)`
  },
  lionfitness: {
    badge: 'RENDIMIENTO DEPORTIVO',
    title: 'Lion Fitness Architecture & Design Engine',
    icon: '/assets/lionfitness-logo.png',
    subtitle: 'Custom Design System • OneUI Tokens • Anton Typography',
    desc: 'Lion Fitness combina la disciplina deportiva con ingeniería de software móvil de alto rendimiento. Elimina toda fricción durante los entrenamientos con una interfaz reactiva e intuitiva.',
    modules: [
      { name: 'Sobrecarga Progresiva', desc: 'Cálculo instantáneo de tonelaje total, RPE y 1RM estimada por ejercicio.' },
      { name: 'Cronómetro Háptico', desc: 'Integración profunda con la API de vibración de Android para avisar el fin del descanso sin encender la pantalla.' },
      { name: 'Sistema de Tokens', desc: 'Implementación de tokens de espaciado, elevación y efectos de vidrio sobre Jetpack Compose.' },
      { name: 'Arquitectura 100% Offline', desc: 'Cero dependencia de conexión externa; los datos son locales e instantáneos.' }
    ],
    stack: ['Kotlin', 'Jetpack Compose', 'Haptic API', 'Room SQLite', 'OneUI Custom Tokens'],
    code: `class HapticTimerController @Inject constructor(
    private val vibrator: VibratorManager
) {
    fun triggerRestCompletePulse() {
        val effect = VibrationEffect.createWaveform(
            longArrayOf(0, 150, 100, 250),
            intArrayOf(0, 255, 0, 255),
            -1
        )
        vibrator.defaultVibrator.vibrate(effect)
    }
}`
  },
  rates: {
    badge: 'MOTOR CAMBIARIO',
    title: 'Exchange Rates & Ledger Triangulation Spec',
    icon: '/assets/cerofiao-logo.svg',
    subtitle: 'Multi-Currency • BCV • Triangulación Automática',
    desc: 'El motor de tasas de cambio de CeroFiao utiliza un caso de uso puro (ResolveExchangeRateUseCase) para resolver operaciones entre cualquier combinación de monedas (VES, USD, EUR) garantizando precisión de centavos sin pérdida por punto flotante.',
    code: `class ResolveExchangeRateUseCase @Inject constructor(
    private val rateRepository: ExchangeRateRepository
) {
    suspend operator fun invoke(
        fromCurrency: Currency,
        toCurrency: Currency
    ): BigDecimal {
        if (fromCurrency == toCurrency) return BigDecimal.ONE
        val baseRate = rateRepository.getOfficialRate(fromCurrency)
        val targetRate = rateRepository.getOfficialRate(toCurrency)
        return targetRate.divide(baseRate, 4, RoundingMode.HALF_EVEN)
    }
}`
  },
  dock: {
    badge: 'CINEMÁTICA DE UI',
    title: 'Tri-Island Action Dock Architecture',
    icon: '/assets/schwarckdev-logo.svg',
    subtitle: 'Dual-Spring Physics • 120 FPS Reactivity',
    desc: 'Especificación del Dock flotante de navegación diseñado para CeroFiao y proyectos de SchwarckDev. Emplea simulación física dual-spring con tasa de refresco a 120 FPS y reactividad Frame 0 para eliminar cualquier sensación de lag táctil.',
    modules: [
      { name: 'Física Dual-Spring', desc: 'Curvas de aceleración calibradas para rebote orgánico al expandir menús.' },
      { name: 'Isla de Acción Contextual', desc: 'Adapta sus botones dependiendo de si el usuario está en transacciones, presupuestos o carrito.' }
    ]
  },
  kmp: {
    badge: 'ROADMAP 2026',
    title: 'Compose Multiplatform & iOS Roadmap',
    icon: '/assets/schwarckdev-logo.svg',
    subtitle: 'iOS Expansion • Shared Core',
    desc: 'El plan de evolución tecnológica de SchwarckDev contempla la unificación de la capa de datos y dominio mediante Kotlin Multiplatform (KMP), permitiendo extender CeroFiao y Lion Fitness a dispositivos iOS manteniendo una interfaz 100% fluida.',
    modules: [
      { name: 'Fase 1: Android Dominance', desc: 'Perfeccionamiento de CeroFiao y Lion Fitness en Google Play.' },
      { name: 'Fase 2: Multiplatform Core', desc: 'Extracción de core-domain y core-database a Kotlin Multiplatform.' },
      { name: 'Fase 3: Native iOS UI', desc: 'Implementación de UI nativa en iOS con Compose Multiplatform y widgets SwiftUI.' }
    ]
  }
};

export default function App() {
  const [activeChannel, setActiveChannel] = useState('inicio');
  const [activeTab, setActiveTab] = useState('messages'); // 'messages' | 'mockups' | 'files'
  const [theme, setTheme] = useState(() => localStorage.getItem('schwarckdev_theme') || 'dark');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('schwarckdev_font') || 'outfit');
  const [showFontModal, setShowFontModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedSpec, setSelectedSpec] = useState(null);
  const [activeMockupApp, setActiveMockupApp] = useState('cerofiao'); // 'cerofiao' | 'lionfitness'
  const [selectedMockupPreview, setSelectedMockupPreview] = useState(null);
  const [toast, setToast] = useState({ show: false, text: '', icon: '✨' });

  const [reactions, setReactions] = useState({
    fire: { count: 384, reacted: false },
    rocket: { count: 219, reacted: false },
    heart: { count: 142, reacted: false },
    appFire: { count: 412, reacted: false },
    appMoney: { count: 276, reacted: false },
    lionMuscle: { count: 318, reacted: false },
    lionKing: { count: 245, reacted: false },
    archGear: { count: 174, reacted: false },
    archCheck: { count: 129, reacted: false }
  });

  const paneRef = useRef(null);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('schwarckdev_theme', theme);
  }, [theme]);

  // Apply font family
  useEffect(() => {
    const selected = FONT_OPTIONS.find(f => f.id === fontFamily) || FONT_OPTIONS[0];
    document.documentElement.style.setProperty('--font-main', selected.css);
    localStorage.setItem('schwarckdev_font', fontFamily);
  }, [fontFamily]);

  const showToast = (text, icon = '✨') => {
    setToast({ show: true, text, icon });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 2800);
  };

  const toggleReaction = (key) => {
    setReactions(prev => {
      const current = prev[key];
      const newReacted = !current.reacted;
      const newCount = newReacted ? current.count + 1 : current.count - 1;
      return {
        ...prev,
        [key]: { count: newCount, reacted: newReacted }
      };
    });
    showToast('Reacción actualizada', '⚡');
  };

  const copyEmail = () => {
    navigator.clipboard.writeText('alanleones2013@gmail.com').then(() => {
      showToast('Correo copiado: alanleones2013@gmail.com', '📋');
    });
  };

  const copyStack = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Stack copiado al portapapeles', '📋');
    });
  };

  const currentChannelData = CHANNELS[activeChannel] || CHANNELS.inicio;

  return (
    <>
      {/* Scenic Wallpaper Background */}
      <div className="desktop-wallpaper">
        <div className="wallpaper-overlay" />
      </div>

      <div className="app-viewport">
        <div className="os-window" id="osWindow">
          
          {/* Top Window Chrome Header (Traffic light buttons removed as requested) */}
          <header className="window-titlebar flex items-center justify-between px-4 py-2.5">
            {/* Titlebar Left: Monogram and Brand Info */}
            <div className="titlebar-left flex items-center gap-3">
              <button
                className="mobile-toggle-btn md:hidden p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Abrir canales"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </button>

              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveChannel('inicio')}>
                <div className="p-1 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <img
                    src="/assets/schwarckdev-logo.svg"
                    alt="SchwarckDev"
                    className="w-5 h-5 object-contain"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm tracking-tight text-white">SchwarckDev</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono font-medium border border-cyan-500/30">
                    ENGINEER
                  </span>
                </div>
              </div>
            </div>

            {/* Titlebar Center: Current Channel Active Badge */}
            <div className="titlebar-center hidden sm:flex items-center gap-2">
              <span className="window-title-badge flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                <span className="online-indicator"></span>
                <span className="text-xs font-medium text-gray-200">{currentChannelData.title}</span>
              </span>
            </div>

            {/* Titlebar Right: Font Config, Theme Switch & GitHub Link */}
            <div className="titlebar-right flex items-center gap-2.5">
              
              {/* Interactive Typography Config Button */}
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-gray-200 hover:border-cyan-400"
                    onPress={() => setShowFontModal(true)}
                  >
                    <span className="font-bold text-cyan-400 text-xs">Aa</span>
                    <span className="hidden md:inline font-mono text-[11px] capitalize">{fontFamily}</span>
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content showArrow>
                  <Tooltip.Arrow />
                  <span className="text-xs">Configurar Tipografía de la Web</span>
                </Tooltip.Content>
              </Tooltip>

              {/* Theme Switch */}
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <div className="theme-switch-wrapper flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10 cursor-pointer">
                    <span className="text-xs select-none">{theme === 'dark' ? '🌙' : '☀️'}</span>
                    <Switch
                      isSelected={theme === 'dark'}
                      onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                      size="sm"
                      aria-label="Modo Oscuro"
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch>
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Content showArrow>
                  <Tooltip.Arrow />
                  <span className="text-xs">{theme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}</span>
                </Tooltip.Content>
              </Tooltip>

              {/* GitHub Link */}
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <a
                    href="https://github.com/Totito1313"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-cyan-400 transition-colors flex items-center justify-center"
                    aria-label="GitHub @Totito1313"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  </a>
                </Tooltip.Trigger>
                <Tooltip.Content showArrow>
                  <Tooltip.Arrow />
                  <span className="text-xs">GitHub: @Totito1313</span>
                </Tooltip.Content>
              </Tooltip>

            </div>
          </header>

          {/* Window Body */}
          <div className="window-body">
            
            {/* Left Activity Bar */}
            <aside className="activity-bar">
              <div className="activity-top">
                <Tooltip delay={100}>
                  <Tooltip.Trigger>
                    <div className="activity-brand-item cursor-pointer p-1" onClick={() => setActiveChannel('inicio')}>
                      <Badge color="success" shape="circle" placement="bottom-right">
                        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-1.5 hover:border-cyan-400 transition-colors">
                          <img src="/assets/schwarckdev-logo.svg" alt="SchwarckDev" className="w-full h-full object-contain" />
                        </div>
                      </Badge>
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow>
                    <Tooltip.Arrow />
                    <span className="text-xs font-semibold">SchwarckDev Studio</span>
                  </Tooltip.Content>
                </Tooltip>

                {/* Modern Icon Navigation */}
                <Tooltip delay={100}>
                  <Tooltip.Trigger>
                    <button
                      className={`activity-nav-btn ${activeChannel === 'inicio' ? 'active' : ''}`}
                      onClick={() => setActiveChannel('inicio')}
                      aria-label="Inicio"
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <path d="M3 9.5L12 3l9 6.5v11a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 20.5v-11z" />
                        <path d="M9 22V12h6v10" />
                      </svg>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow>
                    <Tooltip.Arrow />
                    <span className="text-xs">#inicio — Bienvenida</span>
                  </Tooltip.Content>
                </Tooltip>

                <Tooltip delay={100}>
                  <Tooltip.Trigger>
                    <button
                      className={`activity-nav-btn ${activeChannel === 'apps' ? 'active' : ''}`}
                      onClick={() => setActiveChannel('apps')}
                      aria-label="Apps"
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <rect x="3" y="3" width="7" height="7" rx="2" />
                        <rect x="14" y="3" width="7" height="7" rx="2" />
                        <rect x="3" y="14" width="7" height="7" rx="2" />
                        <rect x="14" y="14" width="7" height="7" rx="2" />
                      </svg>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow>
                    <Tooltip.Arrow />
                    <span className="text-xs">#apps — CeroFiao & Lion Fitness</span>
                  </Tooltip.Content>
                </Tooltip>

                <Tooltip delay={100}>
                  <Tooltip.Trigger>
                    <button
                      className={`activity-nav-btn ${activeChannel === 'arquitectura' ? 'active' : ''}`}
                      onClick={() => setActiveChannel('arquitectura')}
                      aria-label="Arquitectura"
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                        <line x1="14" y1="4" x2="10" y2="20" />
                      </svg>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow>
                    <Tooltip.Arrow />
                    <span className="text-xs">#arquitectura — Clean Arch & Room v26</span>
                  </Tooltip.Content>
                </Tooltip>

                <Tooltip delay={100}>
                  <Tooltip.Trigger>
                    <button
                      className={`activity-nav-btn ${activeChannel === 'servicios' ? 'active' : ''}`}
                      onClick={() => setActiveChannel('servicios')}
                      aria-label="Servicios"
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <rect x="2" y="7" width="20" height="14" rx="2" />
                        <path d="M16 7V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v3" />
                        <path d="M12 12v3" />
                      </svg>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow>
                    <Tooltip.Arrow />
                    <span className="text-xs">#servicios — Consultoría & Desarrollo</span>
                  </Tooltip.Content>
                </Tooltip>

                <Tooltip delay={100}>
                  <Tooltip.Trigger>
                    <button
                      className={`activity-nav-btn ${activeChannel === 'dms' ? 'active' : ''}`}
                      onClick={() => setActiveChannel('dms')}
                      aria-label="DMs"
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z" />
                      </svg>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow>
                    <Tooltip.Arrow />
                    <span className="text-xs">DMs — Mensajes Directos</span>
                  </Tooltip.Content>
                </Tooltip>
              </div>

              <div className="activity-bottom">
                <Tooltip delay={100}>
                  <Tooltip.Trigger>
                    <button
                      className="activity-nav-btn"
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      aria-label="Colapsar"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                      </svg>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow>
                    <Tooltip.Arrow />
                    <span className="text-xs">{sidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}</span>
                  </Tooltip.Content>
                </Tooltip>
              </div>
            </aside>

            {/* Channels Sidebar */}
            <nav className={`channels-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
              <div className="sidebar-header flex items-center justify-between px-3 py-3 border-b border-white/5">
                <div className="workspace-info flex items-center gap-2">
                  <span className="workspace-name font-semibold text-sm text-white">SchwarckDev</span>
                  <span className="verified-badge text-cyan-400 text-xs" title="Desarrollador Verificado">✓</span>
                </div>
                <div className="quick-status-btn flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[11px] font-medium">Online</span>
                </div>
              </div>

              <div className="sidebar-scrollable px-2 py-2">
                
                {/* Apps Section */}
                <div className="sidebar-group">
                  <div className="sidebar-group-title text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5 flex items-center justify-between">
                    <span>Aplicaciones</span>
                    <span className="text-[10px] text-gray-400 font-mono">2 LIVE</span>
                  </div>
                  <div className="sidebar-group-items space-y-1">
                    <div
                      className="sidebar-app-item flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => { setActiveChannel('apps'); setActiveTab('messages'); setMobileOpen(false); }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-cyan-500/10 p-1 border border-cyan-500/20 flex items-center justify-center">
                          <img src="/assets/cerofiao-logo.svg" alt="CeroFiao" className="w-full h-full object-contain" />
                        </div>
                        <span className="sidebar-app-name text-xs font-medium text-gray-200">CeroFiao</span>
                      </div>
                      <Chip size="sm" variant="soft" className="text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">Blue v26</Chip>
                    </div>

                    <div
                      className="sidebar-app-item flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => { setActiveChannel('apps'); setActiveTab('messages'); setMobileOpen(false); }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-amber-500/10 p-0.5 border border-amber-500/20 flex items-center justify-center">
                          <img src="/assets/lionfitness-logo.png" alt="Lion Fitness" className="w-full h-full object-contain" />
                        </div>
                        <span className="sidebar-app-name text-xs font-medium text-gray-200">Lion Fitness</span>
                      </div>
                      <Chip size="sm" variant="soft" className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30">OneUI</Chip>
                    </div>

                    <div
                      className="sidebar-app-item flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => { setActiveChannel('apps'); setActiveTab('mockups'); setMobileOpen(false); }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-purple-500/10 p-1 border border-purple-500/20 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                          </svg>
                        </div>
                        <span className="sidebar-app-name text-xs font-medium text-gray-200">Galería Mockups</span>
                      </div>
                      <Chip size="sm" variant="soft" className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30">NUEVO</Chip>
                    </div>
                  </div>
                </div>

                <Separator className="my-2.5 opacity-10" />

                {/* Channels Section */}
                <div className="sidebar-group">
                  <div className="sidebar-group-title text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">
                    <span>Canales</span>
                  </div>
                  <div className="sidebar-group-items space-y-1">
                    {['inicio', 'apps', 'arquitectura', 'servicios'].map(ch => (
                      <button
                        key={ch}
                        className={`channel-link w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeChannel === ch ? 'active text-cyan-300 bg-cyan-500/10 border border-cyan-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                        onClick={() => { setActiveChannel(ch); setMobileOpen(false); }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-mono">#</span>
                          <span className="capitalize">{ch}</span>
                        </div>
                        {ch === 'apps' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                            2
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator className="my-2.5 opacity-10" />

                {/* DMs Section */}
                <div className="sidebar-group">
                  <div className="sidebar-group-title text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">
                    <span>Mensaje Directo</span>
                  </div>
                  <div className="sidebar-group-items">
                    <button
                      className={`channel-link dm-link w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeChannel === 'dms' ? 'active text-cyan-300 bg-cyan-500/10 border border-cyan-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                      onClick={() => { setActiveChannel('dms'); setMobileOpen(false); }}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>Alan (SchwarckDev)</span>
                    </button>
                  </div>
                </div>

                <Separator className="my-2.5 opacity-10" />

                {/* Connections Section */}
                <div className="sidebar-group">
                  <div className="sidebar-group-title text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">
                    <span>Enlaces Rápidos</span>
                  </div>
                  <div className="sidebar-group-items space-y-1">
                    <a
                      href="https://github.com/Totito1313"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sidebar-ext-link flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                      <span>GitHub (@Totito1313)</span>
                    </a>
                    
                    <button
                      className="sidebar-ext-link w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                      onClick={copyEmail}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      <span>Copiar alanleones2013@...</span>
                    </button>
                  </div>
                </div>

              </div>
            </nav>

            {/* Main Channel Content Workspace */}
            <main className="channel-workspace flex-1 flex flex-col min-w-0">
              
              {/* Channel Header with Dynamic Tabs */}
              <div className="channel-nav-header flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/20">
                <div className="channel-header-title-box">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-mono font-bold text-lg">#</span>
                    <h1 className="text-base font-bold text-white capitalize">{currentChannelData.name}</h1>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{currentChannelData.topic}</p>
                </div>

                {/* Header Action Tabs */}
                <div className="channel-tabs-bar flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
                  <button
                    className={`channel-tab-btn px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'messages' ? 'active bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setActiveTab('messages')}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                    <span>Contenido</span>
                  </button>

                  {activeChannel === 'apps' && (
                    <button
                      className={`channel-tab-btn px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'mockups' ? 'active bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                      onClick={() => setActiveTab('mockups')}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                      <span>Capturas & Mockups</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                        8
                      </span>
                    </button>
                  )}

                  <button
                    className={`channel-tab-btn px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'files' ? 'active bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setActiveTab('files')}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span>Archivos & Specs</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                      5
                    </span>
                  </button>
                </div>
              </div>

              {/* Scrollable Content Pane with HeroUI ScrollShadow */}
              <ScrollShadow className="channel-content-pane flex-1 p-5 overflow-y-auto" ref={paneRef}>
                
                {/* ==============================================================
                    TAB 1: MESSAGES / SHOWCASE CONTENT
                    ============================================================== */}
                {activeTab === 'messages' && (
                  <div className="messages-stream space-y-6">
                    
                    {/* ====== CHANNEL: INICIO ====== */}
                    {activeChannel === 'inicio' && (
                      <section className="channel-view-section space-y-5">
                        {/* HeroUI Alert Banner */}
                        <Alert status="accent" className="border border-cyan-500/30 bg-cyan-500/5">
                          <Alert.Indicator />
                          <Alert.Content>
                            <Alert.Title className="text-sm font-semibold text-cyan-300">
                              Ingeniería Móvil Android Nativo & Jetpack Compose
                            </Alert.Title>
                            <Alert.Description className="text-xs text-gray-300 mt-0.5">
                              Entorno de desarrollo enfocado en arquitectura limpia (MVI/Clean Architecture), rendimiento a <strong>120 FPS</strong>, soberanía de datos offline y diseño sin plantillas.
                            </Alert.Description>
                          </Alert.Content>
                        </Alert>

                        <article className="chat-message p-4 rounded-2xl bg-white/5 border border-white/10">
                          <div className="flex items-start gap-3.5">
                            <div className="p-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
                              <img src="/assets/schwarckdev-logo.svg" alt="Alan" className="w-9 h-9 object-contain" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="font-semibold text-sm text-white">Alan (SchwarckDev)</span>
                                <Chip size="sm" variant="soft" className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  INGENIERO ANDROID
                                </Chip>
                                <span className="text-xs text-gray-500">Hoy</span>
                              </div>

                              <div className="text-sm text-gray-300 space-y-3 leading-relaxed">
                                <p>
                                  ¡Hola! Soy <strong>Alan</strong>, desarrollador de software móvil independiente detrás de la marca <strong>SchwarckDev</strong>.
                                  Especializado en ingeniería móvil nativa con <span className="tag-pill">#kotlin-2.0</span> y <span className="tag-pill">#jetpack-compose</span>.
                                </p>
                                <p>
                                  Construyo aplicaciones móviles sin atajos: <strong>sin plantillas genéricas</strong>, con rendimiento nativo implacable (60/120 FPS),
                                  sistemas de diseño propios y privacidad total como estándar fundamental.
                                </p>

                                <div className="metrics-grid grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                                  <div className="metric-box p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <span className="block text-xl font-bold text-cyan-400 font-mono">2+</span>
                                    <span className="text-[11px] text-gray-400">Apps en Producción</span>
                                  </div>
                                  <div className="metric-box p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <span className="block text-xl font-bold text-emerald-400 font-mono">100%</span>
                                    <span className="text-[11px] text-gray-400">Kotlin Nativo</span>
                                  </div>
                                  <div className="metric-box p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <span className="block text-xl font-bold text-teal-400 font-mono">120 FPS</span>
                                    <span className="text-[11px] text-gray-400">UDF & Frame 0</span>
                                  </div>
                                  <div className="metric-box p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                                    <span className="block text-xl font-bold text-purple-400 font-mono">Room v26</span>
                                    <span className="text-[11px] text-gray-400">Ledger Persistente</span>
                                  </div>
                                </div>
                              </div>

                              {/* Interactive Reactions */}
                              <div className="msg-reactions pt-4">
                                <ButtonGroup size="sm" variant="secondary">
                                  <Tooltip delay={0}>
                                    <Tooltip.Trigger>
                                      <Button
                                        className={`reaction-pill ${reactions.fire.reacted ? 'reacted' : ''}`}
                                        onPress={() => toggleReaction('fire')}
                                      >
                                        <span className="reaction-emoji">🔥</span>
                                        <span className="reaction-count">{reactions.fire.count}</span>
                                      </Button>
                                    </Tooltip.Trigger>
                                    <Tooltip.Content showArrow>
                                      <Tooltip.Arrow />
                                      <span className="text-xs">Reaccionar 🔥</span>
                                    </Tooltip.Content>
                                  </Tooltip>

                                  <Tooltip delay={0}>
                                    <Tooltip.Trigger>
                                      <Button
                                        className={`reaction-pill ${reactions.rocket.reacted ? 'reacted' : ''}`}
                                        onPress={() => toggleReaction('rocket')}
                                      >
                                        <span className="reaction-emoji">🚀</span>
                                        <span className="reaction-count">{reactions.rocket.count}</span>
                                      </Button>
                                    </Tooltip.Trigger>
                                    <Tooltip.Content showArrow>
                                      <Tooltip.Arrow />
                                      <span className="text-xs">Reaccionar 🚀</span>
                                    </Tooltip.Content>
                                  </Tooltip>

                                  <Tooltip delay={0}>
                                    <Tooltip.Trigger>
                                      <Button
                                        className={`reaction-pill ${reactions.heart.reacted ? 'reacted' : ''}`}
                                        onPress={() => toggleReaction('heart')}
                                      >
                                        <span className="reaction-emoji">💙</span>
                                        <span className="reaction-count">{reactions.heart.count}</span>
                                      </Button>
                                    </Tooltip.Trigger>
                                    <Tooltip.Content showArrow>
                                      <Tooltip.Arrow />
                                      <span className="text-xs">Reaccionar 💙</span>
                                    </Tooltip.Content>
                                  </Tooltip>
                                </ButtonGroup>
                              </div>
                            </div>
                          </div>
                        </article>

                        <article className="chat-message p-4 rounded-2xl bg-white/5 border border-white/10">
                          <div className="flex items-start gap-3.5">
                            <div className="p-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
                              <img src="/assets/schwarckdev-logo.svg" alt="Alan" className="w-9 h-9 object-contain" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="font-semibold text-sm text-white">Alan (SchwarckDev)</span>
                                <span className="text-xs text-gray-500">Guía de navegación</span>
                              </div>
                              <div className="text-sm text-gray-300 space-y-2">
                                <p>Explora este espacio a través de sus secciones especializadas:</p>
                                <ul className="bullet-list space-y-1.5 pl-4 list-disc text-gray-400">
                                  <li><strong className="text-cyan-300 cursor-pointer" onClick={() => { setActiveChannel('apps'); setActiveTab('messages'); }}>#apps:</strong> Showcase completo de <em>CeroFiao</em> (versión azul) y <em>Lion Fitness</em>.</li>
                                  <li><strong className="text-purple-300 cursor-pointer" onClick={() => { setActiveChannel('apps'); setActiveTab('mockups'); }}>Capturas & Mockups:</strong> Galería visual interactiva con pantallas completas de las apps.</li>
                                  <li><strong className="text-teal-300 cursor-pointer" onClick={() => setActiveChannel('arquitectura')}>#arquitectura:</strong> Clean Architecture, MVI y persistencia Room SQLite v26.</li>
                                  <li><strong className="text-emerald-300 cursor-pointer" onClick={() => setActiveChannel('servicios')}>#servicios:</strong> Modalidades para consultoría, nuevos desarrollos y contratos.</li>
                                  <li><strong className="text-yellow-300 cursor-pointer" onClick={() => setActiveChannel('dms')}>DMs:</strong> Canales de comunicación directa para cotizaciones y proyectos.</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </article>
                      </section>
                    )}

                    {/* ====== CHANNEL: APPS ====== */}
                    {activeChannel === 'apps' && (
                      <section className="channel-view-section space-y-6">
                        
                        {/* APP 1: CEROFIAO (BLUE VERSION) */}
                        <Card className="project-card-custom border border-cyan-500/30 bg-cyan-950/10 rounded-2xl overflow-hidden p-5">
                          <Card.Header className="project-card-header flex items-center justify-between pb-3 border-b border-white/5">
                            <div className="flex items-center gap-3.5">
                              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 p-2 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/5">
                                <img
                                  src="/assets/cerofiao-logo.svg"
                                  alt="CeroFiao Logo Azul"
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-xl font-bold text-white">CeroFiao</h3>
                                  <Chip size="sm" variant="soft" className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px]">
                                    VERSIÓN AZUL OFICIAL
                                  </Chip>
                                </div>
                                <span className="text-xs text-gray-400">Control financiero: deudas, tasas oficiales en tiempo real y libro mayor</span>
                              </div>
                            </div>
                            <Chip size="sm" variant="soft" className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs">
                              En Producción
                            </Chip>
                          </Card.Header>

                          <Card.Content className="py-4 space-y-4">
                            <p className="text-sm text-gray-300 leading-relaxed">
                              Plataforma integral concebida para erradicar el desorden en economías multi-moneda (USD / VES / EUR).
                              Integra seguimiento de cuentas por cobrar y pagar ("fiao"), tasas oficiales sincronizadas en tiempo real,
                              presupuestos por categoría y persistencia soberana local sobre Room SQLite v26.
                            </p>

                            {/* Performance Gauges */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-black/30 border border-white/5">
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-400">Rendimiento de Renderizado</span>
                                  <span className="font-semibold text-cyan-400 font-mono">120 FPS Estable</span>
                                </div>
                                <ProgressBar aria-label="FPS" value={99.8} className="w-full">
                                  <ProgressBar.Track className="h-1.5 bg-white/10 rounded-full">
                                    <ProgressBar.Fill className="h-full bg-cyan-400 rounded-full" />
                                  </ProgressBar.Track>
                                </ProgressBar>
                              </div>
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-400">Cobertura de Casos de Uso</span>
                                  <span className="font-semibold text-emerald-400 font-mono">94% Cobertura</span>
                                </div>
                                <ProgressBar aria-label="Coverage" value={94} className="w-full">
                                  <ProgressBar.Track className="h-1.5 bg-white/10 rounded-full">
                                    <ProgressBar.Fill className="h-full bg-emerald-400 rounded-full" />
                                  </ProgressBar.Track>
                                </ProgressBar>
                              </div>
                            </div>

                            <div className="features-pill-grid grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 text-gray-300">
                                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                                <span><strong>Control de Deudas:</strong> Abonos y estados de cobro</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 text-gray-300">
                                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                                <span><strong>Multi-Divisa & Tasas:</strong> Conversión oficial en vivo</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 text-gray-300">
                                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                                <span><strong>Alcancía & Metas:</strong> Proyección de ahorro visual</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 text-gray-300">
                                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                                <span><strong>Privacidad 100%:</strong> Base local + exportación CSV</span>
                              </div>
                            </div>

                            <div className="project-stack-row flex flex-wrap gap-1.5 pt-1">
                              {['Kotlin 2.0', 'Jetpack Compose', 'Clean Architecture', 'Room DB (v26)', 'StateFlow', 'Hilt DI'].map(t => (
                                <Chip key={t} size="sm" variant="outline" className="text-xs text-cyan-300 border-cyan-500/30">
                                  {t}
                                </Chip>
                              ))}
                            </div>
                          </Card.Content>

                          <Card.Footer className="project-actions flex flex-wrap gap-2.5 pt-3 border-t border-white/5">
                            <Button
                              variant="primary"
                              className="bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-bold px-4"
                              onPress={() => setSelectedSpec('cerofiao')}
                            >
                              Ver Módulos & Arquitectura Completa
                            </Button>
                            <Button
                              variant="outline"
                              className="border-white/20 text-gray-300 hover:border-cyan-400"
                              onPress={() => setActiveTab('mockups')}
                            >
                              Ver Galería de Mockups (FHD+)
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-gray-400 hover:text-white"
                              onPress={() => copyStack('CeroFiao Stack: Kotlin 2.0, Compose, Clean Architecture, Room v26, StateFlow')}
                            >
                              Copiar Stack
                            </Button>
                          </Card.Footer>
                        </Card>

                        {/* APP 2: LION FITNESS (UNCROPPED & PADDED LOGO) */}
                        <Card className="project-card-custom border border-amber-500/30 bg-amber-950/10 rounded-2xl overflow-hidden p-5">
                          <Card.Header className="project-card-header flex items-center justify-between pb-3 border-b border-white/5">
                            <div className="flex items-center gap-3.5">
                              {/* Logo with padding to ensure mane is 100% visible and uncropped */}
                              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 p-1 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/5">
                                <img
                                  src="/assets/lionfitness-logo.png"
                                  alt="Lion Fitness Logo Completo"
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-xl font-bold text-white">Lion Fitness</h3>
                                  <Chip size="sm" variant="soft" className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                                    ALTO RENDIMIENTO
                                  </Chip>
                                </div>
                                <span className="text-xs text-gray-400">Entrenamiento de fuerza, sobrecarga progresiva y háptica de alta fidelidad</span>
                              </div>
                            </div>
                            <Chip size="sm" variant="soft" className="bg-teal-500/15 text-teal-300 border border-teal-500/30 text-xs">
                              Android Nativo
                            </Chip>
                          </Card.Header>

                          <Card.Content className="py-4 space-y-4">
                            <p className="text-sm text-gray-300 leading-relaxed">
                              Diseñada para atletas y levantadores de fuerza que exigen agilidad máxima.
                              Ofrece registro instantáneo de series, cálculo automático de 1RM y RPE,
                              cronómetro de descanso con feedback háptico que te avisa sin necesidad de mirar la pantalla,
                              y un sistema de diseño visual enérgico con tipografía Anton e inspiración OneUI.
                            </p>

                            {/* Performance Gauges */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-black/30 border border-white/5">
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-400">Sincronización Háptica</span>
                                  <span className="font-semibold text-amber-400 font-mono">100% Precisa</span>
                                </div>
                                <ProgressBar aria-label="Haptic" value={100} className="w-full">
                                  <ProgressBar.Track className="h-1.5 bg-white/10 rounded-full">
                                    <ProgressBar.Fill className="h-full bg-amber-400 rounded-full" />
                                  </ProgressBar.Track>
                                </ProgressBar>
                              </div>
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-400">Arquitectura Offline-First</span>
                                  <span className="font-semibold text-teal-400 font-mono">100% Sin Nube</span>
                                </div>
                                <ProgressBar aria-label="Offline" value={100} className="w-full">
                                  <ProgressBar.Track className="h-1.5 bg-white/10 rounded-full">
                                    <ProgressBar.Fill className="h-full bg-teal-400 rounded-full" />
                                  </ProgressBar.Track>
                                </ProgressBar>
                              </div>
                            </div>

                            <div className="features-pill-grid grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 text-gray-300">
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                <span><strong>Sobrecarga Progresiva:</strong> Gráficos de volumen y tonelaje</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 text-gray-300">
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                <span><strong>Alertas Hápticas:</strong> Cronómetro con vibraciones exactas</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 text-gray-300">
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                <span><strong>Diseño Energético:</strong> Anton typography + OneUI tokens</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 text-gray-300">
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                <span><strong>100% Offline:</strong> Registro directo en el gimnasio sin lag</span>
                              </div>
                            </div>

                            <div className="project-stack-row flex flex-wrap gap-1.5 pt-1">
                              {['Kotlin', 'Jetpack Compose', 'Haptic API', 'Room SQLite', 'OneUI Custom Tokens', 'Anton Font'].map(t => (
                                <Chip key={t} size="sm" variant="outline" className="text-xs text-amber-300 border-amber-500/30">
                                  {t}
                                </Chip>
                              ))}
                            </div>
                          </Card.Content>

                          <Card.Footer className="project-actions flex flex-wrap gap-2.5 pt-3 border-t border-white/5">
                            <Button
                              variant="primary"
                              className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold px-4"
                              onPress={() => setSelectedSpec('lionfitness')}
                            >
                              Ver Ficha Técnica Lion Fitness
                            </Button>
                            <Button
                              variant="outline"
                              className="border-white/20 text-gray-300 hover:border-amber-400"
                              onPress={() => { setActiveTab('mockups'); setActiveMockupApp('lionfitness'); }}
                            >
                              Ver Galería de Mockups (FHD+)
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-gray-400 hover:text-white"
                              onPress={() => copyStack('Lion Fitness Stack: Kotlin, Compose, Haptic API, Room SQLite, Anton')}
                            >
                              Copiar Stack
                            </Button>
                          </Card.Footer>
                        </Card>

                      </section>
                    )}

                    {/* ====== CHANNEL: ARQUITECTURA ====== */}
                    {activeChannel === 'arquitectura' && (
                      <section className="channel-view-section space-y-5">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-white">Pilares de Ingeniería & Arquitectura</h3>
                              <p className="text-xs text-gray-400">Estándares implementados en todos los desarrollos de SchwarckDev</p>
                            </div>
                            <AvatarGroup size="sm" className="hidden sm:flex">
                              <Avatar className="p-1 bg-cyan-500/10 border border-cyan-500/20">
                                <Avatar.Image src="/assets/cerofiao-logo.svg" alt="CeroFiao" />
                                <Avatar.Fallback>CF</Avatar.Fallback>
                              </Avatar>
                              <Avatar className="p-0.5 bg-amber-500/10 border border-amber-500/20">
                                <Avatar.Image src="/assets/lionfitness-logo.png" alt="Lion Fitness" />
                                <Avatar.Fallback>LF</Avatar.Fallback>
                              </Avatar>
                              <Avatar className="p-1 bg-white/5 border border-white/10">
                                <Avatar.Image src="/assets/schwarckdev-logo.svg" alt="SchwarckDev" />
                                <Avatar.Fallback>SD</Avatar.Fallback>
                              </Avatar>
                            </AvatarGroup>
                          </div>

                          <div className="arch-cards-grid grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <Card className="arch-card p-4 rounded-xl bg-black/30 border border-white/5" variant="secondary">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono">01</span>
                                <h4 className="text-sm font-bold text-white">Clean Architecture & Modularización</h4>
                              </div>
                              <p className="text-xs text-gray-300 leading-relaxed">
                                Separación estricta entre capas: <code>core-domain</code> (casos de uso puros y reglas de negocio),
                                <code>core-data</code> (repositorios y fuentes de datos), <code>core-database</code> (Room DAO atómicos) y módulos <code>feature-*</code> aislados e independientes.
                              </p>
                            </Card>

                            <Card className="arch-card p-4 rounded-xl bg-black/30 border border-white/5" variant="secondary">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono">02</span>
                                <h4 className="text-sm font-bold text-white">Unidirectional Data Flow (UDF) & MVI</h4>
                              </div>
                              <p className="text-xs text-gray-300 leading-relaxed">
                                Estados inmutables modelados con <code>StateFlow</code> y <code>SharedFlow</code>.
                                Cada evento de usuario (Intents) es procesado en el ViewModel y devuelto como un único State consolidado.
                              </p>
                            </Card>

                            <Card className="arch-card p-4 rounded-xl bg-black/30 border border-white/5" variant="secondary">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono">03</span>
                                <h4 className="text-sm font-bold text-white">Sistemas de Diseño Propios (No Genéricos)</h4>
                              </div>
                              <p className="text-xs text-gray-300 leading-relaxed">
                                Tokens de diseño personalizados (tipografías como Anton/OneUI Sans, animaciones spring duales a 120 FPS, docks cinemáticos e islas de acción Frame 0).
                              </p>
                            </Card>

                            <Card className="arch-card p-4 rounded-xl bg-black/30 border border-white/5" variant="secondary">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 font-mono">04</span>
                                <h4 className="text-sm font-bold text-white">Persistencia Robusta & Migraciones Auditadas</h4>
                              </div>
                              <p className="text-xs text-gray-300 leading-relaxed">
                                Bases de datos SQLite relacionales con Room, esquemas inmutables tipo Ledger, índices optimizados
                                y 26 migraciones auditadas con tests unitarios.
                              </p>
                            </Card>
                          </div>

                          {/* HeroUI Accordion Component */}
                          <div className="mt-4 p-4 rounded-xl bg-black/40 border border-white/10">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2 flex items-center gap-2">
                              <span>⚙️</span> Desglose Arquitectónico Detallado
                            </h4>
                            <Accordion className="w-full">
                              <Accordion.Item id="item-modules">
                                <Accordion.Heading>
                                  <Accordion.Trigger className="text-sm font-medium py-2.5 text-gray-200 hover:text-white flex justify-between w-full">
                                    <span>Estructura Multi-Module (Feature-First)</span>
                                    <Accordion.Indicator />
                                  </Accordion.Trigger>
                                </Accordion.Heading>
                                <Accordion.Panel>
                                  <Accordion.Body className="text-xs text-gray-300 pb-3 leading-relaxed">
                                    Cada feature (transactions, debt, exchange-rates, budget) compila de forma aislada, reduciendo tiempos de build hasta un 65% y asegurando encapsulamiento estricto sin dependencias circulares.
                                  </Accordion.Body>
                                </Accordion.Panel>
                              </Accordion.Item>

                              <Accordion.Item id="item-migrations">
                                <Accordion.Heading>
                                  <Accordion.Trigger className="text-sm font-medium py-2.5 text-gray-200 hover:text-white flex justify-between w-full">
                                    <span>Estrategia de Migraciones Room (v1 → v26)</span>
                                    <Accordion.Indicator />
                                  </Accordion.Trigger>
                                </Accordion.Heading>
                                <Accordion.Panel>
                                  <Accordion.Body className="text-xs text-gray-300 pb-3 leading-relaxed">
                                    26 migraciones secuenciales verificadas mediante tests de integración automatizados con MigrationTestHelper. Garantía absoluta de cero pérdida de registros financieros históricos.
                                  </Accordion.Body>
                                </Accordion.Panel>
                              </Accordion.Item>

                              <Accordion.Item id="item-rendering">
                                <Accordion.Heading>
                                  <Accordion.Trigger className="text-sm font-medium py-2.5 text-gray-200 hover:text-white flex justify-between w-full">
                                    <span>Cinemática de UI & Frame 0 Reactivity</span>
                                    <Accordion.Indicator />
                                  </Accordion.Trigger>
                                </Accordion.Heading>
                                <Accordion.Panel>
                                  <Accordion.Body className="text-xs text-gray-300 pb-3 leading-relaxed">
                                    Optimizaciones sobre Jetpack Compose para recomposiciones inteligentes (Skippable Composable Lambdas) y física dual-spring en docks flotantes a 120 FPS.
                                  </Accordion.Body>
                                </Accordion.Panel>
                              </Accordion.Item>
                            </Accordion>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* ====== CHANNEL: SERVICIOS ====== */}
                    {activeChannel === 'servicios' && (
                      <section className="channel-view-section space-y-5">
                        {/* HeroUI Alert for Hiring Status */}
                        <Alert status="accent" className="border border-emerald-500/30 bg-emerald-500/5">
                          <Alert.Indicator />
                          <Alert.Content>
                            <Alert.Title className="text-sm font-semibold text-emerald-300">
                              Disponibilidad para Proyectos & Consultoría (2026)
                            </Alert.Title>
                            <Alert.Description className="text-xs text-gray-300 mt-0.5">
                              Abierto para proyectos Android nativos de punta a punta, contratos de arquitectura móvil y modernización a Jetpack Compose.
                            </Alert.Description>
                          </Alert.Content>
                        </Alert>

                        <div className="services-list-container space-y-3.5">
                          {[
                            {
                              icon: '📱',
                              badge: 'CORE SERVICE',
                              badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
                              title: 'Desarrollo Android Nativo de Punta a Punta',
                              desc: 'Creación de aplicaciones completas desde la fase de arquitectura de dominio y diseño de bases de datos Room, hasta interfaces fluidas en Jetpack Compose, integración de APIs y despliegue final en Google Play Store.'
                            },
                            {
                              icon: '⚡',
                              badge: 'MODERNIZACIÓN',
                              badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                              title: 'Refactorización & Migración a Jetpack Compose',
                              desc: 'Modernización de bases de código legacy (XML Views, AsyncTask, Java) hacia Kotlin idiomático y Compose declarativo con rendimiento de 120 FPS garantizado y reducción drástica de deuda técnica.'
                            },
                            {
                              icon: '🎨',
                              badge: 'DESIGN SYSTEM',
                              badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
                              title: 'Sistemas de Diseño & Componentes Nativo',
                              desc: 'Diseño e implementación de sistemas de tokens, temas adaptativos Dark/Light, docks flotantes cinemáticos y animaciones reactivas a medida sin depender de plantillas prediseñadas.'
                            },
                            {
                              icon: '🛡️',
                              badge: 'AUDITORÍA',
                              badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                              title: 'Auditoría Técnica, Performance & Room SQLite',
                              desc: 'Análisis de fugas de memoria con LeakCanary, optimización de queries SQL complejas, índices de base de datos, planes de migración de datos sin pérdida y benchmarks de recomposición en Compose.'
                            }
                          ].map((srv, idx) => (
                            <Card key={idx} className="service-row p-4 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-400/40 transition-colors" variant="secondary">
                              <div className="flex items-start gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg flex-shrink-0">
                                  {srv.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-sm font-bold text-white">{srv.title}</h4>
                                    <Chip size="sm" variant="soft" className={`text-[9px] border ${srv.badgeColor}`}>
                                      {srv.badge}
                                    </Chip>
                                  </div>
                                  <p className="text-xs text-gray-300 leading-relaxed">{srv.desc}</p>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>

                        {/* Engineering Guarantees Banner */}
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                            Garantías de Entrega SchwarckDev
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-300">
                            <div className="p-2 rounded bg-white/5 flex items-center gap-1.5">
                              <span className="text-emerald-400">✓</span> 0 Fugas de Memoria
                            </div>
                            <div className="p-2 rounded bg-white/5 flex items-center gap-1.5">
                              <span className="text-cyan-400">✓</span> 120 FPS Estables
                            </div>
                            <div className="p-2 rounded bg-white/5 flex items-center gap-1.5">
                              <span className="text-teal-400">✓</span> Privacidad & Offline
                            </div>
                            <div className="p-2 rounded bg-white/5 flex items-center gap-1.5">
                              <span className="text-purple-400">✓</span> Clean Code & Tests
                            </div>
                          </div>
                        </div>

                        {/* Contact CTA */}
                        <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/30 to-blue-950/30 border border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div>
                            <h4 className="text-base font-bold text-white">¿Tienes un proyecto o consulta técnica?</h4>
                            <p className="text-xs text-gray-400 mt-0.5">Conversemos directamente sobre el alcance, arquitectura y estimaciones.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="primary"
                              className="bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-bold px-4"
                              onPress={() => setActiveChannel('dms')}
                            >
                              Contactar en DMs
                            </Button>
                            <Button
                              variant="outline"
                              className="border-white/20 text-gray-300"
                              onPress={copyEmail}
                            >
                              Copiar Correo
                            </Button>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* ====== CHANNEL: DMS ====== */}
                    {activeChannel === 'dms' && (
                      <section className="channel-view-section space-y-5">
                        <article className="chat-message p-5 rounded-2xl bg-white/5 border border-white/10">
                          <div className="flex items-start gap-3.5">
                            <div className="p-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
                              <img src="/assets/schwarckdev-logo.svg" alt="Alan" className="w-10 h-10 object-contain" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-white">Alan / SchwarckDev</span>
                                <Chip size="sm" variant="soft" className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                                  DIRECT MESSAGE
                                </Chip>
                                <span className="text-xs text-emerald-400 font-mono">● Online</span>
                              </div>

                              <p className="text-sm text-gray-300 leading-relaxed">
                                ¡Bienvenido al canal de contacto directo! Si estás evaluando un proyecto Android nativo, una auditoría técnica o una colaboración, puedes contactarme directamente por cualquiera de estos canales:
                              </p>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <a
                                  href="mailto:alanleones2013@gmail.com?subject=[SchwarckDev]%20Consulta%20de%20Proyecto"
                                  className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors flex items-center justify-between text-decoration-none group"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-lg">📧</span>
                                    <div>
                                      <span className="block text-xs font-bold text-white">Enviar Correo Directo</span>
                                      <span className="text-[11px] text-gray-400 font-mono">alanleones2013@gmail.com</span>
                                    </div>
                                  </div>
                                  <span className="text-cyan-400 text-sm group-hover:translate-x-1 transition-transform">→</span>
                                </a>

                                <a
                                  href="https://github.com/Totito1313"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-between text-decoration-none group"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-lg">🐙</span>
                                    <div>
                                      <span className="block text-xs font-bold text-white">Perfil en GitHub</span>
                                      <span className="text-[11px] text-gray-400 font-mono">@Totito1313</span>
                                    </div>
                                  </div>
                                  <span className="text-gray-300 text-sm group-hover:translate-x-1 transition-transform">→</span>
                                </a>
                              </div>

                              <div className="pt-2 flex items-center gap-3">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  className="bg-cyan-500 text-gray-950 font-bold"
                                  onPress={() => {
                                    window.location.href = "mailto:alanleones2013@gmail.com?subject=[SchwarckDev]%20Consulta%20de%20Proyecto";
                                  }}
                                >
                                  Abrir Cliente de Correo
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-white/20 text-gray-300"
                                  onPress={copyEmail}
                                >
                                  Copiar Dirección de Correo
                                </Button>
                              </div>
                            </div>
                          </div>
                        </article>
                      </section>
                    )}

                  </div>
                )}

                {/* ==============================================================
                    TAB 2: CAPTURAS & MOCKUPS (SCREENSHOTS GALLERY)
                    ============================================================== */}
                {activeTab === 'mockups' && (
                  <div className="mockups-explorer space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <span>📱</span> Galería de Pantallas & Mockups de Aplicaciones
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Visualización de pantallas completas sobre marcos de dispositivos Android FHD+ (1080x2400).
                        </p>
                      </div>

                      {/* App Mockup Filter */}
                      <ButtonGroup size="sm">
                        <Button
                          variant={activeMockupApp === 'cerofiao' ? 'primary' : 'outline'}
                          className={activeMockupApp === 'cerofiao' ? 'bg-cyan-500 text-gray-950 font-bold' : 'border-white/20 text-gray-300'}
                          onPress={() => setActiveMockupApp('cerofiao')}
                        >
                          CeroFiao (4 Pantallas)
                        </Button>
                        <Button
                          variant={activeMockupApp === 'lionfitness' ? 'primary' : 'outline'}
                          className={activeMockupApp === 'lionfitness' ? 'bg-amber-500 text-gray-950 font-bold' : 'border-white/20 text-gray-300'}
                          onPress={() => setActiveMockupApp('lionfitness')}
                        >
                          Lion Fitness (4 Pantallas)
                        </Button>
                      </ButtonGroup>
                    </div>

                    {/* Placeholder Notice for Future Screenshots */}
                    <Alert status="accent" className="border border-purple-500/30 bg-purple-500/5">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title className="text-xs font-semibold text-purple-300">
                          Espacio preparado para capturas y grabaciones
                        </Alert.Title>
                        <Alert.Description className="text-xs text-gray-300">
                          Esta sección renderiza los mockups interactivos de alta fidelidad. Puedes colocar en cualquier momento capturas directas de Google Play o videos de demostración en los contenedores.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>

                    {/* CEROFIAO MOCKUPS */}
                    {activeMockupApp === 'cerofiao' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          {
                            title: 'Dashboard & Balance',
                            screen: '01',
                            tag: 'MULTI-DIVISA',
                            accent: '#06b6d4',
                            desc: 'Balance consolidado en USD, VES y EUR con triangulación en tiempo real.',
                            details: ['Tarjetas de cuenta líquida', 'Ticker oficial BCV en vivo', 'Selector de período fiscal']
                          },
                          {
                            title: 'Libro Mayor Inmutable',
                            screen: '02',
                            tag: 'LEDGER ENGINE',
                            accent: '#0071bc',
                            desc: 'Registro de partida doble inmutable con snapshot de la tasa cambiaria.',
                            details: ['Gastos e ingresos instantáneos', 'Categorías dinámicas', 'Filtros por moneda original']
                          },
                          {
                            title: 'Cuentas por Cobrar & Deudas',
                            screen: '03',
                            tag: 'CONTROL FIAO',
                            accent: '#38bdf8',
                            desc: 'Seguimiento riguroso de deudas activas, amortizaciones y estados de cobro.',
                            details: ['Lista de clientes / acreedores', 'Historial de abonos parciales', 'Recordatorios de vencimiento']
                          },
                          {
                            title: 'Triangulador de Tasas',
                            screen: '04',
                            tag: 'ALGORITMO BCV',
                            accent: '#2dd4bf',
                            desc: 'Conversión matemática exacta con cero pérdida por punto flotante.',
                            details: ['Tasas oficiales automáticas', 'Cálculo de recibo en vivo', 'Exportación de balances']
                          }
                        ].map((m, idx) => (
                          <div
                            key={idx}
                            className="phone-mockup-card rounded-2xl bg-black/40 border border-white/10 hover:border-cyan-400/50 transition-all p-3.5 flex flex-col cursor-pointer"
                            onClick={() => setSelectedMockupPreview({ ...m, app: 'CeroFiao' })}
                          >
                            {/* Device Frame */}
                            <div className="device-frame rounded-2xl bg-gray-900 border-2 border-gray-700/60 p-2.5 mb-3 shadow-xl relative overflow-hidden aspect-[9/16] flex flex-col justify-between">
                              {/* Punch hole camera & status bar */}
                              <div className="flex justify-between items-center text-[10px] text-gray-400 px-1 pt-0.5">
                                <span>12:00</span>
                                <div className="w-2.5 h-2.5 rounded-full bg-black border border-gray-700"></div>
                                <div className="flex items-center gap-1 font-mono text-[9px]">
                                  <span>5G</span>
                                  <span>100%</span>
                                </div>
                              </div>

                              {/* Screen Simulation */}
                              <div className="flex-1 my-2 rounded-xl bg-gradient-to-b from-gray-950 via-cyan-950/20 to-gray-950 p-2.5 flex flex-col justify-between border border-white/5">
                                <div className="flex items-center justify-between">
                                  <div className="w-5 h-5 rounded bg-cyan-500/20 p-0.5">
                                    <img src="/assets/cerofiao-logo.svg" alt="CF" className="w-full h-full object-contain" />
                                  </div>
                                  <span className="text-[9px] text-cyan-300 font-mono">{m.tag}</span>
                                </div>

                                <div className="my-auto text-center py-2">
                                  <div className="text-[11px] font-bold text-white mb-1">{m.title}</div>
                                  <div className="text-[9px] text-gray-400 leading-tight">{m.desc}</div>
                                  <div className="mt-3 inline-block px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[9px] text-cyan-300 font-mono">
                                    Frame 0 • 120 FPS
                                  </div>
                                </div>

                                <div className="w-full h-1 rounded-full bg-white/10 mt-auto"></div>
                              </div>

                              {/* Home gesture bar */}
                              <div className="w-16 h-1 rounded-full bg-gray-600 mx-auto mt-1"></div>
                            </div>

                            <div className="mt-auto">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-white">{m.title}</span>
                                <span className="text-[10px] font-mono text-cyan-400">{m.screen}/04</span>
                              </div>
                              <span className="text-[11px] text-gray-400 block line-clamp-1">{m.desc}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* LION FITNESS MOCKUPS */}
                    {activeMockupApp === 'lionfitness' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          {
                            title: 'Workout & Tonelaje',
                            screen: '01',
                            tag: 'SERIES & REPS',
                            accent: '#eab308',
                            desc: 'Registro cinemático de peso y repeticiones con cálculo de tonelaje acumulado.',
                            details: ['Input numérico OneUI', 'Cálculo de volumen total', 'Historial por ejercicio']
                          },
                          {
                            title: 'Cronómetro Háptico',
                            screen: '02',
                            tag: 'HAPTIC PULSE',
                            accent: '#f59e0b',
                            desc: 'Temporizador de descanso que avisa con pulsos táctiles sin encender pantalla.',
                            details: ['VibratorManager API', 'Ondas concéntricas animadas', 'Modo ahorro de batería']
                          },
                          {
                            title: 'Estimación 1RM & RPE',
                            screen: '03',
                            tag: 'ALGORITMO 1RM',
                            accent: '#14b8a6',
                            desc: 'Fórmulas Brzycki & Epley para calibrar intensidades de sobrecarga progresiva.',
                            details: ['Porcentajes de fuerza (70-95%)', 'RPE escala de esfuerzo', 'Curva de progreso']
                          },
                          {
                            title: 'OneUI Design System',
                            screen: '04',
                            tag: 'ANTON TOKENS',
                            accent: '#eab308',
                            desc: 'Estilo visual de alto contraste y tipografía deportiva Anton en Jetpack Compose.',
                            details: ['OneUI spacing tokens', 'Efecto de cristal ahumado', 'Arquitectura 100% offline']
                          }
                        ].map((m, idx) => (
                          <div
                            key={idx}
                            className="phone-mockup-card rounded-2xl bg-black/40 border border-white/10 hover:border-amber-400/50 transition-all p-3.5 flex flex-col cursor-pointer"
                            onClick={() => setSelectedMockupPreview({ ...m, app: 'Lion Fitness' })}
                          >
                            {/* Device Frame */}
                            <div className="device-frame rounded-2xl bg-gray-900 border-2 border-gray-700/60 p-2.5 mb-3 shadow-xl relative overflow-hidden aspect-[9/16] flex flex-col justify-between">
                              {/* Punch hole camera & status bar */}
                              <div className="flex justify-between items-center text-[10px] text-gray-400 px-1 pt-0.5">
                                <span>12:00</span>
                                <div className="w-2.5 h-2.5 rounded-full bg-black border border-gray-700"></div>
                                <div className="flex items-center gap-1 font-mono text-[9px]">
                                  <span>5G</span>
                                  <span>100%</span>
                                </div>
                              </div>

                              {/* Screen Simulation */}
                              <div className="flex-1 my-2 rounded-xl bg-gradient-to-b from-gray-950 via-amber-950/20 to-gray-950 p-2.5 flex flex-col justify-between border border-white/5">
                                <div className="flex items-center justify-between">
                                  <div className="w-5 h-5 rounded bg-amber-500/20 p-0.5">
                                    <img src="/assets/lionfitness-logo.png" alt="LF" className="w-full h-full object-contain" />
                                  </div>
                                  <span className="text-[9px] text-amber-300 font-mono">{m.tag}</span>
                                </div>

                                <div className="my-auto text-center py-2">
                                  <div className="text-[11px] font-bold text-white mb-1">{m.title}</div>
                                  <div className="text-[9px] text-gray-400 leading-tight">{m.desc}</div>
                                  <div className="mt-3 inline-block px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[9px] text-amber-300 font-mono">
                                    Haptic • Offline
                                  </div>
                                </div>

                                <div className="w-full h-1 rounded-full bg-white/10 mt-auto"></div>
                              </div>

                              {/* Home gesture bar */}
                              <div className="w-16 h-1 rounded-full bg-gray-600 mx-auto mt-1"></div>
                            </div>

                            <div className="mt-auto">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-white">{m.title}</span>
                                <span className="text-[10px] font-mono text-amber-400">{m.screen}/04</span>
                              </div>
                              <span className="text-[11px] text-gray-400 block line-clamp-1">{m.desc}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ==============================================================
                    TAB 3: FILES & ARCHITECTURE SPECS
                    ============================================================== */}
                {activeTab === 'files' && (
                  <div className="files-explorer space-y-4">
                    <div className="files-intro-bar flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-xs text-gray-300">📁 Especificaciones técnicas y artefactos del repositorio</span>
                      <Chip size="sm" variant="outline" className="text-gray-300 text-xs">5 archivos</Chip>
                    </div>

                    <div className="files-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <Card className="file-card p-4 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-400 cursor-pointer transition-colors" onClick={() => setSelectedSpec('cerofiao')}>
                        <div className="file-icon-wrapper mb-2">
                          <span className="file-type-badge badge-kt px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold">KT</span>
                        </div>
                        <div className="file-meta">
                          <span className="file-name block text-sm font-bold text-white mb-1">CeroFiao_Architecture_v26.kt</span>
                          <span className="file-size text-xs text-gray-400">18 Módulos • Room v26 • Clean Arch</span>
                        </div>
                      </Card>

                      <Card className="file-card p-4 rounded-xl bg-white/5 border border-white/10 hover:border-amber-400 cursor-pointer transition-colors" onClick={() => setSelectedSpec('lionfitness')}>
                        <div className="file-icon-wrapper mb-2">
                          <span className="file-type-badge badge-kt px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono font-bold">KT</span>
                        </div>
                        <div className="file-meta">
                          <span className="file-name block text-sm font-bold text-white mb-1">LionFitness_Theme_Tokens.kt</span>
                          <span className="file-size text-xs text-gray-400">Design System • Anton • Haptic API</span>
                        </div>
                      </Card>

                      <Card className="file-card p-4 rounded-xl bg-white/5 border border-white/10 hover:border-blue-400 cursor-pointer transition-colors" onClick={() => setSelectedSpec('rates')}>
                        <div className="file-icon-wrapper mb-2">
                          <span className="file-type-badge badge-sql px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-mono font-bold">SQL</span>
                        </div>
                        <div className="file-meta">
                          <span className="file-name block text-sm font-bold text-white mb-1">ExchangeRates_Ledger_Schema.sql</span>
                          <span className="file-size text-xs text-gray-400">Multi-Currency • BCV • Triangulación</span>
                        </div>
                      </Card>

                      <Card className="file-card p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-400 cursor-pointer transition-colors" onClick={() => setSelectedSpec('dock')}>
                        <div className="file-icon-wrapper mb-2">
                          <span className="file-type-badge badge-md px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-xs font-mono font-bold">MD</span>
                        </div>
                        <div className="file-meta">
                          <span className="file-name block text-sm font-bold text-white mb-1">TriIsland_Dock_Architecture.md</span>
                          <span className="file-size text-xs text-gray-400">Dual-Spring Physics • 120 FPS</span>
                        </div>
                      </Card>

                      <Card className="file-card p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-400 cursor-pointer transition-colors" onClick={() => setSelectedSpec('kmp')}>
                        <div className="file-icon-wrapper mb-2">
                          <span className="file-type-badge badge-kmp px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold">KMP</span>
                        </div>
                        <div className="file-meta">
                          <span className="file-name block text-sm font-bold text-white mb-1">Compose_Multiplatform_Roadmap.md</span>
                          <span className="file-size text-xs text-gray-400">iOS Expansion • Shared Core</span>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

              </ScrollShadow>

            </main>

          </div>

        </div>
      </div>

      {/* Typography Configuration Modal */}
      {showFontModal && (
        <div className="spec-modal-backdrop" onClick={() => setShowFontModal(false)}>
          <div className="spec-modal-dialog max-w-md" onClick={(e) => e.stopPropagation()}>
            <header className="spec-modal-header flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="font-bold text-cyan-400 text-lg">Aa</span>
                <h3 className="text-base font-bold text-white">Configuración de Tipografía</h3>
              </div>
              <button
                className="spec-modal-close text-gray-400 hover:text-white text-xl"
                onClick={() => setShowFontModal(false)}
                aria-label="Cerrar"
              >
                &times;
              </button>
            </header>

            <div className="spec-modal-body py-4 space-y-3">
              <p className="text-xs text-gray-300 mb-3">
                Selecciona la fuente de la interfaz. La tipografía cambiará al instante en toda la aplicación:
              </p>

              <div className="space-y-2">
                {FONT_OPTIONS.map((f) => (
                  <div
                    key={f.id}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${fontFamily === f.id ? 'border-cyan-400 bg-cyan-500/10 text-white shadow-md shadow-cyan-500/10' : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'}`}
                    onClick={() => {
                      setFontFamily(f.id);
                      showToast(`Tipografía cambiada a ${f.name}`, '🔤');
                    }}
                  >
                    <div>
                      <span className="block text-sm font-semibold" style={{ fontFamily: f.css }}>
                        {f.label}
                      </span>
                      <span className="text-[11px] text-gray-400" style={{ fontFamily: f.css }}>
                        The quick brown fox jumps over the lazy dog. 120 FPS
                      </span>
                    </div>
                    {fontFamily === f.id && (
                      <span className="text-cyan-400 font-bold text-sm">✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <footer className="pt-3 border-t border-white/10 flex justify-end">
              <Button
                variant="primary"
                className="bg-cyan-500 text-gray-950 font-bold px-4 text-xs"
                onPress={() => setShowFontModal(false)}
              >
                Listo
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* Mockup Preview Modal */}
      {selectedMockupPreview && (
        <div className="spec-modal-backdrop" onClick={() => setSelectedMockupPreview(null)}>
          <div className="spec-modal-dialog max-w-lg" onClick={(e) => e.stopPropagation()}>
            <header className="spec-modal-header flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <Chip size="sm" variant="soft" className="text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 mb-1">
                  {selectedMockupPreview.app} • PANTALLA {selectedMockupPreview.screen}
                </Chip>
                <h3 className="text-base font-bold text-white">{selectedMockupPreview.title}</h3>
              </div>
              <button
                className="spec-modal-close text-gray-400 hover:text-white text-xl"
                onClick={() => setSelectedMockupPreview(null)}
                aria-label="Cerrar"
              >
                &times;
              </button>
            </header>

            <div className="spec-modal-body py-4 space-y-4">
              <p className="text-xs text-gray-300">{selectedMockupPreview.desc}</p>

              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Capacidades en Pantalla:</span>
                <ul className="text-xs text-gray-300 space-y-1 list-disc pl-4">
                  {selectedMockupPreview.details && selectedMockupPreview.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 flex items-center gap-2">
                <span>💡</span>
                <span>Resolución nativa calibrada a FHD+ 1080x2400 (Densidad xxhdpi, Android 15).</span>
              </div>
            </div>

            <footer className="pt-3 border-t border-white/10 flex justify-end">
              <Button
                variant="outline"
                className="border-white/20 text-gray-300 text-xs"
                onPress={() => setSelectedMockupPreview(null)}
              >
                Cerrar Preview
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* Spec Deep Dive Modal */}
      {selectedSpec && SPECS[selectedSpec] && (
        <div className="spec-modal-backdrop" onClick={() => setSelectedSpec(null)}>
          <div className="spec-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <header className="spec-modal-header flex items-center justify-between pb-3 border-b border-white/10">
              <div className="spec-modal-title-box">
                <Chip size="sm" variant="soft" className="spec-modal-badge mb-1 text-[10px]">
                  {SPECS[selectedSpec].badge}
                </Chip>
                <h2 className="spec-modal-title text-lg font-bold text-white">{SPECS[selectedSpec].title}</h2>
              </div>
              <button className="spec-modal-close text-gray-400 hover:text-white text-xl" onClick={() => setSelectedSpec(null)} aria-label="Cerrar modal">
                &times;
              </button>
            </header>

            <div className="spec-modal-body py-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 p-2 flex items-center justify-center flex-shrink-0">
                  <img
                    src={SPECS[selectedSpec].icon}
                    alt={SPECS[selectedSpec].title}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{SPECS[selectedSpec].subtitle}</h3>
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">{SPECS[selectedSpec].desc}</p>

              {SPECS[selectedSpec].modules && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2">Capacidades & Módulos Clave</h4>
                  <ul className="bullet-list space-y-1.5 pl-4 list-disc text-xs text-gray-300">
                    {SPECS[selectedSpec].modules.map((m, idx) => (
                      <li key={idx}><strong>{m.name}:</strong> {m.desc}</li>
                    ))}
                  </ul>
                </div>
              )}

              {SPECS[selectedSpec].stack && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2">Stack Tecnológico</h4>
                  <div className="project-stack-row flex flex-wrap gap-1.5">
                    {SPECS[selectedSpec].stack.map((t, idx) => (
                      <Chip key={idx} size="sm" variant="outline" className="text-xs text-gray-300 border-white/10">{t}</Chip>
                    ))}
                  </div>
                </div>
              )}

              {SPECS[selectedSpec].code && (
                <div className="arch-card bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 font-mono">Snippet de Arquitectura</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/20 text-gray-300 text-xs"
                      onPress={() => {
                        navigator.clipboard.writeText(SPECS[selectedSpec].code);
                        showToast('Código copiado al portapapeles', '📋');
                      }}
                    >
                      Copiar Código
                    </Button>
                  </div>
                  <pre className="font-mono text-xs text-cyan-300 overflow-x-auto m-0 p-0 leading-relaxed">
                    {SPECS[selectedSpec].code}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      <div className={`slack-toast ${toast.show ? 'show' : ''}`}>
        <span className="toast-icon">{toast.icon}</span>
        <span className="toast-text">{toast.text}</span>
      </div>
    </>
  );
}

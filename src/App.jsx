import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, Chip, Input, Badge } from '@heroui/react';

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
    stack: ['Kotlin 2.0', 'Jetpack Compose', 'Room SQLite (v26)', 'StateFlow', 'Hilt DI', 'Clean Architecture']
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
    stack: ['Kotlin', 'Jetpack Compose', 'Haptic API', 'Room SQLite', 'OneUI Custom Tokens']
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
        // Triangulación automática y cálculo directo
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
  const [activeTab, setActiveTab] = useState('messages');
  const [theme, setTheme] = useState(() => localStorage.getItem('schwarckdev_theme') || 'dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [selectedSpec, setSelectedSpec] = useState(null);
  const [toast, setToast] = useState({ show: false, text: '', icon: '✨' });
  const [isTyping, setIsTyping] = useState(false);

  const [reactions, setReactions] = useState({
    fire: { count: 384, reacted: false },
    rocket: { count: 219, reacted: false },
    heart: { count: 142, reacted: false },
    appFire: { count: 412, reacted: false },
    appMoney: { count: 276, reacted: false },
    lionMuscle: { count: 318, reacted: false },
    lionKing: { count: 245, reacted: false },
    archGear: { count: 174, reacted: false },
    archCheck: { count: 129, reacted: false },
    servHand: { count: 156, reacted: false }
  });

  const [dmHistory, setDmHistory] = useState([]);
  const paneRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('schwarckdev_theme', theme);
  }, [theme]);

  const showToast = (text, icon = '✨') => {
    setToast({ show: true, text, icon });
    setTimeout(() => {
      setToast({ show: false, text: '', icon: '✨' });
    }, 3200);
  };

  const toggleReaction = (key) => {
    setReactions(prev => {
      const current = prev[key];
      const newReacted = !current.reacted;
      return {
        ...prev,
        [key]: {
          count: current.count + (newReacted ? 1 : -1),
          reacted: newReacted
        }
      };
    });
    showToast('¡Reacción actualizada!', '🔥');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!composerText.trim()) return;

    const userText = composerText.trim();
    setComposerText('');
    setActiveChannel('dms');
    setActiveTab('messages');

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setDmHistory(prev => [
      ...prev,
      { id: Date.now(), sender: 'user', text: userText, time: timeStr }
    ]);

    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setDmHistory(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: userText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          mailto: `mailto:alanleones2013@gmail.com?subject=${encodeURIComponent('[SchwarckDev DM] Consulta de proyecto')}&body=${encodeURIComponent(userText)}`
        }
      ]);
      showToast('Respuesta automática en DMs', '💬');
    }, 1100);
  };

  const copyEmail = () => {
    navigator.clipboard.writeText('alanleones2013@gmail.com').then(() => {
      showToast('Correo copiado: alanleones2013@gmail.com', '📋');
    });
  };

  const currentChannelData = CHANNELS[activeChannel] || CHANNELS.inicio;

  return (
    <>
      {/* Scenic Wallpaper */}
      <div className="desktop-wallpaper">
        <div className="wallpaper-overlay" />
      </div>

      <div className="app-viewport">
        <div className={`os-window ${windowMaximized ? 'maximized' : ''}`} id="osWindow">
          
          {/* Window Titlebar */}
          <header className="window-titlebar">
            <div className="titlebar-left">
              <div className="window-controls">
                <button
                  className="win-btn win-close"
                  onClick={() => showToast('¡No te vayas aún! Explora #apps para conocer CeroFiao y Lion Fitness 🚀', '👋')}
                  title="Just for fun"
                />
                <button
                  className="win-btn win-minimize"
                  onClick={() => showToast('Ventana lista', '⚡')}
                  title="Minimizar"
                />
                <button
                  className="win-btn win-maximize"
                  onClick={() => setWindowMaximized(!windowMaximized)}
                  title="Maximizar / Restaurar"
                />
              </div>

              <button
                className="mobile-toggle-btn"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Abrir canales"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </button>
            </div>

            <div className="titlebar-center">
              <span className="window-title-badge">
                <span className="online-indicator"></span>
                <span>{currentChannelData.title}</span>
              </span>
            </div>

            <div className="titlebar-right">
              <button
                className="theme-toggle-btn"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title="Cambiar Modo Oscuro / Claro"
              >
                <svg className="sun-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="5"></circle>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
                </svg>
                <svg className="moon-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              </button>

              <a
                href="https://github.com/Totito1313"
                target="_blank"
                rel="noopener noreferrer"
                className="titlebar-github-link"
                title="GitHub @Totito1313"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
              </a>
            </div>
          </header>

          {/* Window Body */}
          <div className="window-body">
            
            {/* Outer Activity Bar */}
            <aside className="activity-bar">
              <div className="activity-top">
                <div className="activity-brand-item" title="SchwarckDev Studio">
                  <img src="/assets/schwarckdev-logo.svg" alt="SchwarckDev Monogram" className="activity-avatar" width="36" height="36" />
                  <span className="activity-online-dot"></span>
                </div>

                <button
                  className={`activity-nav-btn ${activeChannel === 'inicio' ? 'active' : ''}`}
                  onClick={() => setActiveChannel('inicio')}
                  title="Inicio"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  <span className="activity-tooltip">Inicio</span>
                </button>

                <button
                  className={`activity-nav-btn ${activeChannel === 'apps' ? 'active' : ''}`}
                  onClick={() => setActiveChannel('apps')}
                  title="Apps"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                  <span className="activity-tooltip">Apps</span>
                </button>

                <button
                  className={`activity-nav-btn ${activeChannel === 'arquitectura' ? 'active' : ''}`}
                  onClick={() => setActiveChannel('arquitectura')}
                  title="Arquitectura"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                  <span className="activity-tooltip">Arquitectura</span>
                </button>

                <button
                  className={`activity-nav-btn ${activeChannel === 'servicios' ? 'active' : ''}`}
                  onClick={() => setActiveChannel('servicios')}
                  title="Servicios"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                  </svg>
                  <span className="activity-tooltip">Servicios</span>
                </button>

                <button
                  className={`activity-nav-btn ${activeChannel === 'dms' ? 'active' : ''}`}
                  onClick={() => setActiveChannel('dms')}
                  title="DMs"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span className="activity-tooltip">DMs</span>
                </button>
              </div>

              <div className="activity-bottom">
                <button
                  className="activity-nav-btn"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  title="Alternar barra lateral"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                  </svg>
                  <span className="activity-tooltip">Colapsar</span>
                </button>
              </div>
            </aside>

            {/* Inner Channels Sidebar */}
            <nav className={`channels-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
              <div className="sidebar-header">
                <div className="workspace-info">
                  <span className="workspace-name">SchwarckDev</span>
                  <span className="verified-badge" title="Desarrollador Verificado">✓</span>
                </div>
                <div className="quick-status-btn">
                  <span className="status-dot"></span>
                  <span>Online</span>
                </div>
              </div>

              <div className="sidebar-scrollable">
                
                {/* Apps Section */}
                <div className="sidebar-group">
                  <div className="sidebar-group-title">
                    <span className="group-arrow">▼</span>
                    <span>Aplicaciones</span>
                  </div>
                  <div className="sidebar-group-items">
                    <div
                      className="sidebar-app-item"
                      onClick={() => { setActiveChannel('apps'); setMobileOpen(false); }}
                    >
                      <img src="/assets/cerofiao-logo.svg" alt="CeroFiao" className="sidebar-app-icon" width="20" height="20" />
                      <span className="sidebar-app-name">CeroFiao</span>
                      <Chip size="sm" variant="soft" className="sidebar-tag live">Live</Chip>
                    </div>

                    <div
                      className="sidebar-app-item"
                      onClick={() => { setActiveChannel('apps'); setMobileOpen(false); }}
                    >
                      <img src="/assets/lionfitness-logo.png" alt="Lion Fitness" className="sidebar-app-icon" width="20" height="20" />
                      <span className="sidebar-app-name">Lion Fitness</span>
                      <Chip size="sm" variant="soft" className="sidebar-tag upcoming">Próx</Chip>
                    </div>

                    <div
                      className="sidebar-app-item"
                      onClick={() => { setActiveChannel('apps'); setMobileOpen(false); }}
                    >
                      <img src="/assets/schwarckdev-logo.svg" alt="Ecosistema" className="sidebar-app-icon" width="20" height="20" />
                      <span className="sidebar-app-name">Ecosistema KMP</span>
                      <Chip size="sm" variant="soft" className="sidebar-tag future">2026</Chip>
                    </div>
                  </div>
                </div>

                <div className="sidebar-divider"></div>

                {/* Channels Section */}
                <div className="sidebar-group">
                  <div className="sidebar-group-title">
                    <span className="group-arrow">▼</span>
                    <span>Canales</span>
                  </div>
                  <div className="sidebar-group-items">
                    {['inicio', 'apps', 'arquitectura', 'servicios'].map(ch => (
                      <button
                        key={ch}
                        className={`channel-link ${activeChannel === ch ? 'active' : ''}`}
                        onClick={() => { setActiveChannel(ch); setMobileOpen(false); }}
                      >
                        <span className="channel-hash">#</span>
                        <span className="channel-name">{ch}</span>
                        {ch === 'apps' && <span className="unread-pill">2</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sidebar-divider"></div>

                {/* DMs Section */}
                <div className="sidebar-group">
                  <div className="sidebar-group-title">
                    <span className="group-arrow">▼</span>
                    <span>Mensajes Directos</span>
                  </div>
                  <div className="sidebar-group-items">
                    <button
                      className={`channel-link dm-link ${activeChannel === 'dms' ? 'active' : ''}`}
                      onClick={() => { setActiveChannel('dms'); setMobileOpen(false); }}
                    >
                      <span className="dm-status-dot"></span>
                      <span className="channel-name">Alan / SchwarckDev</span>
                    </button>
                  </div>
                </div>

                <div className="sidebar-divider"></div>

                {/* Connections Section */}
                <div className="sidebar-group">
                  <div className="sidebar-group-title">
                    <span className="group-arrow">▼</span>
                    <span>Conexiones</span>
                  </div>
                  <div className="sidebar-group-items">
                    <a href="https://github.com/Totito1313" target="_blank" rel="noopener noreferrer" className="sidebar-ext-link">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                      <span>GitHub (@Totito1313)</span>
                    </a>
                    <button className="sidebar-ext-link" onClick={copyEmail}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                      <span>Copiar Correo</span>
                    </button>
                  </div>
                </div>

              </div>
            </nav>

            {/* Main Channel Content Workspace */}
            <main className="channel-workspace">
              
              {/* Channel Header */}
              <div className="channel-nav-header">
                <div className="channel-header-title-box">
                  <div className="channel-header-left">
                    <span className="active-channel-prefix">#</span>
                    <h1 className="active-channel-title">{currentChannelData.name}</h1>
                  </div>
                  <p className="channel-topic">{currentChannelData.topic}</p>
                </div>

                {/* Tabs Bar */}
                <div className="channel-tabs-bar">
                  <button
                    className={`channel-tab-btn ${activeTab === 'messages' ? 'active' : ''}`}
                    onClick={() => setActiveTab('messages')}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>Mensajes</span>
                  </button>

                  <button
                    className={`channel-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
                    onClick={() => setActiveTab('files')}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <span>Archivos & Specs</span>
                    <span className="files-count-badge">5</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Content Pane */}
              <div className="channel-content-pane" ref={paneRef}>
                
                {activeTab === 'messages' ? (
                  <div className="messages-stream">
                    
                    {/* ====== CHANNEL: INICIO ====== */}
                    {activeChannel === 'inicio' && (
                      <section className="channel-view-section">
                        <article className="chat-message">
                          <div className="msg-avatar-wrapper">
                            <img src="/assets/schwarckdev-logo.svg" alt="SchwarckDev" className="msg-avatar" width="40" height="40" />
                            <span className="msg-status-dot"></span>
                          </div>
                          <div className="msg-content">
                            <div className="msg-header">
                              <span className="msg-author">Alan (SchwarckDev)</span>
                              <span className="msg-author-tag">CREADOR</span>
                              <time className="msg-timestamp">Hoy a las 10:42 PM</time>
                            </div>
                            <div className="msg-body">
                              <p>
                                ¡Hola! Soy <strong>Alan</strong>, desarrollador de software móvil independiente detrás de <strong>SchwarckDev</strong>.
                                Especializado en arquitectura móvil nativa con <span className="tag-pill">#kotlin</span> y <span className="tag-pill">#jetpack-compose</span>.
                              </p>
                              <p>
                                Construyo aplicaciones móviles sin atajos: <strong>sin plantillas genéricas</strong>, con rendimiento nativo implacable (60/120 FPS),
                                sistemas de diseño propios y privacidad total como estándar.
                              </p>

                              <div className="metrics-grid">
                                <div className="metric-box">
                                  <span className="metric-val">2+</span>
                                  <span className="metric-lbl">Apps en Producción</span>
                                </div>
                                <div className="metric-box">
                                  <span className="metric-val">100%</span>
                                  <span className="metric-lbl">Nativo en Kotlin</span>
                                </div>
                                <div className="metric-box">
                                  <span className="metric-val">120 FPS</span>
                                  <span className="metric-lbl">UDF & Frame 0</span>
                                </div>
                                <div className="metric-box">
                                  <span className="metric-val">Offline</span>
                                  <span className="metric-lbl">Soberanía de Datos</span>
                                </div>
                              </div>
                            </div>

                            <div className="msg-reactions">
                              <button
                                className={`reaction-pill ${reactions.fire.reacted ? 'reacted' : ''}`}
                                onClick={() => toggleReaction('fire')}
                              >
                                <span className="reaction-emoji">🔥</span>
                                <span className="reaction-count">{reactions.fire.count}</span>
                              </button>
                              <button
                                className={`reaction-pill ${reactions.rocket.reacted ? 'reacted' : ''}`}
                                onClick={() => toggleReaction('rocket')}
                              >
                                <span className="reaction-emoji">🚀</span>
                                <span className="reaction-count">{reactions.rocket.count}</span>
                              </button>
                              <button
                                className={`reaction-pill ${reactions.heart.reacted ? 'reacted' : ''}`}
                                onClick={() => toggleReaction('heart')}
                              >
                                <span className="reaction-emoji">💙</span>
                                <span className="reaction-count">{reactions.heart.count}</span>
                              </button>
                            </div>
                          </div>
                        </article>

                        <article className="chat-message">
                          <div className="msg-avatar-wrapper">
                            <img src="/assets/schwarckdev-logo.svg" alt="SchwarckDev" className="msg-avatar" width="40" height="40" />
                          </div>
                          <div className="msg-content">
                            <div className="msg-header">
                              <span className="msg-author">Alan (SchwarckDev)</span>
                              <time className="msg-timestamp">Hoy a las 10:45 PM</time>
                            </div>
                            <div className="msg-body">
                              <p>Explora este espacio como si estuvieras en nuestro canal de equipo:</p>
                              <ul className="bullet-list">
                                <li><strong><span className="inline-channel-link" onClick={() => setActiveChannel('apps')}>#apps</span>:</strong> Revisa el showcase detallado de <em>CeroFiao</em> y <em>Lion Fitness</em>.</li>
                                <li><strong><span className="inline-channel-link" onClick={() => setActiveChannel('arquitectura')}>#arquitectura</span>:</strong> Especificaciones técnicas de Clean Architecture, Room v26 y Compose.</li>
                                <li><strong><span className="inline-channel-link" onClick={() => setActiveChannel('servicios')}>#servicios</span>:</strong> Modalidades para consultoría, nuevos desarrollos y contratos.</li>
                                <li><strong><span className="inline-channel-link" onClick={() => setActiveChannel('dms')}>DMs</span>:</strong> Puedes enviarme un mensaje directo usando la barra inferior.</li>
                              </ul>
                            </div>
                          </div>
                        </article>
                      </section>
                    )}

                    {/* ====== CHANNEL: APPS ====== */}
                    {activeChannel === 'apps' && (
                      <section className="channel-view-section">
                        <article className="chat-message">
                          <div className="msg-avatar-wrapper">
                            <img src="/assets/schwarckdev-logo.svg" alt="SchwarckDev" className="msg-avatar" width="40" height="40" />
                          </div>
                          <div className="msg-content">
                            <div className="msg-header">
                              <span className="msg-author">Alan (SchwarckDev)</span>
                              <time className="msg-timestamp">Hoy a las 10:48 PM</time>
                            </div>
                            <div className="msg-body">
                              <p>Aquí tienes el portafolio central de aplicaciones desarrolladas bajo la marca <strong>SchwarckDev</strong> 👇</p>
                            </div>
                          </div>
                        </article>

                        {/* APP: CEROFIAO (Using HeroUI Card) */}
                        <article className="chat-message project-message">
                          <div className="msg-avatar-wrapper">
                            <img src="/assets/cerofiao-logo.svg" alt="CeroFiao" className="msg-avatar project-avatar" width="40" height="40" />
                          </div>
                          <div className="msg-content">
                            <div className="msg-header">
                              <span className="msg-author">CeroFiao</span>
                              <Chip size="sm" variant="soft" className="badge-orange">Finanzas & Presupuesto</Chip>
                              <time className="msg-timestamp">com.schwarckdev.cerofiao</time>
                            </div>

                            <Card className="project-card-custom cerofiao-border">
                              <Card.Header className="project-card-header">
                                <div className="project-title-row">
                                  <img src="/assets/cerofiao-logo.svg" alt="CeroFiao Logo" className="project-header-icon" width="48" height="48" />
                                  <div>
                                    <h3 className="project-name">CeroFiao</h3>
                                    <span className="project-tagline">El control financiero definitivo: gastos, deudas, tasas en vivo y presupuestos</span>
                                  </div>
                                </div>
                                <Chip size="sm" variant="soft" className="live-chip">Android Nativo</Chip>
                              </Card.Header>

                              <Card.Content>
                                <p className="project-description">
                                  Plataforma integral de gestión financiera concebida para erradicar el desorden en economías multi-moneda (USD / VES / EUR).
                                  Integra seguimiento de cuentas por cobrar y pagar ("fiao"), tasas oficiales sincronizadas en tiempo real, presupuestos por categoría
                                  y persistencia soberana local sobre Room SQLite v26.
                                </p>

                                <div className="features-pill-grid">
                                  <div className="feature-chip">
                                    <span className="chip-dot dot-orange"></span>
                                    <span><strong>Control de Deudas:</strong> Abonos y estados de cobro</span>
                                  </div>
                                  <div className="feature-chip">
                                    <span className="chip-dot dot-orange"></span>
                                    <span><strong>Multi-Divisa & Tasas:</strong> Conversión oficial en vivo</span>
                                  </div>
                                  <div className="feature-chip">
                                    <span className="chip-dot dot-orange"></span>
                                    <span><strong>Alcancía & Metas:</strong> Proyección de ahorro visual</span>
                                  </div>
                                  <div className="feature-chip">
                                    <span className="chip-dot dot-orange"></span>
                                    <span><strong>Privacidad 100%:</strong> Base local + exportación CSV</span>
                                  </div>
                                </div>

                                <div className="project-stack-row">
                                  {['Kotlin 2.0', 'Jetpack Compose', 'Clean Architecture', 'Room DB (v26)', 'StateFlow', 'HeroUI Custom Tokens'].map(t => (
                                    <Chip key={t} size="sm" variant="outline" className="tech-tag">{t}</Chip>
                                  ))}
                                </div>
                              </Card.Content>

                              <Card.Footer className="project-actions">
                                <Button
                                  variant="primary"
                                  className="btn-orange"
                                  onPress={() => setSelectedSpec('cerofiao')}
                                >
                                  Ver Módulos & Arquitectura Completa
                                </Button>
                              </Card.Footer>
                            </Card>

                            <div className="msg-reactions">
                              <button
                                className={`reaction-pill ${reactions.appFire.reacted ? 'reacted' : ''}`}
                                onClick={() => toggleReaction('appFire')}
                              >
                                <span className="reaction-emoji">🔥</span>
                                <span className="reaction-count">{reactions.appFire.count}</span>
                              </button>
                              <button
                                className={`reaction-pill ${reactions.appMoney.reacted ? 'reacted' : ''}`}
                                onClick={() => toggleReaction('appMoney')}
                              >
                                <span className="reaction-emoji">💰</span>
                                <span className="reaction-count">{reactions.appMoney.count}</span>
                              </button>
                            </div>
                          </div>
                        </article>

                        {/* APP: LION FITNESS (Using HeroUI Card with uncropped logo) */}
                        <article className="chat-message project-message">
                          <div className="msg-avatar-wrapper">
                            <img src="/assets/lionfitness-logo.png" alt="Lion Fitness" className="msg-avatar project-avatar" width="40" height="40" />
                          </div>
                          <div className="msg-content">
                            <div className="msg-header">
                              <span className="msg-author">Lion Fitness</span>
                              <Chip size="sm" variant="soft" className="badge-teal">Salud & Fuerza</Chip>
                              <time className="msg-timestamp">com.schwarckstudio.lionfitness</time>
                            </div>

                            <Card className="project-card-custom lion-border">
                              <Card.Header className="project-card-header">
                                <div className="project-title-row">
                                  <img src="/assets/lionfitness-logo.png" alt="Lion Fitness Logo" className="project-header-icon" width="48" height="48" />
                                  <div>
                                    <h3 className="project-name">Lion Fitness</h3>
                                    <span className="project-tagline">Entrenamiento de fuerza implacable, sobrecarga progresiva y háptica de alta fidelidad</span>
                                  </div>
                                </div>
                                <Chip size="sm" variant="soft" className="upcoming-chip">Android Nativo</Chip>
                              </Card.Header>

                              <Card.Content>
                                <p className="project-description">
                                  Diseñada para atletas y levantadores de fuerza que exigen agilidad máxima.
                                  Ofrece registro instantáneo de series, cálculo automático de 1RM y RPE,
                                  cronómetro de descanso con feedback háptico que te avisa sin necesidad de mirar la pantalla,
                                  y un sistema de diseño visual enérgico con tipografía Anton e inspiración OneUI.
                                </p>

                                <div className="features-pill-grid">
                                  <div className="feature-chip">
                                    <span className="chip-dot dot-teal"></span>
                                    <span><strong>Sobrecarga Progresiva:</strong> Gráficos de volumen y tonelaje</span>
                                  </div>
                                  <div className="feature-chip">
                                    <span className="chip-dot dot-teal"></span>
                                    <span><strong>Alertas Hápticas:</strong> Cronómetro con vibraciones exactas</span>
                                  </div>
                                  <div className="feature-chip">
                                    <span className="chip-dot dot-teal"></span>
                                    <span><strong>Diseño Energético:</strong> Anton typography + OneUI tokens</span>
                                  </div>
                                  <div className="feature-chip">
                                    <span className="chip-dot dot-teal"></span>
                                    <span><strong>100% Offline:</strong> Registro directo en el gimnasio sin lag</span>
                                  </div>
                                </div>

                                <div className="project-stack-row">
                                  {['Kotlin', 'Jetpack Compose', 'Haptic Engine API', 'Room SQLite', 'Custom Tokens Engine'].map(t => (
                                    <Chip key={t} size="sm" variant="outline" className="tech-tag">{t}</Chip>
                                  ))}
                                </div>
                              </Card.Content>

                              <Card.Footer className="project-actions">
                                <Button
                                  variant="primary"
                                  className="btn-teal"
                                  onPress={() => setSelectedSpec('lionfitness')}
                                >
                                  Ver Ficha Técnica Lion Fitness
                                </Button>
                              </Card.Footer>
                            </Card>

                            <div className="msg-reactions">
                              <button
                                className={`reaction-pill ${reactions.lionMuscle.reacted ? 'reacted' : ''}`}
                                onClick={() => toggleReaction('lionMuscle')}
                              >
                                <span className="reaction-emoji">💪</span>
                                <span className="reaction-count">{reactions.lionMuscle.count}</span>
                              </button>
                              <button
                                className={`reaction-pill ${reactions.lionKing.reacted ? 'reacted' : ''}`}
                                onClick={() => toggleReaction('lionKing')}
                              >
                                <span className="reaction-emoji">🦁</span>
                                <span className="reaction-count">{reactions.lionKing.count}</span>
                              </button>
                            </div>
                          </div>
                        </article>
                      </section>
                    )}

                    {/* ====== CHANNEL: ARQUITECTURA ====== */}
                    {activeChannel === 'arquitectura' && (
                      <section className="channel-view-section">
                        <article className="chat-message">
                          <div className="msg-avatar-wrapper">
                            <img src="/assets/schwarckdev-logo.svg" alt="SchwarckDev" className="msg-avatar" width="40" height="40" />
                          </div>
                          <div className="msg-content">
                            <div className="msg-header">
                              <span className="msg-author">Alan (SchwarckDev)</span>
                              <time className="msg-timestamp">Hoy a las 10:52 PM</time>
                            </div>
                            <div className="msg-body">
                              <p>Los cimientos de ingeniería detrás de cada proyecto en <strong>SchwarckDev</strong>:</p>

                              <div className="arch-cards-grid">
                                <Card className="arch-card" variant="secondary">
                                  <div className="arch-card-header">
                                    <span className="arch-card-code">01</span>
                                    <h4>Clean Architecture & Modularización</h4>
                                  </div>
                                  <p>
                                    Separación estricta entre capas: <code>core-domain</code> (casos de uso puros y reglas de negocio),
                                    <code>core-data</code> (repositorios y fuentes de datos), <code>core-database</code> (Room DAO atómicos) y módulos <code>feature-*</code> aislados e independientes.
                                  </p>
                                </Card>

                                <Card className="arch-card" variant="secondary">
                                  <div className="arch-card-header">
                                    <span className="arch-card-code">02</span>
                                    <h4>Unidirectional Data Flow (UDF) & MVI</h4>
                                  </div>
                                  <p>
                                    Estados inmutables modelados con <code>StateFlow</code> y <code>SharedFlow</code>.
                                    Cada evento de usuario (Intents) es procesado en el ViewModel y devuelto como un único State consolidado.
                                  </p>
                                </Card>

                                <Card className="arch-card" variant="secondary">
                                  <div className="arch-card-header">
                                    <span className="arch-card-code">03</span>
                                    <h4>Sistemas de Diseño Propios (No Genéricos)</h4>
                                  </div>
                                  <p>
                                    Tokens de diseño personalizados (tipografías como Anton/OneUI Sans, animaciones spring duales a 120 FPS, docks cinemáticos e islas de acción Frame 0).
                                  </p>
                                </Card>

                                <Card className="arch-card" variant="secondary">
                                  <div className="arch-card-header">
                                    <span className="arch-card-code">04</span>
                                    <h4>Persistencia Robusta & Migraciones Auditadas</h4>
                                  </div>
                                  <p>
                                    Bases de datos SQLite relacionales con Room, esquemas inmutables tipo Ledger, índices optimizados
                                    y 26 migraciones auditadas con tests unitarios.
                                  </p>
                                </Card>
                              </div>
                            </div>

                            <div className="msg-reactions">
                              <button
                                className={`reaction-pill ${reactions.archGear.reacted ? 'reacted' : ''}`}
                                onClick={() => toggleReaction('archGear')}
                              >
                                <span className="reaction-emoji">⚙️</span>
                                <span className="reaction-count">{reactions.archGear.count}</span>
                              </button>
                              <button
                                className={`reaction-pill ${reactions.archCheck.reacted ? 'reacted' : ''}`}
                                onClick={() => toggleReaction('archCheck')}
                              >
                                <span className="reaction-emoji">✅</span>
                                <span className="reaction-count">{reactions.archCheck.count}</span>
                              </button>
                            </div>
                          </div>
                        </article>
                      </section>
                    )}

                    {/* ====== CHANNEL: SERVICIOS ====== */}
                    {activeChannel === 'servicios' && (
                      <section className="channel-view-section">
                        <article className="chat-message">
                          <div className="msg-avatar-wrapper">
                            <img src="/assets/schwarckdev-logo.svg" alt="SchwarckDev" className="msg-avatar" width="40" height="40" />
                          </div>
                          <div className="msg-content">
                            <div className="msg-header">
                              <span className="msg-author">Alan (SchwarckDev)</span>
                              <time className="msg-timestamp">Hoy a las 10:55 PM</time>
                            </div>
                            <div className="msg-body">
                              <p>¿Tienes una idea para una aplicación móvil o necesitas potenciar un producto existente? Estas son mis modalidades de trabajo:</p>

                              <div className="services-list-container">
                                {[
                                  { icon: '📱', title: 'Desarrollo Android Nativo de Punta a Punta', desc: 'Desde la arquitectura y modelo de datos hasta la UI en Jetpack Compose, APIs y Google Play.' },
                                  { icon: '⚡', title: 'Modernización & Refactorización a Compose', desc: 'Migración de XML legado a Compose declarativo moderno con pruebas de rendimiento y fluidos 120 FPS.' },
                                  { icon: '🎨', title: 'Sistemas de Diseño & UI Kits Móviles', desc: 'Librerías de componentes UI personalizadas, tokens de diseño y temas adaptativos de alto nivel.' },
                                  { icon: '🛡️', title: 'Auditoría de Rendimiento & Base de Datos', desc: 'Análisis de fugas de memoria, optimización de consultas SQL en Room y testing de concurrencia.' }
                                ].map((srv, idx) => (
                                  <Card key={idx} className="service-row" variant="secondary">
                                    <div className="service-icon-box">{srv.icon}</div>
                                    <div className="service-details">
                                      <h4>{srv.title}</h4>
                                      <p>{srv.desc}</p>
                                    </div>
                                  </Card>
                                ))}
                              </div>

                              <div className="service-cta-banner">
                                <div>
                                  <strong>¿Listo para colaborar?</strong>
                                  <p>Conversemos sobre los requerimientos de tu proyecto o una auditoría técnica.</p>
                                </div>
                                <Button
                                  variant="primary"
                                  className="btn-teal"
                                  onPress={() => setActiveChannel('dms')}
                                >
                                  Ir a Mensajes Directos
                                </Button>
                              </div>
                            </div>
                          </div>
                        </article>
                      </section>
                    )}

                    {/* ====== CHANNEL: DMS ====== */}
                    {activeChannel === 'dms' && (
                      <section className="channel-view-section">
                        <article className="chat-message">
                          <div className="msg-avatar-wrapper">
                            <img src="/assets/schwarckdev-logo.svg" alt="SchwarckDev" className="msg-avatar" width="40" height="40" />
                            <span className="msg-status-dot"></span>
                          </div>
                          <div className="msg-content">
                            <div className="msg-header">
                              <span className="msg-author">Alan / SchwarckDev</span>
                              <Chip size="sm" variant="soft" className="dm-badge">DIRECT MESSAGE</Chip>
                              <time className="msg-timestamp">Online ahora</time>
                            </div>
                            <div className="msg-body">
                              <p>
                                ¡Hola! Este es mi canal de mensajes directos.
                                Puedes escribir tu mensaje o consulta en la barra inferior para enviármelo de inmediato.
                              </p>
                              <p>
                                También puedes contactarme directamente vía correo: <a href="mailto:alanleones2013@gmail.com" className="text-link">alanleones2013@gmail.com</a> o en <a href="https://github.com/Totito1313" target="_blank" className="text-link">GitHub @Totito1313</a>.
                              </p>
                            </div>
                          </div>
                        </article>

                        {/* Dynamic Visitor DM History */}
                        {dmHistory.map((msg) => (
                          <article key={msg.id} className="chat-message">
                            <div className="msg-avatar-wrapper">
                              {msg.sender === 'user' ? (
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#080c16', fontSize: '1rem' }}>
                                  Tú
                                </div>
                              ) : (
                                <img src="/assets/schwarckdev-logo.svg" alt="SchwarckDev" className="msg-avatar" width="40" height="40" />
                              )}
                            </div>
                            <div className="msg-content">
                              <div className="msg-header">
                                <span className="msg-author">{msg.sender === 'user' ? 'Visitante (Tú)' : 'Alan (SchwarckDev)'}</span>
                                <time className="msg-timestamp">{msg.time}</time>
                              </div>
                              <div className="msg-body">
                                {msg.sender === 'user' ? (
                                  <div className="user-msg-bubble">{msg.text}</div>
                                ) : (
                                  <div>
                                    <p>¡Mensaje recibido! Acabo de preparar el correo directo para que me llegue a mi bandeja de entrada personal:</p>
                                    <div style={{ marginTop: '12px' }}>
                                      <a href={msg.mailto} className="btn-app-action btn-teal" style={{ textDecoration: 'none' }}>
                                        Enviar por Correo a alanleones2013@gmail.com
                                      </a>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </article>
                        ))}

                        {isTyping && (
                          <div className="typing-indicator">
                            <span>Alan está escribiendo...</span>
                          </div>
                        )}
                      </section>
                    )}

                  </div>
                ) : (
                  /* ====== TAB: FILES & SPECS ====== */
                  <div className="files-explorer">
                    <div className="files-intro-bar">
                      <span>📁 Especificaciones técnicas y artefactos del repositorio</span>
                      <span className="files-meta">Archivos de arquitectura</span>
                    </div>

                    <div className="files-grid">
                      <Card className="file-card" onClick={() => setSelectedSpec('cerofiao')}>
                        <div className="file-icon-wrapper">
                          <span className="file-type-badge badge-kt">KT</span>
                        </div>
                        <div className="file-meta">
                          <span className="file-name">CeroFiao_Architecture_v26.kt</span>
                          <span className="file-size">18 Módulos • Room v26 • Clean Arch</span>
                        </div>
                      </Card>

                      <Card className="file-card" onClick={() => setSelectedSpec('lionfitness')}>
                        <div className="file-icon-wrapper">
                          <span className="file-type-badge badge-kt">KT</span>
                        </div>
                        <div className="file-meta">
                          <span className="file-name">LionFitness_Theme_Tokens.kt</span>
                          <span className="file-size">Design System • Anton • Haptic API</span>
                        </div>
                      </Card>

                      <Card className="file-card" onClick={() => setSelectedSpec('rates')}>
                        <div className="file-icon-wrapper">
                          <span className="file-type-badge badge-sql">SQL</span>
                        </div>
                        <div className="file-meta">
                          <span className="file-name">ExchangeRates_Ledger_Schema.sql</span>
                          <span className="file-size">Multi-Currency • BCV • Triangulación</span>
                        </div>
                      </Card>

                      <Card className="file-card" onClick={() => setSelectedSpec('dock')}>
                        <div className="file-icon-wrapper">
                          <span className="file-type-badge badge-md">MD</span>
                        </div>
                        <div className="file-meta">
                          <span className="file-name">TriIsland_Dock_Architecture.md</span>
                          <span className="file-size">Dual-Spring Physics • 120 FPS</span>
                        </div>
                      </Card>

                      <Card className="file-card" onClick={() => setSelectedSpec('kmp')}>
                        <div className="file-icon-wrapper">
                          <span className="file-type-badge badge-kmp">KMP</span>
                        </div>
                        <div className="file-meta">
                          <span className="file-name">Compose_Multiplatform_Roadmap.md</span>
                          <span className="file-size">iOS Expansion • Shared Core</span>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Message Composer */}
              <footer className="channel-composer-bar">
                <form className="composer-form" onSubmit={handleSendMessage}>
                  <div className="composer-input-container">
                    <input
                      type="text"
                      className="composer-input"
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      placeholder={activeChannel === 'dms' ? 'Enviar mensaje directo a Alan / SchwarckDev...' : `Enviar mensaje a #${currentChannelData.name}...`}
                    />
                    <div className="composer-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="composer-action-btn"
                        onPress={() => setComposerText(prev => prev + ' 🚀 ')}
                      >
                        😊
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        className="composer-send-btn"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                      </Button>
                    </div>
                  </div>
                </form>
                <div className="composer-hints">
                  <span className="hint-text">Presiona <strong>Enter</strong> para enviar mensaje o contactar directamente</span>
                </div>
              </footer>

            </main>

          </div>

          {/* Floating Quick Action Pill */}
          <aside
            className="quick-contact-pill"
            onClick={() => { setActiveChannel('dms'); setActiveTab('messages'); }}
          >
            <div className="pill-profile">
              <img src="/assets/schwarckdev-logo.svg" alt="SchwarckDev" className="pill-avatar" width="28" height="28" />
              <div className="pill-info">
                <span className="pill-title">Hablemos</span>
                <span className="pill-status">Disponible para proyectos</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              className="pill-cta-btn"
              onPress={() => { setActiveChannel('dms'); setActiveTab('messages'); }}
            >
              Contactar
            </Button>
          </aside>

        </div>
      </div>

      {/* Spec Deep Dive Modal */}
      {selectedSpec && SPECS[selectedSpec] && (
        <div className="spec-modal-backdrop" onClick={() => setSelectedSpec(null)}>
          <div className="spec-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <header className="spec-modal-header">
              <div className="spec-modal-title-box">
                <Chip size="sm" variant="soft" className="spec-modal-badge">
                  {SPECS[selectedSpec].badge}
                </Chip>
                <h2 className="spec-modal-title">{SPECS[selectedSpec].title}</h2>
              </div>
              <button className="spec-modal-close" onClick={() => setSelectedSpec(null)}>
                &times;
              </button>
            </header>

            <div className="spec-modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <img
                  src={SPECS[selectedSpec].icon}
                  width="56"
                  height="56"
                  style={{ borderRadius: '12px', padding: '4px', background: 'rgba(255,255,255,0.08)', objectFit: 'contain' }}
                />
                <div>
                  <h3 style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>{SPECS[selectedSpec].subtitle}</h3>
                </div>
              </div>

              <p style={{ marginBottom: '16px' }}>{SPECS[selectedSpec].desc}</p>

              {SPECS[selectedSpec].modules && (
                <>
                  <h4 style={{ color: 'var(--accent-cyan)', margin: '16px 0 8px' }}>Capacidades & Módulos Clave</h4>
                  <ul className="bullet-list" style={{ marginBottom: '20px' }}>
                    {SPECS[selectedSpec].modules.map((m, idx) => (
                      <li key={idx}><strong>{m.name}:</strong> {m.desc}</li>
                    ))}
                  </ul>
                </>
              )}

              {SPECS[selectedSpec].stack && (
                <>
                  <h4 style={{ color: 'var(--accent-cyan)', margin: '16px 0 8px' }}>Stack Tecnológico</h4>
                  <div className="project-stack-row">
                    {SPECS[selectedSpec].stack.map((t, idx) => (
                      <Chip key={idx} size="sm" variant="outline" className="tech-tag">{t}</Chip>
                    ))}
                  </div>
                </>
              )}

              {SPECS[selectedSpec].code && (
                <div className="arch-card" style={{ background: 'rgba(0,0,0,0.3)', marginTop: '12px' }}>
                  <pre style={{ fontFamily: 'var(--font-code)', fontSize: '0.82rem', color: 'var(--accent-cyan)', overflowX: 'auto' }}>
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

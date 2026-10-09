/**
 * SchwarckDev - Frontend Core Logic & Micro-Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  // Current Year
  const yearEl = document.getElementById('currentYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Cursor Glow Tracking
  const cursorGlow = document.getElementById('cursorGlow');
  if (cursorGlow && window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('mousemove', (e) => {
      cursorGlow.style.left = `${e.clientX}px`;
      cursorGlow.style.top = `${e.clientY}px`;
    });
  }

  // Sticky Navbar Scroll State
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenuDrawer = document.getElementById('mobileMenuDrawer');
  if (mobileMenuBtn && mobileMenuDrawer) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenuDrawer.classList.toggle('open');
    });

    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenuDrawer.classList.remove('open');
      });
    });
  }

  // Theme Toggle (Dark / Light)
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const savedTheme = localStorage.getItem('schwarckdev_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('schwarckdev_theme', next);
    });
  }

  // Toast Notification System
  const toastContainer = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');
  let toastTimer = null;

  function showToast(msg, duration = 3000) {
    if (!toastContainer) return;
    toastMessage.textContent = msg;
    toastContainer.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastContainer.classList.remove('show');
    }, duration);
  }

  // Copy Email Button
  const copyEmailBtn = document.getElementById('copyEmailBtn');
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener('click', () => {
      const email = copyEmailBtn.getAttribute('data-email') || 'alanleones2013@gmail.com';
      navigator.clipboard.writeText(email).then(() => {
        showToast('¡Correo copiado al portapapeles! (' + email + ')');
      }).catch(() => {
        showToast('Correo: ' + email);
      });
    });
  }

  // App Modal Deep-Dive Data
  const appData = {
    cerofiao: {
      title: 'CeroFiao — Sistema Financiero Inteligente',
      icon: 'assets/cerofiao-logo.svg',
      category: 'Finanzas Personales & Gestión de Deudas',
      id: 'com.schwarckdev.cerofiao',
      description: 'CeroFiao está construida desde sus cimientos para resolver los problemas reales de control financiero en economías multi-moneda (USD, VES, EUR), erradicando el desorden de cuentas por cobrar y deudas pendientes.',
      modules: [
        'Dashboard Financiero: Balance consolidado por divisas, flujo mensual y gráficos de tendencia.',
        'Módulo de Deudas ("Fiao"): Registro minucioso de deudores, acreedores, abonos parciales y recordatorios.',
        'Tasas de Cambio en Vivo: Integración automática de tasas oficiales con conversión al vuelo.',
        'Presupuestos Inteligentes: Asignación por categorías con alertas de sobregiro y analíticas detalladas.',
        'Alcancía y Metas de Ahorro: Proyección de objetivos con seguimiento de aportes progresivos.',
        'Exportación CSV & Respaldo: Soberanía de datos 100% local, exportable para auditoría personal.'
      ],
      stack: ['Kotlin 2.0+', 'Jetpack Compose', 'Clean Architecture (Data, Domain, Presentation)', 'Room Database', 'StateFlow & Coroutines', 'Material 3 Custom Tokens']
    },
    lionfitness: {
      title: 'Lion Fitness — Entrenamiento de Alta Intensidad',
      icon: 'assets/lionfitness-logo.png',
      category: 'Rendimiento Deportivo & Fuerza',
      id: 'com.schwarckstudio.lionfitness',
      description: 'Lion Fitness es la herramienta definitiva para quienes entrenan con seriedad. Elimina libretas y aplicaciones complejas para enfocarse en lo que importa: progresar en cada serie.',
      modules: [
        'Registro Ágil de Series: Pesos, repeticiones y cálculo automático de RPE y 1RM estimada.',
        'Cronómetro de Descanso con Háptica: Alertas táctiles que te avisan sin necesidad de mirar la pantalla.',
        'Sobrecarga Progresiva Visual: Gráficos de evolución por grupo muscular y marcas históricas.',
        'Sistema de Diseño Enérgico: Interfaz inspirada en OneUI con tipografía Anton y componentes a medida.',
        '100% Offline: No requiere internet para registrar ni consultar el historial en el gimnasio.'
      ],
      stack: ['Kotlin', 'Jetpack Compose', 'Custom Design System (Anton + OneUI)', 'Room SQLite', 'Android Haptic API', 'Coroutines']
    }
  };

  // Modal Handling
  const modalBackdrop = document.getElementById('appModalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalContent = document.getElementById('modalAppContent');

  function openAppModal(appKey) {
    const data = appData[appKey];
    if (!data || !modalContent) return;

    modalContent.innerHTML = `
      <div class="modal-hero">
        <img src="${data.icon}" alt="${data.title}" class="modal-icon">
        <div>
          <span class="category-badge">${data.category}</span>
          <h2 class="modal-title" id="modalAppTitle">${data.title}</h2>
          <span class="app-version-tag"><code>${data.id}</code></span>
        </div>
      </div>
      <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px;">${data.description}</p>
      
      <h3 class="modal-section-title">Módulos & Capacidades Clave</h3>
      <ul class="modal-list">
        ${data.modules.map(m => `<li>${m}</li>`).join('')}
      </ul>

      <h3 class="modal-section-title">Arquitectura & Tecnologías</h3>
      <div class="tech-chips" style="margin-top: 10px;">
        ${data.stack.map(s => `<span class="tech-chip">${s}</span>`).join('')}
      </div>

      <div style="margin-top: 32px; display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn btn-secondary btn-sm" id="modalCloseAction">Cerrar</button>
      </div>
    `;

    modalBackdrop.classList.add('open');
    modalBackdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const closeAction = document.getElementById('modalCloseAction');
    if (closeAction) closeAction.addEventListener('click', closeAppModal);
  }

  function closeAppModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove('open');
    modalBackdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.open-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const appKey = e.currentTarget.getAttribute('data-app');
      openAppModal(appKey);
    });
  });

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeAppModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeAppModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) {
      closeAppModal();
    }
  });

  // Contact Form Handling
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('contactName').value;
      const email = document.getElementById('contactEmail').value;
      const subject = document.getElementById('contactSubject').value;
      const message = document.getElementById('contactMessage').value;

      const mailtoUrl = `mailto:alanleones2013@gmail.com?subject=${encodeURIComponent('[SchwarckDev Contact] ' + subject)}&body=${encodeURIComponent('De: ' + name + ' (' + email + ')\n\n' + message)}`;
      
      window.location.href = mailtoUrl;
      showToast('Abriendo cliente de correo para enviar mensaje...');
    });
  }
});

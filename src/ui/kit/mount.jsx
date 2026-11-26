// Arranque común de las páginas hechas con HeroUI: estilos, idioma y avisos.
// HeroUI v3 no necesita Provider; lo que sí hace falta una vez por página es el
// idioma de las fechas y números (I18nProvider) y la zona de los avisos (Toast).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, Toast } from '@heroui/react';
import '../app.css';

export function mount(app, { toasts = 'bottom end' } = {}) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <I18nProvider locale="es-VE">
        {app}
        <Toast.Provider placement={toasts} />
      </I18nProvider>
    </StrictMode>,
  );
}

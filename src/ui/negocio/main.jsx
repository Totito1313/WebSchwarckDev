import { toast } from '@heroui/react';
import { mount } from '../kit/mount.jsx';
import { registerWorker } from '../kit/install.js';
import { NegocioApp } from './App.jsx';

// Instalable como app de escritorio (Edge o Chrome › «Instalar Negocio»): abre al
// momento y, sin conexión, enseña la última versión guardada.
registerWorker('/admin/negocio/sw.js', '/admin/negocio/');

// Algunas cuentas que se reutilizan del panel de siempre (negocio-core.js y
// compañía) avisan escribiendo en un elemento [data-toast]. Aquí ese elemento
// existe, oculto, y lo que escriben sale como un aviso de HeroUI.
const box = Object.assign(document.createElement('div'), { hidden: true });
box.dataset.toast = '';
document.body.append(box);
new MutationObserver(() => {
  const text = box.textContent.trim();
  if (!text) return;
  if (box.dataset.kind === 'error') toast.danger(text);
  else toast(text);
  box.textContent = '';
}).observe(box, { childList: true, characterData: true, subtree: true });

mount(<NegocioApp />);

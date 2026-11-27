import { mount } from '../kit/mount.jsx';
import { registerWorker } from '../kit/install.js';
import { PortalApp } from './App.jsx';

// Instalable en el teléfono: abre sin conexión y recibe los avisos push.
registerWorker('/cliente-nuevo/sw.js', '/cliente-nuevo/');

mount(<PortalApp />, { toasts: 'top' });

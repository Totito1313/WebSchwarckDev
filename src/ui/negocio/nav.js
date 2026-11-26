// La organización de Negocio: seis zonas y, dentro de cada una, sus secciones en
// el orden en que se trabajan. Ventas sigue el camino de un cliente (lead →
// cliente → propuesta → cotización → factura) y termina en lo que se vende;
// Trabajo, de lo grande a lo pequeño (proyecto → tarea → horas) y las notas;
// Dinero, lo que entra y lo que sale; Crecer, marketing y los portales; Negocio,
// los ajustes.
import {
  BookOpen,
  Box,
  CircleDollar,
  Clock,
  CreditCard,
  FileText,
  Folder,
  Funnel,
  Gear,
  House,
  ListCheck,
  Megaphone,
  PaperPlane,
  Persons,
  Receipt,
  Smartphone,
  SquareArticle,
  Wallet,
  ArrowDownToLine,
} from '@gravity-ui/icons';

export const AREAS = [
  { id: 'inicio', label: 'Inicio', icon: House, sections: [{ id: 'inicio', label: 'Resumen', icon: House }] },
  {
    id: 'ventas',
    label: 'Ventas',
    icon: Funnel,
    sections: [
      { id: 'leads', label: 'Leads', icon: Funnel },
      { id: 'clientes', label: 'Clientes', icon: Persons },
      { id: 'propuestas', label: 'Propuestas', icon: PaperPlane },
      { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText },
      { id: 'facturas', label: 'Facturas', icon: Receipt },
      { id: 'catalogo', label: 'Catálogo', icon: Box },
    ],
  },
  {
    id: 'trabajo',
    label: 'Trabajo',
    icon: Folder,
    sections: [
      { id: 'proyectos', label: 'Proyectos', icon: Folder },
      { id: 'tareas', label: 'Tareas', icon: ListCheck },
      { id: 'horas', label: 'Horas', icon: Clock },
      { id: 'paginas', label: 'Páginas', icon: SquareArticle },
    ],
  },
  {
    id: 'dinero',
    label: 'Dinero',
    icon: Wallet,
    sections: [
      { id: 'cobros', label: 'Cobros', icon: CircleDollar },
      { id: 'gastos', label: 'Gastos', icon: Wallet },
    ],
  },
  {
    id: 'crecer',
    label: 'Crecer',
    icon: Megaphone,
    sections: [
      { id: 'marketing', label: 'Marketing', icon: Megaphone },
      { id: 'portal', label: 'Portal de clientes', icon: Smartphone },
    ],
  },
  {
    id: 'negocio',
    label: 'Negocio',
    icon: Gear,
    sections: [
      { id: 'ajustes', label: 'Mi negocio', icon: Gear },
      { id: 'formas-de-cobro', label: 'Formas de cobro', icon: CreditCard },
      { id: 'biblioteca', label: 'Biblioteca', icon: BookOpen },
      { id: 'copia', label: 'Copia de seguridad', icon: ArrowDownToLine },
    ],
  },
];

export const SECTIONS = AREAS.flatMap((a) => a.sections.map((s) => ({ ...s, area: a.id })));
export const sectionOf = (id) => SECTIONS.find((s) => s.id === id) || null;
export const areaOf = (sectionId) => AREAS.find((a) => a.sections.some((s) => s.id === sectionId)) || AREAS[0];

const LAST = 'negocio-zona-';
/** La última sección abierta de cada zona: al volver a la zona se vuelve ahí. */
export const lastSection = (area) => {
  try {
    const id = localStorage.getItem(LAST + area.id);
    return area.sections.some((s) => s.id === id) ? id : area.sections[0].id;
  } catch {
    return area.sections[0].id;
  }
};
export const rememberSection = (sectionId) => {
  try {
    localStorage.setItem(LAST + areaOf(sectionId).id, sectionId);
  } catch {
    // Sin almacenamiento, cada zona abre su primera sección.
  }
};

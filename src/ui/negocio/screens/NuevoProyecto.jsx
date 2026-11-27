// Nuevo proyecto, paso a paso en vez de un formulario: qué es (con plantillas que
// traen sus etapas y sus primeras tareas), para quién, cómo se cobra, los plazos y
// un resumen antes de crearlo. Editar un proyecto ya hecho sigue en ProjectForm.
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Calendar, CircleCheck, Folder, Globe, Megaphone, Palette, PersonPlus, Smartphone, Wrench } from '@gravity-ui/icons';
import { Button, Description, Input, Label, Modal, ScrollShadow, SearchField, TextArea, TextField, toast } from '@heroui/react';
import { addDays, dateText, find, money, put, todayISO, uid } from '../../../negocio-core.js';
import { DEFAULT_STAGES, cleanCode, codeFrom, newProject, newTask, takenCodes } from '../../../negocio-work.js';
import { Person } from '../../kit/parts.jsx';
import { SwitchField } from '../../kit/SwitchField.jsx';
import { Stepper } from '../../pro/index.js';
import { CurrencyPicker } from '../currency.jsx';
import { AmountField, DateInput } from '../fields.jsx';
import { useCrm } from '../store.js';
import { CustomerForm } from './Clientes.jsx';

export const PROJECT_TEMPLATES = [
  {
    id: 'web',
    label: 'Página web',
    icon: Globe,
    stages: ['Descubrimiento', 'Diseño', 'Desarrollo', 'Revisión', 'Publicación'],
    tasks: ['Reunión de arranque', 'Mapa del sitio y contenidos', 'Diseño de la portada', 'Diseño de las páginas internas', 'Maquetar y programar', 'Probar en el teléfono', 'Publicar y entregar los accesos'],
  },
  {
    id: 'app',
    label: 'App',
    icon: Smartphone,
    stages: ['Descubrimiento', 'Prototipo', 'Desarrollo', 'Pruebas', 'Publicación'],
    tasks: ['Reunión de arranque', 'Flujo de pantallas', 'Prototipo navegable', 'Primera versión', 'Pruebas con usuarios', 'Publicar en las tiendas'],
  },
  {
    id: 'brand',
    label: 'Identidad de marca',
    icon: Palette,
    stages: ['Brief', 'Bocetos', 'Propuesta', 'Ajustes', 'Entrega'],
    tasks: ['Brief con el cliente', 'Referencias y moodboard', 'Bocetos del logo', 'Propuesta final', 'Manual de marca', 'Entregar los archivos'],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    stages: ['Estrategia', 'Contenido', 'Publicación', 'Resultados'],
    tasks: ['Objetivos y público', 'Calendario de contenido', 'Diseñar las piezas', 'Publicar y responder', 'Informe de resultados'],
  },
  { id: 'care', label: 'Mantenimiento', icon: Wrench, stages: ['Arranque', 'En curso', 'Informe'], tasks: ['Accesos y copias de seguridad', 'Revisión del mes', 'Informe al cliente'] },
  { id: 'blank', label: 'En blanco', icon: Folder, stages: DEFAULT_STAGES, tasks: [] },
];

const MODES = [
  ['fixed', 'Precio cerrado', 'Un total acordado. Las horas se cuentan para saber si sale a cuenta.'],
  ['hours', 'Por horas', 'Cobras las horas que registres, a una tarifa.'],
  ['both', 'Las dos', 'Un presupuesto y, aparte, las horas extra.'],
];
const SPANS = [
  ['2 semanas', 14],
  ['1 mes', 30],
  ['2 meses', 60],
  ['3 meses', 90],
];
const STEPS = [
  { id: 'what', title: 'El proyecto' },
  { id: 'who', title: 'Cliente' },
  { id: 'money', title: 'Cobro' },
  { id: 'when', title: 'Plazos' },
  { id: 'done', title: 'Listo' },
];
const plain = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Choice({ on, onPress, children, className = '' }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPress}
      className={`flex items-start gap-3 rounded-2xl p-3 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-secondary hover:bg-default'} ${className}`}
    >
      {children}
    </button>
  );
}

export function NuevoProyecto({ customer: presetCustomer = null, onClose, onCreated }) {
  const [state] = useCrm();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [tplId, setTplId] = useState('web');
  const [customerId, setCustomerId] = useState(presetCustomer?.id || '');
  const [query, setQuery] = useState('');
  const [newCustomer, setNewCustomer] = useState(false);
  const [mode, setMode] = useState('fixed');
  const [currency, setCurrency] = useState(presetCustomer?.currency || state.settings.currency || 'USD');
  const [budget, setBudget] = useState(0);
  const [rate, setRate] = useState(Number(state.settings.hourlyRate) || 0);
  const [start, setStart] = useState(todayISO());
  const [due, setDue] = useState('');
  const [makeTasks, setMakeTasks] = useState(true);
  const [startNow, setStartNow] = useState(true);
  const [error, setError] = useState('');

  const tpl = PROJECT_TEMPLATES.find((t) => t.id === tplId) || PROJECT_TEMPLATES[0];
  const shownCode = codeTouched ? code : name.trim() ? codeFrom(name, takenCodes('')) : '';
  const customer = customerId ? find('customers', customerId) : null;
  const customers = useMemo(() => {
    const q = plain(query.trim());
    return state.customers.filter((c) => !q || plain(`${c.name} ${c.company || ''} ${c.email || ''}`).includes(q));
  }, [state.customers, query]);

  const check = (i) => {
    if (i === 0) {
      if (!name.trim()) return 'Ponle un nombre al proyecto.';
      const c = cleanCode(shownCode);
      if (!/^[A-Z][A-Z0-9]{0,5}$/.test(c)) return 'La clave tiene que empezar por una letra (hasta 6 letras o números).';
      if (takenCodes('').has(c)) return `La clave ${c} ya la usa otro proyecto.`;
    }
    if (i === 1 && !customerId) return 'Elige de qué cliente es (o crea uno nuevo).';
    if (i === 3 && due && start && due < start) return 'La entrega no puede ser antes del comienzo.';
    return '';
  };
  const go = (to) => {
    // Hacia delante, cada paso tiene que estar bien; hacia atrás, siempre se puede.
    for (let i = step; i < to; i += 1) {
      const msg = check(i);
      if (msg) {
        setStep(i);
        setError(msg);
        return;
      }
    }
    setError('');
    setStep(to);
  };

  const create = () => {
    for (let i = 0; i < 4; i += 1) {
      const msg = check(i);
      if (msg) {
        setStep(i);
        setError(msg);
        return;
      }
    }
    const p = newProject(customer);
    Object.assign(p, {
      name: name.trim(),
      code: cleanCode(shownCode),
      customerId,
      currency,
      budget: mode === 'hours' ? 0 : budget,
      rate,
      startDate: start,
      dueDate: due,
      description: description.trim(),
      status: startNow ? 'active' : 'pending',
      stages: tpl.stages.map((stage) => ({ id: uid(), name: stage, done: false })),
    });
    put('projects', p);
    if (makeTasks) tpl.tasks.forEach((title, i) => put('tasks', { ...newTask({ projectId: p.id }), title, order: (i + 1) * 10 }));
    toast.success(`Proyecto ${p.code} creado${makeTasks && tpl.tasks.length ? ` con ${tpl.tasks.length} tareas` : ''}`);
    onCreated?.(p);
    onClose();
  };

  const last = step === STEPS.length - 1;

  return (
    <>
    <Modal isOpen onOpenChange={(o) => !o && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[720px]">
            <Modal.CloseTrigger />
            <Modal.Header className="gap-4">
              <Modal.Heading>Nuevo proyecto</Modal.Heading>
              <Stepper steps={STEPS} current={step} orientation="horizontal" onChange={(i) => (i < step ? go(i) : go(i))} label="Pasos para crear el proyecto" />
            </Modal.Header>
            <Modal.Body className="px-1">
              <ScrollShadow className="max-h-[56vh] px-1" hideScrollBar>
                <form
                  className="flex min-h-[19rem] flex-col gap-5 py-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (last) create();
                    else go(step + 1);
                  }}
                >
                  {step === 0 && (
                    <>
                      <TextField value={name} onChange={setName} maxLength={120} autoFocus>
                        <Label>¿Cómo se llama?</Label>
                        <Input placeholder="Rediseño de la web de Café Ávila" className="text-base" />
                      </TextField>
                      <div className="flex flex-col gap-2">
                        <Label>¿Qué tipo de proyecto es?</Label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {PROJECT_TEMPLATES.map((t) => (
                            <Choice key={t.id} on={tplId === t.id} onPress={() => setTplId(t.id)}>
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface">
                                <t.icon className="size-4" />
                              </span>
                              <span className="flex min-w-0 flex-col">
                                <span className="text-sm font-medium">{t.label}</span>
                                <span className="text-xs text-muted">
                                  {t.stages.length} etapas{t.tasks.length ? ` · ${t.tasks.length} tareas` : ''}
                                </span>
                              </span>
                            </Choice>
                          ))}
                        </div>
                        <Description>Etapas: {tpl.stages.join(' → ')}</Description>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                        <TextField
                          value={shownCode}
                          onChange={(t) => {
                            setCode(cleanCode(t));
                            setCodeTouched(true);
                          }}
                          maxLength={6}
                        >
                          <Label>Clave</Label>
                          <Input placeholder="WEB" className="font-mono uppercase" />
                          <Description>Tareas: {shownCode || 'WEB'}-1, -2…</Description>
                        </TextField>
                        <TextField value={description} onChange={setDescription} maxLength={2000}>
                          <Label>En una frase (opcional)</Label>
                          <TextArea rows={2} placeholder="Qué se entrega y para qué" />
                        </TextField>
                      </div>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label>¿Para quién es?</Label>
                        <SearchField aria-label="Buscar cliente" value={query} onChange={setQuery} className="w-full sm:w-64">
                          <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder="Buscar cliente…" />
                            <SearchField.ClearButton />
                          </SearchField.Group>
                        </SearchField>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Choice on={false} onPress={() => setNewCustomer(true)} className="border border-dashed border-border bg-transparent">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                            <PersonPlus className="size-4" />
                          </span>
                          <span className="flex flex-col">
                            <span className="text-sm font-medium">Cliente nuevo</span>
                            <span className="text-xs text-muted">Lo creas ahora y sigues</span>
                          </span>
                        </Choice>
                        {customers.slice(0, 40).map((c) => (
                          <Choice
                            key={c.id}
                            on={customerId === c.id}
                            onPress={() => {
                              setCustomerId(c.id);
                              if (c.currency) setCurrency(c.currency);
                              setError('');
                            }}
                          >
                            <Person name={c.name} />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-medium">{c.name}</span>
                              <span className="truncate text-xs text-muted">{[c.company, c.currency].filter(Boolean).join(' · ') || 'Cliente'}</span>
                            </span>
                          </Choice>
                        ))}
                      </div>
                      {!customers.length && <p className="text-sm text-muted">Ningún cliente coincide. Crea uno nuevo.</p>}
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label>¿Cómo lo cobras?</Label>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {MODES.map(([id, title, text]) => (
                            <Choice key={id} on={mode === id} onPress={() => setMode(id)} className="flex-col gap-1">
                              <span className="text-sm font-medium">{title}</span>
                              <span className="text-xs text-muted">{text}</span>
                            </Choice>
                          ))}
                        </div>
                      </div>
                      <CurrencyPicker label="Moneda" value={currency} onChange={setCurrency} showName={false} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        {mode !== 'hours' && <AmountField label={`${mode === 'both' ? 'Presupuesto' : 'Precio total'} (${currency})`} value={budget} onChange={setBudget} />}
                        <AmountField
                          label={`Tarifa por hora (${currency})`}
                          value={rate}
                          onChange={setRate}
                          description={mode === 'fixed' ? 'Solo para saber cuánto vale tu tiempo; no se cobra aparte.' : 'La de sus tareas y horas, si no tienen otra.'}
                        />
                      </div>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <DateInput label="Empieza" value={start} onChange={setStart} />
                        <DateInput label="Entrega" value={due} onChange={setDue} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Entrega en…</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {SPANS.map(([label, days]) => {
                            const target = addDays(start || todayISO(), days);
                            return (
                              <Button key={label} size="sm" variant={due === target ? 'primary' : 'tertiary'} onPress={() => setDue(target)}>
                                <Calendar />
                                {label}
                              </Button>
                            );
                          })}
                          <Button size="sm" variant={!due ? 'primary' : 'tertiary'} onPress={() => setDue('')}>
                            Sin fecha
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  {step === 4 && (
                    <>
                      <dl className="grid gap-x-6 gap-y-3 rounded-2xl bg-surface-secondary p-4 text-sm sm:grid-cols-2">
                        {[
                          ['Proyecto', `${name.trim()} · ${cleanCode(shownCode)}`],
                          ['Cliente', customer?.name || '—'],
                          ['Tipo', `${tpl.label} (${tpl.stages.length} etapas)`],
                          ['Cobro', mode === 'hours' ? `Por horas a ${money(rate, currency)}` : `${money(budget, currency)}${mode === 'both' ? ` + horas a ${money(rate, currency)}` : ''}`],
                          ['Empieza', start ? dateText(start) : '—'],
                          ['Entrega', due ? dateText(due) : 'Sin fecha'],
                        ].map(([k, v]) => (
                          <div key={k} className="flex flex-col">
                            <dt className="text-xs text-muted">{k}</dt>
                            <dd className="font-medium">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      {tpl.tasks.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <SwitchField label={`Crear sus ${tpl.tasks.length} primeras tareas`} isSelected={makeTasks} onChange={setMakeTasks} />
                          {makeTasks && (
                            <ul className="ms-12 flex flex-wrap gap-1.5">
                              {tpl.tasks.map((t) => (
                                <li key={t} className="rounded-full bg-surface-secondary px-2.5 py-1 text-xs">
                                  {t}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      <SwitchField label="Empieza ya" description="En curso desde hoy. Si no, queda pendiente." isSelected={startNow} onChange={setStartNow} />
                    </>
                  )}
                  {error && <p className="text-sm text-danger">{error}</p>}
                  <button type="submit" hidden aria-hidden tabIndex={-1} />
                </form>
              </ScrollShadow>
            </Modal.Body>
            <Modal.Footer>
              {step > 0 && (
                <Button variant="ghost" onPress={() => go(step - 1)}>
                  <ArrowLeft />
                  Atrás
                </Button>
              )}
              <span className="flex-1" />
              {last ? (
                <Button onPress={create}>
                  <CircleCheck />
                  Crear proyecto
                </Button>
              ) : (
                <Button onPress={() => go(step + 1)}>
                  Siguiente
                  <ArrowRight />
                </Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
      <CustomerForm
        isOpen={newCustomer}
        onOpenChange={setNewCustomer}
        onSaved={(c) => {
          setCustomerId(c.id);
          if (c.currency) setCurrency(c.currency);
          setNewCustomer(false);
          setError('');
        }}
      />
    </>
  );
}

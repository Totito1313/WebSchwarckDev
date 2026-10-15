# Runey: investigación para una versión propia

Investigación del 14 de octubre de 2026 sobre [runey.app](https://runey.app), su [registro de novedades](https://runey.app/updates) y sus seis páginas de funciones. Sirve de base para construir algo parecido con la estética de [CeroFiao](https://schwarckdev.com/cerofiao/).

Las fuentes son tres:

- El texto de cada página.
- Las capturas de producto que Runey publica en ellas: dashboard, proyecto, tareas, cliente, gastos, facturas, editor de factura, pagos parciales, enlaces de pago, propuesta y temporizador. Muestran datos de demostración.
- Capturas de la app por dentro, hechas con una cuenta propia en modo oscuro y sin datos: proyectos, un proyecto con su resumen, tareas y horas, tareas globales, páginas, facturas y gastos. Muestran la versión actual.

Lo que solo sale en una captura está marcado como tal.

---

## 1. Qué es Runey

Una sola app para llevar el negocio de un freelancer, un estudio o una agencia pequeña: clientes, propuestas, proyectos, tareas, horas, facturas, cobros y gastos. Su lema es *"Run your business in one place"* y dice reemplazar unas 8 herramientas.

- **Salió el 1 de abril de 2026.** En seis meses y medio ha publicado 25 novedades, casi todas entre abril y mayo.
- **Precios** (cobra con Polar, 14 días de prueba sin tarjeta):

  | Plan | Para | Precio | Usuarios |
  |---|---|---|---|
  | Solo | Freelancers | $90/año (≈ $7,5/mes) | 1 |
  | Team | Equipos pequeños | $190/año (≈ $15,83/mes) | Hasta 3 |
  | Agency | Agencias | $390/año (≈ $32,5/mes) | Hasta 10 |
  | Lifetime | — | Sin precio visible | — |

  Todos los planes incluyen facturas, propuestas, proyectos y clientes ilimitados, portal de cliente y gastos. Team añade asignaciones, menciones, espacio compartido y registro de actividad.
- **Idiomas de los documentos:** inglés, francés, alemán y español.
- **Integraciones:** Stripe Connect, Zapier, webhooks, Slack, una app de macOS para cronometrar y correo por Resend.
- **Autor:** la web no lo nombra. Todas las capturas usan la cuenta "Solt Wagner"; puede ser el fundador, pero no está confirmado.

### El recorrido que vende

La portada lo cuenta en 11 pasos encadenados. Es la columna vertebral del producto: cada paso hereda datos del anterior.

1. **Cliente**: se guarda en el CRM y se le enlazan proyectos.
2. **Brief**: objetivos, alcance y referencias en una página.
3. **Propuesta**: con secciones, testimonios y precios.
4. **Contrato**: el cliente firma desde un enlace público, escribiendo o dibujando, con fecha y hora.
5. **Proyecto**: vistas kanban, calendario y línea de tiempo.
6. **Tareas**: responsables, fechas y checklists.
7. **Documentación**: páginas del proyecto para actas, especificaciones y decisiones.
8. **Horas**: temporizador o registro manual; la tarifa por hora pasa a la factura.
9. **Factura**: las tareas hechas y las horas se convierten en factura con un clic.
10. **Cobro**: tarjeta con Stripe o enlaces propios con código QR.
11. **Recibo**: recibos y facturas fiscales automáticos y archivados.

---

## 2. Cómo es la interfaz (de las capturas)

Todas las pantallas siguen las mismas piezas. Copiarlas es lo que hace que el producto se sienta uno solo.

**Estructura fija**
- **Riel de iconos a la izquierda**, una cápsula alta con esquinas muy redondeadas. De arriba abajo: logo, `+` (crear cualquier cosa), Dashboard, Clientes, Proyectos, Tareas, Páginas, Facturas, Gastos, Cotizaciones, Propuestas, Catálogo y Reportes. Abajo: Ajustes, Ayuda y las iniciales de la cuenta.
- **Segunda barra lateral** en Proyectos y Páginas, en una tarjeta redondeada del mismo tono que las del contenido. En el listado muestra "Projects · 1 project" con un `+`, "All projects" con su recuento y cada proyecto con su logo. Dentro de un proyecto muestra sus secciones. Tareas, Facturas y Gastos no la llevan y usan todo el ancho.
- **Arriba a la izquierda**: plegar la segunda barra y volver.
- **Arriba a la derecha**: `Upgrade` (en la cuenta de prueba), temporizador global, buscar, notificaciones con contador y avatar.
- **Modo oscuro**: fondo casi negro (`#0d0d0d` aprox.), tarjetas grises (`#1a1a1a` aprox.) sin borde, y el botón principal se invierte a claro con texto oscuro. Es casi lo mismo que hace CeroFiao en oscuro.
- **Estados vacíos**: icono en un cuadro redondeado, título ("No tasks yet"), una línea de explicación y una píldora (`+ Add First Task`).

**Página de listado** (Facturas, Gastos, Tareas)
- Título grande y una línea de explicación ("Track spending, vendors and categories across your business").
- Selector de periodo (`Last 30 Days`) y botón píldora oscuro `+ New` / `+ Add`.
- **Fila de 4 tarjetas KPI**: etiqueta, icono en círculo arriba a la derecha, cifra grande, subtítulo, y un chip de variación (`+181%`, en verde o rojo) o una barra de progreso con porcentaje.
- **Tarjeta de gráfico** a todo el ancho: barras finas y redondeadas por día, con el logo del proveedor o los avatares de los clientes encima de cada barra. Lleva leyenda y un selector `Bar | Month` (por días o por meses). Sin datos se ve una fila de puntos, uno por día.
- **Lista** con filtros en píldoras (orden, tipo, estado), cambio lista/cuadrícula y buscador. Se agrupa por mes con el total del mes y un botón para descargar todo el mes.

**Página de detalle** (Proyecto, Cliente)
- Cuadro con el logo, la inicial o la foto, nombre grande y el cliente enlazado.
- Fila de datos: presupuesto, fecha de creación, quién lo creó, o email, teléfono, web y dirección.
- A la derecha: chip de estado (`Active` en azul, `Completed` en verde), menú `…`, `Share` y `+ New`. En el proyecto, `+ New` abre un menú: nueva factura, nueva cotización, nueva propuesta, añadir tarea y añadir archivo.
- **Secciones del proyecto** en la segunda barra: Dashboard, Tasks, Time, Documents, Assets, Pages, Description y Activity. Las capturas promocionales, más antiguas, las ponían en una barra flotante centrada arriba. El cliente aún las tiene así: resumen, documentos, proyectos y actividad.
- **6 tarjetas KPI**, la **tarjeta de etapas**, un **calendario de actividad** (Timeline / Week / Month / Today) con eventos en chips de color (`Project created`, `Payment received $9,545`, `REC-0005 sent`), documentos enlazados y feed de actividad.
- **Dock flotante abajo** (en las capturas promocionales) con los avatares de los proyectos o clientes recientes, para saltar de uno a otro.

**Listado de proyectos**
- KPIs: Activos ("In progress"), Pendientes ("Awaiting kickoff"), Completados ("Delivered") y Total.
- Vista de tarjetas, lista o kanban, botón `Filters`, buscador y un círculo para seleccionar todos.
- **Tarjeta de proyecto**: logo, chip de estado, nombre, barra de tareas hechas (`0/0`), cliente (o "No client"), importe y un anillo de progreso.

**Editor de documento** (Factura, Propuesta, Página)
- Barra superior: volver, selector de tipo (`Invoice ▾`) o chip de estado (`Draft`, `Pending`, `Sent`), cliente (`Select customer ▾`) y proyecto. A la derecha: diseño, paleta, plantillas (icono de capas, en Páginas), ajustes, `…`, `Share` o `Save ▾` y `Create`.
- **La hoja blanca va centrada.** En facturas y propuestas se apoya sobre una imagen de fondo a pantalla completa (prado con flores, degradado, ondas oscuras). En Páginas, sobre el fondo de la app.
- Panel lateral derecho para personalizar o registrar pagos.
- **Barra de bloques flotante** abajo: texto, imagen, vídeo, cita, destacado, tabla, columnas y más.
- **Páginas**: círculo para la imagen o el icono ("Add image or icon"), título ("Untitled page") y cuerpo con comandos `/` ("Write something, or type "/" for commands…"). Estado borrador o publicada.
- Burbuja de chat abajo a la derecha.

---

## 3. Las novedades, una por una

Ordenadas de la más antigua a la más nueva. Las cinco del 1 de abril son el lanzamiento.

| Fecha | Novedad | Qué añadió |
|---|---|---|
| 1 abr | Lanzamiento | Facturas, cotizaciones, propuestas, clientes, proyectos, tareas y gastos. |
| 1 abr | Stripe, enlaces de pago y QR | Pago con tarjeta por Stripe; enlaces propios (PayPal, Wise, banco) que se vuelven un botón en la factura; código QR automático para pagar desde el móvil. |
| 1 abr | Recibos y pagos parciales | Varios pagos por factura, un recibo por cada uno, pagado y saldo pendiente al día. Sirve para anticipos y cuotas. |
| 1 abr | Propuestas | Imágenes, vídeos, testimonios, citas, tablas, fondos, colores y cabeceras. Estadísticas de propuestas creadas, ganadas y perdidas. |
| 1 abr | Zapier y webhooks | Crear clientes, proyectos, facturas o tareas desde otras apps, y mandar datos de Runey fuera. |
| 2 abr | Enlaces protegidos y con caducidad | Contraseña en el enlace público de la factura y vencimiento en días. |
| 5 abr | Horas y factura desde el proyecto | Cronometrar por tarea o por proyecto con tarifa por hora; al facturar el proyecto se rellenan las tareas hechas con sus horas como cantidad. |
| 8 abr | Compartir proyectos con el cliente | Un enlace convierte el proyecto en un portal: el cliente sube y baja archivos, escribe notas, pide tareas y ve documentos y facturas. Permisos por cada cosa, opción de ocultar costes y contraseña opcional. |
| 8 abr | Reportes mensuales | Documentos agrupados por mes, gráfico de ingresos, descarga de todas las facturas del mes y CSV con los datos clave. |
| 14 abr | Chat en facturas y propuestas | Mensaje o GIF junto al documento; el cliente lo ve en la página pública, responde ahí y le llega por correo. Queda en el proyecto y en el portal. |
| 14 abr | Adjuntos en documentos | Archivos en facturas, propuestas, cotizaciones y recibos, visibles y descargables por el cliente. |
| 15 abr | Plantillas propias | Guardar secciones (bloques de precios, testimonios, condiciones) e insertarlas en documentos nuevos. |
| 20 abr | Plantillas de pago | Datos de cobro reutilizables (transferencia, PayPal, Wise, Stripe, cripto), una por defecto, cambiables por documento. Los campos se adaptan al método. |
| 24 abr | Facturas programadas | Envío automático por correo en una fecha; fecha de emisión propia y vencimiento calculado según las condiciones de pago. |
| 4 may | Navegación, dashboard y facturación nuevos | Nueva navegación, dashboard rediseñado, páginas de tareas, reportes, catálogo, clientes y proyectos. Plantillas completas, comentarios y archivos en tareas, secciones propias en facturas, descripción e imagen por línea, líneas reordenables. |
| 7 may | Nuevo modal de tarea y kanban | Portada en la tarea, checklists y subtareas. |
| 8 may | Trabajo en equipo | Invitar compañeros, asignar tareas, mencionar en comentarios, ver quién cronometró qué. |
| 15 may | App de macOS | Temporizador siempre visible en la barra de menús, resúmenes de hoy, semana y mes, sincronizado con la web. |
| 18 may | Importar datos | Clientes, proyectos, tareas, gastos y documentos desde CSV o Excel: subir, emparejar columnas, previsualizar, importar. |
| 19 may | Firmas en propuestas y cotizaciones | Firma obligatoria configurable por tipo, flujo *Accept & Sign* con nombre y firma, PDF firmado y documento bloqueado tras firmar. |
| 20 may | Páginas | Editor estilo Notion enlazado a clientes o proyectos: briefs, actas, acuerdos, SOPs. Plantillas, secciones prediseñadas, imágenes, vídeos, embeds, listas, líneas de tiempo y objetivos. |
| 21 may | Slack | Avisos de proyectos, propuestas, facturas y tareas; arrancar y parar el temporizador, registrar horas, ver presupuestos. |
| 27 may | Factura desde las horas | Elegir periodo (hoy, semana, 7 o 30 días, mes, a medida), filtrar por proyecto o cliente, y agrupar líneas por entrada, tarea, proyecto o día. Marca qué horas están facturadas, sin facturar o a medias. |
| 20 jun | Etapas de clientes y proyectos | Plantillas de etapas en Ajustes (de "lead" a "contrato firmado"), asignadas por defecto. Cada cliente o proyecto tiene un seguimiento de etapas con colores, fechas de inicio y fin y barra de progreso. |
| 21 sep | Biblioteca de propuestas | 23 plantillas listas que conservan cliente, proyecto, empresa, fechas y moneda. Entre ellas: desarrollo de software, diseño y desarrollo web, identidad de marca, UX y producto, e-commerce, marketing, redes sociales, SEO y consultoría. |

**Lo que dice el ritmo:** lanzaron con el núcleo de facturación completo y casi todo lo demás fue alrededor de cobrar antes y mejor (pagos parciales, enlaces, programación, plantillas de pago) y de unir horas con facturas. Desde junio solo hubo dos novedades.

---

## 4. Las funciones, módulo por módulo

### 4.1 Dashboard

**Para qué:** ver de un vistazo cómo va el negocio y qué requiere atención.

- **Saludo** ("Good morning, Solt") y selector de periodo.
- **Cuatro KPIs arriba**: Ingresos, Abierto, Pagado y Vencido, cada uno con cifra, número de facturas, variación frente al periodo anterior y una mini línea de tendencia.
- **Tarjeta destacada "Total cashflow"** con imagen de fondo y dos botones: *New Invoice* y *New Expense*.
- **Gráfico "Balance"**: línea acumulada con área verde y, por debajo, barras diarias por tipo (pagado, facturado, cotizado, gastos) con avatares de clientes o logos de proveedores. La leyenda lleva el recuento de cada tipo.
- **Seis indicadores abajo** (solo en la captura): Ingreso neto, IVA, Gastos, Beneficio, Margen (en anillo) y Salud del negocio (puntuación en anillo, "22 · Low").
- **Feed de actividad en vivo**: pagos, facturas enviadas, propuestas aceptadas y **"Someone viewed invoice RNY-…"**. Runey registra cuándo el cliente abre el enlace público.
- **Listas rápidas**: últimas tareas (con cambio de estado en un clic), clientes recientes, proyectos recientes y últimas facturas con su estado.
- **Notificaciones** en tiempo real con contador e historial paginado.
- **Checklist de arranque** flotante abajo a la izquierda: datos del negocio, marca, primer cliente y primera factura.
- Totales conscientes de la moneda. El beneficio es ingresos menos gastos.

### 4.2 Facturas

**Para qué:** emitir, mandar y cobrar documentos que se ven bien.

**Tipos en un solo editor:** factura, cotización, recibo y factura fiscal. Recurrente y programada salen como opciones del mismo selector. Se cambia de tipo con un clic. Las cotizaciones tienen además su propia entrada en el riel.

**Editor**
- Cabecera con logo, la palabra `INVOICE` enorme y el número (`RNY-05042026-0052`: prefijo, fecha y correlativo; los recibos van como `REC-0005`).
- Bloques **De** y **Para** (nombre, email, dirección, teléfono, web, NIF/IVA) y fechas de emisión y vencimiento. `+ Supply Date` es opcional.
- Líneas: descripción, cantidad, precio e importe. `+ Add Line Item` y `From Catalog`. Cada línea admite descripción e imagen, y se reordenan.
- Totales: subtotal, `+ Discount`, `+ Shipping`, `+ Withholding` (retención), impuesto en %, total y **la firma del emisor** en letra manuscrita.
- **Datos de pago**: plantilla (`Paypal template (default)`), método, sus campos, `+ Add field` y `+ Payment Link` (de Stripe o propio).
- Secciones añadibles con un clic: Términos y condiciones, Información legal, Información de pago, Garantía, Política de devoluciones y Confidencialidad. Además, adjuntos.

**Panel "Customize"**: estilo predefinido, diseño (`Bold Header`), tipografía (`Satoshi`), imagen de fondo, colores de texto y de papel, portada de cabecera sí o no, y tamaño del logo con un deslizador (42 px). Nueve plantillas visuales de partida.

**Cobros**
- Stripe Connect para tarjeta, o enlaces propios con **QR generado automáticamente**.
- **Pagos parciales sin límite.** El panel *Add Payment* muestra total, cobrado y pendiente con una barra; pide importe, fecha y método, y tiene un interruptor de *Auto-generate receipt*. Abajo, el historial. La factura pasa sola a pagada cuando el saldo llega a cero.

**Automatización**
- Recurrentes: un proceso cada hora clona las que tocan.
- Envío programado en una fecha.
- Vencida automática y recordatorios por correo.
- Registro de actividad por factura.

**Impuestos y monedas:** retenciones, varios tipos de impuesto y reglas por línea. Cualquier moneda, con el símbolo bien colocado.

**Compartir:** enlace público con contraseña opcional, caducidad, revocable. Descarga de PDF en lote y reportes mensuales.

**Pantalla de listado:** KPIs de Total facturado (con barra), Cobrado, Pendiente y Facturas pagadas (`11 / 64` con barra), gráfico *Revenue overview* (pagado y facturado) y lista por meses con cliente, número, creación, vencimiento, estado, importe y descarga.

### 4.3 Proyectos y tareas

**Para qué:** llevar el trabajo de cada cliente y que acabe facturado.

**Cabecera del proyecto:** cuadro con inicial o logo, portada opcional, nombre, cliente, presupuesto, fecha de creación, autor, estado, `Share` y `+ New`.

**Secciones:** Dashboard, Tareas, Horas, Documentos, Archivos, Páginas, Descripción y Actividad.

**KPIs del proyecto** (versión actual, 6 tarjetas):

| Tarjeta | Cifra | Debajo |
|---|---|---|
| Budget left | presupuesto menos lo gastado | barra con % |
| Earned | lo ganado | barra con % |
| Invoiced | lo facturado | nº de facturas |
| Paid | lo cobrado | "No outstanding" o lo pendiente |
| Time tracked | horas | — |
| Tasks | hechas / total | "No tasks yet" o barra |

Las capturas promocionales, más antiguas, muestran 5: Presupuesto restante, Ganado, Pendiente, Gastos y Tareas.

**Etapas** (tarjeta propia en el resumen): "Stage · Default ▾" para elegir la plantilla, progreso en % y `+ Add step`. Cada etapa es una tarjeta unida a la siguiente por una línea, con un círculo de estado, el nombre y "Upcoming", "Active" o "Completed". La plantilla por defecto es *Kickoff → In progress → Review → Delivered*, y al final hay una tarjeta punteada para añadir otra.

**Estado vacío del resumen:** "No tasks, invoices, proposals, or expenses linked to this project yet." El feed arranca con "Project CRM was started".

**Vistas:** kanban, lista (ordenar, filtrar, edición en lote), línea de tiempo (calendario y dependencias) y calendario (día, semana, mes).

**Kanban** (captura): columnas *Request, To Do, In Progress, Review, Done*, con punto de color, recuento y `+`. Arriba: progreso global (`56%`), orden, filtro, responsables, cambio de vista y buscador.

**Tarjeta de tarea:** portada opcional, título, prioridad (`High` / `Low`), fechas (`Mar 21 → Mar 28`), **valor en euros**, horas acumuladas, avatar del responsable y asa para arrastrar. Las hechas salen tachadas.

**Ficha de tarea** (panel lateral): portada, etapa, proyecto, título, prioridad, etiqueta, responsable, fechas y descripción. Debajo, **horas registradas** (quién, cuánto, cuándo y cuánto vale), costes adicionales, coste total, checklist con progreso (`5/7`), subtareas, comentarios con menciones y adjuntos.

**Horas**
- Un temporizador activo por persona, siempre visible arriba (`00:03:48` con pausa y parar).
- Tarifa por hora por tarea; el valor se calcula solo.
- Factura desde las horas por periodo, proyecto o cliente, con estado facturado, sin facturar o a medias.

**Más:** presupuesto e hitos con aviso de sobrecoste, notas del proyecto, archivos del proyecto con vista previa, registro de actividad y **portal público del cliente** (solo lectura, mostrar u ocultar costes, chat anónimo).

**Página global de tareas:** KPIs Por hacer, En curso, Hechas y Total ("62 of 110 done across all projects"), con el kanban de todos los proyectos.

### 4.4 Gastos

**Para qué:** saber a dónde va el dinero sin hojas de cálculo.

- **Alta en menos de 30 segundos**: título, importe, moneda, proveedor, categoría, fecha, notas y recibo opcional (arrastrar y soltar). Se puede hacer todo con el teclado.
- **Recibos:** vista a pantalla completa desde el detalle, útil para reembolsos y auditorías.
- **Categorías:** crear, renombrar, ordenar, editar, archivar sin perder el historial, y borrar.
- **Proveedores:** con dominio opcional para sacar su logo, que luego aparece en la lista y en el gráfico.
- **Más de 150 monedas** convertidas a la moneda base con la tasa **del día del gasto**, para que los reportes antiguos no cambien. **Tasa manual** cuando el banco aplicó otra.
- **Filtros:** mes, trimestre o rango; categoría, proveedor, moneda o importe. Orden por fecha, importe o proveedor. Búsqueda en títulos, proveedores y notas.
- **Pantalla** (captura): KPIs de número de gastos, total gastado, media diaria y categorías activas; gráfico *Spending overview* con logos sobre las barras; lista por meses con logo, título, `Figma · Card`, fecha, categoría e importe en negativo.
- El total alimenta el beneficio del dashboard. La página no menciona gastos recurrentes ni exportación.

### 4.5 Clientes

**Para qué:** un CRM sencillo donde cada cliente muestra lo que vale.

- **Ficha:** avatar o iniciales, nombre, email, teléfono, web, empresa, dirección, país, NIF/IVA y **moneda preferida**.
- **KPIs del cliente** (captura): Total facturado (con barra), Cobrado, Pendiente (`0 pending, 0 overdue`), Proyectos y Documentos.
- **Historial completo:** facturas, cotizaciones, propuestas, proyectos, tareas, pagos y mensajes, con filtros y búsqueda. Calendario de actividad como en los proyectos.
- **Dinero:** ingresos de por vida, pendiente y vencido con alertas, totales por moneda y registro de pagos.
- **Acciones de un clic:** crear factura, cotización o propuesta **ya rellena** con su moneda, dirección y datos fiscales. Enviarle un correo con marca.
- **Copia congelada:** si se edita el cliente, los documentos ya emitidos no cambian. El documento guarda su propia copia de los datos.
- Alta rápida, búsqueda y orden por actividad reciente o por ingresos.
- **Etapas** (desde junio): plantillas propias en Ajustes, con colores, fechas y barra de progreso.

### 4.6 Propuestas

**Para qué:** ganar clientes con una propuesta que impresione y se firme sola.

- **Bloques de contenido:** títulos, párrafos, listas, imágenes, vídeos, separadores y tarjetas de enlace con su vista previa.
- **Bloques con nombre** (captura): Introducción, Objetivos del proyecto (lista numerada), Alcance (rejilla de 6 apartados), Línea de tiempo (por semanas), Equipo (fotos y cargos), Testimonios (foto, nombre, cargo y cita), Trabajos seleccionados (imágenes con texto) y **Precios y firma** (tabla, subtotal, total y firma).
- **Editor:** secciones, arrastrar para reordenar, portada con recorte, tipografías y colores propios. La captura muestra una propuesta en tema oscuro con portada abstracta.
- **Plantillas:** guardar y clonar, más la biblioteca de 23 plantillas.
- **Estados:** borrador, enviada, vista, aceptada y rechazada.
- **Enlace público** con token único, revocable y regenerable. El cliente ve, comenta y firma sin cuenta.
- **Firma** escribiendo el nombre (letra tipo *Allura*), dibujando o subiendo una imagen. El documento se bloquea y se descarga en PDF firmado.
- **Aceptada → factura en un clic**, sin volver a escribir las líneas. Luego se cobra con Stripe.
- Chat público en la propia propuesta y estadísticas de ganadas y perdidas.

### 4.7 Lo que no tiene página propia pero existe

| Función | Qué hace |
|---|---|
| Catálogo de productos | Servicios y precios reutilizables para las líneas de factura y propuesta. |
| Páginas | Documentos estilo Notion para briefs, actas y procesos, enlazados a cliente o proyecto. |
| Reportes | Por mes: documentos, ingresos, PDFs del mes y CSV. |
| Plantillas de pago | Datos de cobro guardados, uno por defecto. |
| Etapas | Plantillas de etapas para clientes y proyectos. |
| Chat en documentos | Conversación con el cliente en la página pública, con aviso por correo. |
| Importación | CSV o Excel con emparejado de columnas. |
| Equipo | Invitaciones, asignaciones y menciones. |

---

## 5. Correcciones a los dos documentos adjuntos

Los dos `.md` de Descargas sirven de punto de partida, pero varias cosas no se sostienen frente a Runey o frente a este repositorio. Conviene corregirlas antes de implementar.

1. **`planificador/index.html` no existe en este repositorio.** La sección "Estado actual" describe como hecho un planificador con CRM, temporizador y editor de facturas. Aquí no hay nada de eso. Si existe, está en otra copia y habría que traerlo.
2. **La contraseña en el navegador no protege nada.** Proponen `schwarck2026` guardada en `localStorage` y comprobada en el cliente: cualquiera la lee en el código. El repositorio ya tiene un acceso de verdad en `worker/index.js` (secreto `ADMIN_PASSWORD` en Cloudflare, cookie de sesión firmada, límite de intentos). Hay que reutilizarlo.
3. **Los colores no son los de CeroFiao.** "Bevel Cloudlight" (`#ebf0f8`, `#1f2025`, `#31ce01`, `#415eee`) y el modo oscuro OLED con cian `#00d4ff` no salen de ninguna página del sitio. Los de CeroFiao están en `src/cerofiao.css` y se resumen en la sección 6.
4. **Faltan 18 de las 25 novedades.** Entre ellas algunas de las que más pesan: pagos parciales y recibos, factura desde las horas, plantillas de propuesta, chat en documentos y facturas programadas.
5. **Cosas que Runey no dice:**
   - Que la propuesta firmada se convierta en *proyecto + factura*. Runey solo dice factura. Hacer también el proyecto es buena idea, pero es nuestra.
   - El buscador con `Cmd/Ctrl + K`. Hay un botón de buscar, pero no se menciona el atajo.
   - Las etapas concretas de cliente (*Lead → Contacted → Proposal Sent…*). Runey deja que cada uno defina las suyas.
6. **Lo que sí aciertan**, confirmado en las capturas:
   - La doble barra lateral.
   - Los 6 KPIs del proyecto (*Budget left, Earned, Invoiced, Paid, Time tracked, Tasks*).
   - La barra de etapas *Kickoff → In progress → Review → Delivered → + Add step*.
   - El selector `Bar | Month` de los gráficos.
   - La barra de bloques flotante.
   - El editor de páginas con icono circular, borrador o publicada y comandos `/`.
   - El panel *Customize* (`Satoshi`, `Bold Header`, el prado de fondo, el logo a 42 px), `+ Supply Date` y `From Catalog`.

---

## 6. Cómo se traduce a la estética de CeroFiao

Runey y CeroFiao se parecen más de lo que parece: los dos usan tarjetas muy redondeadas sin borde, cifras grandes con letra apretada y botones píldora oscuros que en modo oscuro se vuelven claros. La diferencia de base está en el fondo claro. Runey pone tarjetas blancas sobre gris; CeroFiao pone tarjetas azul nube sobre papel blanco. En oscuro casi coinciden: CeroFiao usa `#0b0d10` y `#151a20` donde Runey usa negro y gris. El resto se traduce pieza a pieza con lo que ya existe en `src/cerofiao.css`.

### Tokens

| Uso | Token | Claro | Oscuro |
|---|---|---|---|
| Fondo de la app | `--paper` | `#ffffff` | `#0b0d10` |
| Tarjetas (KPI, gráfico, listas) | `--cloud` | `#eaf2f7` | `#151a20` |
| Hover y pistas de gráfico | `--cloud-deep` | `#dbe8f0` | `#212932` |
| Texto | `--ink` / `--body` | `#1d2126` / `#5c6268` | `#f1f4f7` / `#98a2ad` |
| Botón principal | `--pill-bg` / `--pill-fg` | `#1a1d22` / `#eaf2f7` | `#eef3f7` / `#12151a` (se invierte) |
| Riel lateral y tarjeta destacada | `--deep-bg` / `--inverse-bg` | `#1a1d22` | `#050607` / `#eef3f7` |
| Capas de cristal (barra flotante, dock) | `--glass` + `backdrop-filter: blur(18px) saturate(1.4)` | | |
| Fondo de portada | `--sky` + manchas difuminadas (`.hero-sky`) | celeste a crema | azul noche a negro |

**Colores de datos** (solo en cifras, gráficos y chips, nunca de decoración):

| Significado | Token |
|---|---|
| Pagado, cobrado, ingreso | `--income` |
| Gasto, vencido, error | `--expense` |
| Facturado | `--ink` |
| Cotizado, borrador | `--body` |
| Enlaces, foco, información | `--blue` |
| Acento de marca, novedades | `--cyan` |
| Propuestas | `--violet` |
| Bolívares / USDT | `--bs` / `--usdt` |

### Piezas

| En Runey | En nuestra versión |
|---|---|
| Riel de iconos | Riel con `--deep-bg`, radio 32 px, separado 8 px del borde como `.hero` y `.deep`. En móvil se vuelve una cápsula de cristal abajo. |
| Segunda barra lateral (proyecto, páginas) | Tarjeta `--cloud` de radio 32 px. El elemento activo va sobre `--paper` (en claro) o `--cloud-deep` (en oscuro), como el pulgar de `.seg`. Se pliega con el botón de arriba. |
| Barra flotante de subsecciones (cliente) | La cápsula de cristal de `.nav`, con el estado activo en `--inverse-bg` como `.hero-steps li.on`. |
| Etapas | Tarjetas `--paper` dentro de la tarjeta `--cloud`, unidas por una línea `--cloud-deep`. El círculo se rellena de `--cyan` en la activa y de `--income` en las completadas. "Añadir etapa" con borde punteado. |
| Estados vacíos | Icono en un cuadro `--paper` de radio 16 px, título en 600, una línea en `--body` y `.pill`. |
| Botón `+ New` | `.pill` (y `.pill.lg` en cabeceras). |
| Tarjeta KPI blanca | Tarjeta `--cloud` de radio 24–28 px; el icono en un cuadro `--paper` de 44 px y radio 14 px, como `.more .ico`. |
| Chip de variación (`+181%`) | `.rel-tag`: `color-mix()` al 16 % con `--income` o `--expense`. |
| Barras de progreso | `.chip-bar` (6 px, pista `--cloud-deep`). |
| Anillos (Margen, Salud) | `.chip-ring` (pista `--cloud-deep`, valor `--income`). |
| Eventos del calendario | El chip de `.chip-in`: icono en `color-mix()` al 14 %, título en negrita y subtítulo en `--body`. |
| Timeline / Semana / Mes, lista / cuadrícula, periodo | `.seg` con la pieza que se desliza. |
| Tarjeta "Total cashflow" con foto | Tarjeta `--inverse-bg` con la cifra en **Anton** (`--font-num`) como `.bal-num`, y los dos botones en `.pill.light`. |
| Fondo fotográfico detrás de la factura | El cielo `--sky` con las tres manchas de `.hero-sky`. Ningún archivo de imagen, y se adapta al tema solo. |
| Paneles laterales (Customize, Add Payment) | Tarjeta `--pop-bg` con `--shadow-chip`, radio 28 px. Campos como `.field`: fondo `--paper`, radio 16 px, borde `--blue` al enfocar. |
| Barra de bloques oscura | Cápsula `--inverse-bg` con iconos en `--inverse-fg`. |
| Listas por meses | Filas `--cloud` de radio 20 px; importes con `font-variant-numeric: tabular-nums`. |

**La hoja de la factura o propuesta queda siempre en papel claro**, también en modo oscuro: es lo que se imprime y lo que ve el cliente. Lo que cambia con el tema es todo lo que la rodea.

### Comportamiento que ya existe y se reutiliza

- `src/theme.js`: claro, oscuro o sistema, con el cambio en círculo desde el botón.
- `src/motion.js`: entradas con `data-reveal` bajo `html.motion`. Sin JavaScript o con movimiento reducido, todo queda completo y quieto.
- `src/smooth.js`: el scroll con inercia, solo en las páginas de lectura. En una app con paneles que se desplazan por dentro no conviene.
- La curva `--ease` (`cubic-bezier(0.2, 0.7, 0.2, 1)`) para todo lo que se mueve.

### Lo propio de CeroFiao que Runey no tiene

Esto es lo que haría la versión nuestra más útil que la original en Venezuela:

- **Monedas y tasas:** USD, Bs, EUR y USDT, con tasa BCV, paralelo o manual por gasto y por factura, igual que en la app. Runey solo usa tasas oficiales.
- **Plantillas de pago locales:** Pago Móvil (banco, cédula, teléfono), Zelle, Binance Pay, transferencia en bolívares, Wise, PayPal y efectivo.
- **Factura con el total en dos monedas** (por ejemplo USD y su equivalente en Bs a la tasa del día de emisión).

---

## 7. Qué hace falta para construirlo

### Glosario de la interfaz

| Runey | Nuestra versión |
|---|---|
| Invoice / Quote / Receipt / Tax invoice | Factura / Cotización / Recibo / Factura fiscal |
| Proposal | Propuesta |
| Customer / Vendor | Cliente / Proveedor |
| Expense | Gasto |
| Draft / Sent / Viewed / Accepted / Declined | Borrador / Enviada / Vista / Aceptada / Rechazada |
| Pending / Paid / Overdue / Partially paid | Pendiente / Pagada / Vencida / Pago parcial |
| Outstanding / Collected | Por cobrar / Cobrado |
| Budget left / Earned | Presupuesto restante / Ganado |
| Request / To Do / In Progress / Review / Done | Solicitud / Por hacer / En curso / Revisión / Hecho |

### Datos

Las piezas y lo que guarda cada una. Lo importante son las relaciones: casi todo cuelga de un cliente y, opcionalmente, de un proyecto.

| Entidad | Campos clave |
|---|---|
| Cliente | nombre, empresa, email, teléfono, web, dirección, país, NIF/RIF, moneda, etapa, notas |
| Proyecto | cliente, nombre, portada, presupuesto, tarifa por hora, etapa, fechas, permisos del portal |
| Tarea | proyecto, título, estado, prioridad, etiquetas, responsable, fechas, valor, checklist, comentarios, adjuntos |
| Registro de horas | tarea o proyecto, inicio, fin, duración, tarifa, facturado sí/no/en parte |
| Documento | tipo, número, estado, cliente (copia congelada), proyecto, fechas, líneas, impuestos, descuento, retención, moneda, tasa, plantilla de pago, enlace de pago, secciones, estilo, token público, contraseña, caducidad, firma |
| Pago | documento, importe, fecha, método, recibo generado |
| Gasto | título, importe, moneda, tasa, importe en moneda base, proveedor, categoría, fecha, recibo, notas |
| Proveedor / Categoría | nombre, dominio (logo) / nombre, orden, archivada |
| Catálogo | nombre, descripción, precio, unidad |
| Plantilla de pago | método, campos, enlace, por defecto |
| Página | cliente o proyecto, título, icono, bloques, borrador o publicada |
| Actividad | qué pasó, sobre qué, cuándo (incluye "el cliente abrió el enlace") |

### Encaje con este repositorio

El sitio es Vite con HTML y JavaScript sin framework, y un Worker de Cloudflare con KV. Encaja así:

- **Acceso:** el del panel (`/api/admin/*`), ya resuelto.
- **Guardar datos:** KV aguanta una versión para una sola persona con pocos datos. Con facturas, pagos y clientes enlazados entre sí, **D1** (SQLite de Cloudflare) encaja mejor: consultas por cliente, por mes o por estado sin cargar todo. Es la decisión más importante antes de empezar.
- **Enlaces públicos** (factura, propuesta, portal): rutas del Worker que validan el token y, si toca, la contraseña. Cada apertura queda registrada.
- **Recurrentes, vencidas y recordatorios:** *Cron Triggers* del Worker, como el proceso horario de Runey.
- **Correo:** Runey usa Resend.
- **PDF:** una hoja de estilos de impresión A4 basta para empezar.
- **QR:** se genera en el navegador con una librería pequeña; no hace falta un servicio externo.
- **Logos de proveedores:** el favicon del dominio.

### Orden sugerido

Cada fase deja algo que ya se puede usar.

1. **Base y cobro.** Estructura (riel, barra flotante, tema), clientes, catálogo, editor de factura y cotización con estilos, impresión a PDF, plantillas de pago locales con QR, pagos parciales y recibos.
2. **Trabajo.** Proyectos, tareas en kanban y lista, temporizador y factura desde las horas.
3. **Números.** Gastos con tasas y proveedores, y el dashboard: ingresos, gastos, beneficio y lo que está por cobrar.
4. **Venta.** Propuestas por bloques, enlace público, firma y paso a factura (y a proyecto).
5. **Cliente y rutina.** Portal del cliente, chat en documentos, páginas, etapas, recurrentes, recordatorios e importación.

Se quedan fuera al principio: Stripe Connect, Zapier, Slack, la app de escritorio y el trabajo en equipo.

### Antes de empezar hay que decidir

- **¿Herramienta interna o producto?** Si es solo para SchwarckDev, basta una persona, una moneda base y el panel actual. Si es para vender, hacen falta cuentas, espacios separados por cliente y cobro de suscripciones. Es otro proyecto.
- **¿KV o D1?** (ver arriba)
- **¿Dónde vive?** Una ruta del panel (`/admin/…`) aprovecha el acceso y la cabecera que ya hay. Una ruta propia (`/planificador/`, como dicen los adjuntos) queda más separada.

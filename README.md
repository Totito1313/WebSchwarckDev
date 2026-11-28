# Sitio de Schwarck

El sitio de [schwarckdev.com](https://schwarckdev.com): la página del estudio, la de CeroFiao, su política de privacidad, el marcador de Lion Fitness, un panel de administración y la app que instala cada cliente.

Cada `git push` a `main` se publica solo en Cloudflare.

## Qué hay

| Ruta | Archivo | Qué es |
|---|---|---|
| `/` | `index.html` | El estudio |
| `/cerofiao/` | `cerofiao/index.html` | La app, con novedades y reseñas |
| `/cerofiao/privacidad/` | `cerofiao/privacidad/index.html` | Política de privacidad (la URL que pide Play Console) |
| `/lionfitness/` | `lionfitness/index.html` | Marcador |
| `/admin/` | `admin/index.html` | Panel: la entrada a todo lo de abajo (se llega desde el icono de la barra de la portada) |
| `/admin/negocio/` | `admin/negocio/index.html` | Negocio, hecho con React y HeroUI: clientes, leads, facturas, proyectos, tareas, páginas, marketing y el portal de clientes (`/admin/negocio-nuevo/` redirige aquí) |
| `/admin/perfil/` | `admin/perfil/index.html` | Perfil público: la foto del titular que sale en la portada (`/#fundador`) |
| `/apps/` | `apps/index.html` | Mis apps: novedades, reseñas y botón de descarga de CeroFiao |
| `/apps/tienda/` | `apps/tienda/index.html` | Estudio de gráficos para la ficha de Google Play (antes `/admin/tienda/`, que redirige aquí) |
| `/cliente/` | `cliente/index.html` | El portal de clientes, una app que se instala en el teléfono: el cliente ve su proyecto y el estudio lo gestiona |
| `/documento/#…` | `documento/index.html` | Lo que abre el cliente con un enlace: ver, pagar o firmar |
| `/api/*` | `worker/index.js` | La API que usan la página y el panel |

Son páginas HTML con CSS y un poco de JavaScript, construidas con Vite. No hay framework, salvo en lo que se está rehaciendo con React y HeroUI: el catálogo (`/admin/ui/`), Negocio (`/admin/negocio/`) y el portal nuevo (`/cliente-nuevo/`). Ver «HeroUI» más abajo.

### La portada del estudio

Técnica y minimalista, con el gradiente del logo como único acento y el vidrio y los teléfonos de CeroFiao. Geist para el texto y Geist Mono para las etiquetas. Las secciones van numeradas de [01] a [08] con mucho aire entre ellas: productos, proceso, principios, cifras, roadmap, preguntas, quién está detrás y contacto.

- **Movimiento**: el titular entra palabra a palabra y el teléfono del hero se monta en su marco técnico (esquinas, órbitas, chips que flotan y una etiqueta que se escribe sola); el hero se aleja al bajar. Con ratón, la retícula del fondo tiene un foco que sigue al cursor, las tarjetas se iluminan e inclinan, y los botones principales tienen imán. El proceso es un teléfono fijo cuya pantalla cambia con cada paso; las cifras giran como un cuentakilómetros; el roadmap se dibuja; el logo grande del contacto se traza solo, y el nombre gigante del pie se ilumina bajo el cursor (en el teléfono se llena de color al aparecer). En pantallas anchas, un índice lateral marca la sección en la que estás.
- **Sin JavaScript o con «reducir movimiento»** todo se ve completo y quieto, y las preguntas quedan abiertas.
- **[07] Quién está detrás** (`/#fundador`): el nombre del titular, su papel en el estudio y sus datos de contacto (correo, teléfono con WhatsApp, ubicación y web). Es el enlace que se da a Payoneer, que pide ver al menos dos de esos datos junto al nombre. Los mismos datos van en el JSON-LD del `<head>`. La foto se sube desde el panel (**Perfil público**, `/admin/perfil/`): el panel la reduce, la API la guarda en `site:photo` y la portada siempre la pide a `/api/perfil/foto` (tarda hasta cinco minutos en cambiar). Sin foto se ven las iniciales. Si cambia el teléfono o la dirección, hay que cambiarlos en la sección, en el JSON-LD y en el botón de WhatsApp del contacto.
- `src/home.css` y `src/home.js`: la portada. Lion Fitness y la página 404 usan el mismo CSS (bloque «Página sola») y `src/solo.js`.
- `src/site-bar.css` y `src/site-bar.js`: la barra del estudio, la misma en todas las páginas públicas (portada, CeroFiao, su privacidad, Lion Fitness y la 404). Es una cápsula de vidrio centrada, con un brillo que sigue al cursor entre enlaces, un punto bajo la sección en la que estás y menú en el teléfono. El botón de la derecha cambia según la página: «Escríbenos» en el estudio y «Google Play» en CeroFiao. También lleva el cambio entre páginas, rápido y con la barra quieta.
- `src/site-foot.css`: el pie del estudio, también el mismo en todas esas páginas: enlaces, el nombre gigante y el selector de tema. Como la barra, lleva sus propios colores y no depende de los de cada página.
- `src/studio-fx.js`: lo que comparten esas páginas: la luz del cursor, los botones con imán y el nombre gigante del pie (CeroFiao y su privacidad usan esto último).

Para verla sola, sin API, `npm run dev` (o la configuración «portada» de `.claude/launch.json`).

### La página de CeroFiao

El hero (el teléfono que cambia de pantalla mientras pasan las tarjetas) y la sección oscura (el teléfono fijo que cada tarjeta recorta) son el corazón de la página. Alrededor:

- **Fondo vivo**: una trama de puntos con una luz que sigue al cursor y tres auroras de la paleta de la app que derivan despacio y se desplazan con la lectura. Arriba, una barra fina marca cuánto se ha leído.
- **Monedas** en fichas de vidrio, cada símbolo en su color.
- **Balance**: el aura y el borde, que gira despacio, toman el color de la moneda elegida.
- **Carrusel en 3D**: la pantalla del centro de frente y las de los lados giradas.
- **Tarjetas** que dejan ver la aurora y se iluminan bajo el cursor.
- **«Sin cuenta, sin anuncios, sin suscripción»**: cada una con un cero enorme que llega girando como un contador.
- **Cierre**: la aurora del hero, monedas que suben flotando y el icono de la app latiendo. Su botón lo decide el panel («Botón de descarga»).

Con «reducir movimiento» todo queda quieto. Los estilos nuevos están al final de `src/cerofiao.css` («Pulido»).

- `src/motion.js`: revelados y animaciones ligadas al scroll. Sin JavaScript, o si la persona pidió menos movimiento, las páginas quedan completas y quietas.
- `src/theme.js`: tema claro u oscuro. Sin elección guardada sigue al sistema.
- `data/changelog.json`: las novedades de CeroFiao tal como salen sin panel. Vite las pinta en la página al construir.
- `public/img/cerofiao/`: capturas reales de la app, en claro y en oscuro (`-dark`).
- `public/img/cerofiao/store/`: las mismas capturas a 1080 px de ancho, para el estudio de gráficos.

## Trabajar en local

```bash
npm install
```

```bash
npm run dev
```

Eso sirve las páginas en `http://localhost:5173` (la prueba de HeroUI, en `http://localhost:5173/admin/ui/`). Las novedades se ven; las reseñas y el panel necesitan la API. Para tenerla, en otra terminal:

```bash
npm run build
```

```bash
npx wrangler dev
```

`wrangler dev` sirve el sitio ya construido con su API en `http://localhost:8787`, con un almacén de datos local. Para entrar al panel en local, copia `.dev.vars.example` como `.dev.vars` y pon una contraseña de prueba.

### HeroUI (React 19 y Tailwind CSS 4)

Negocio y el portal se rehacen con [HeroUI v3](https://heroui.com/docs/react/getting-started), para que las dos apps tengan las mismas piezas y se vean igual. Negocio ya sustituyó a su versión vieja (misma dirección, mismos datos, todas sus funciones); el portal nuevo vive todavía **al lado** del de siempre:

| Ruta | Qué es |
|---|---|
| `/admin/ui/` | El catálogo: los 73 componentes de HeroUI con el tema de Schwarck, agrupados como en su documentación y con ejemplos del negocio (clientes, facturas, leads, publicaciones). Buscador y cambio de tema arriba. |
| `/admin/negocio/` | Negocio, con todas sus secciones. Arriba, una isla flotante con seis zonas y, debajo, las secciones de la zona abierta en un segmento con iconos (ver «Negocio: cómo está organizado» más abajo). La versión vieja ya no se sirve: `/admin/negocio-nuevo/` redirige aquí (`public/_redirects`) y los enlaces de siempre (`#/doc/…`, `#/tareas/CF-12`, `#/portal/identidad/…`) abren su pantalla nueva. |
| `/cliente-nuevo/` | El portal del cliente rehecho: Inicio, Cronología, Marketing (calendario, rendimiento, leads y la ficha de cada publicación con aprobar, pedir cambios o rechazar), Recursos con facturas y documentos, Peticiones («Ya lo envié») y Perfil. `/cliente-nuevo/?demo` enseña la demostración. El modo estudio, el proyecto, las reuniones y el informe siguen en `/cliente/`. |

Cómo está montado:

- `@heroui/react` y `@heroui/styles` 3.2.8, con React 19, Tailwind CSS 4, las dependencias de React Aria e iconos de `@gravity-ui/icons` (los de la documentación de HeroUI), todo con la versión fijada en `package.json`.
- `vite.config.js` carga `@vitejs/plugin-react` y `@tailwindcss/vite`. Solo actúan en lo que está hecho con React: las páginas de siempre salen igual que antes.
- `src/ui/app.css` es la entrada de estilos: Tailwind, después HeroUI y al final `src/ui/theme.css`, el tema «Schwarck». Traduce a los tokens de HeroUI el sistema de diseño de CeroFiao (`src/panel.css`): fondo `#f1f2f3` o negro, superficies blancas o `#17171a`, el cian de la marca como acento (con texto negro encima, que se lee mejor que el blanco), botones en píldora, Anton en las cifras (`.sw-figure`) y etiquetas espaciadas (`.sw-eyebrow`). También apunta los `var(--cf-…)` del portal a esos colores, para que las constantes de `src/portal/state.js` sirvan tal cual.
- Los gráficos (`src/ui/kit/BarsChart.jsx`) usan un azul verdoso y un naranja (`--sw-chart-in` y `--sw-chart-out`) que se distinguen también con daltonismo, en claro y en oscuro; tienen globo al pasar y «Ver como tabla».
- `src/ui/kit/`: lo que comparten las tres páginas: el arranque (`mount.jsx`: idioma `es-VE` y avisos), el cambio de tema (`ThemeSwitch.jsx`, con `useTheme` de HeroUI, que guarda la elección en `heroui-theme`) y las piezas comunes (`parts.jsx`: cabecera de página, tarjeta de cifra con su variación, bloque con título, vacío, persona).
- `src/ui/pro/`: nuestros componentes «Pro», inspirados en las demos de HeroUI Pro (sin copiar su código; Pro es de pago) y hechos con HeroUI libre y el tema. Se ven todos con datos de ejemplo en `/admin/ui/`, en las secciones «Pro». Son: `TrendChip`, `Widget`, `Kpi` y `KpiGroup` (cifras con tendencia); `ComposedChart` (barras, área y línea en **un solo eje**), `DonutChart` (hasta cinco partes y «Otras», con sus cifras al lado) y `Sparkline`; `DataGrid` (buscar, filtros, orden, columnas, selección, menú por fila y clic derecho) con `ActionBar` (acciones con lo seleccionado; Esc la cierra); `ListView`; `ContextMenu` y `PointMenu`; `Kanban` (arrastrar con ratón, dedo —mantener pulsado— o teclado: Alt + flechas) y `KanbanCard`; `Agenda` (día, semana y mes); `Timeline` y `TimelineCard`; `Stepper`; `NumberStepper`; `RichText` y `RichView` (guardan **Markdown** legible, para que la versión de siempre lo siga mostrando bien; ver `markdown.js`); `Loader` y `ShimmerText`; `ChatMessage`; `ApprovalCard` (Esc rechaza, Ctrl+Intro aprueba) y `QuestionCard`. Los colores del gráfico circular (`--sw-cat-1…5`) están validados con daltonismo en claro y en oscuro.
- Dónde se usan en Negocio: Inicio es un tablero de widgets que cada uno arma a su gusto (ver «Inicio a tu medida» más abajo); el embudo de Leads, el tablero de Tareas y el de Marketing son `Kanban` con arrastrar; Facturas, Cotizaciones, Propuestas y Clientes son `DataGrid` (exportar CSV, copiar números o correos, anular en bloque con confirmación); la ficha de un documento tiene su historial; el proyecto, sus etapas como pasos y su actividad; la tarea, su descripción con formato y los comentarios como conversación; Ajustes usa `NumberStepper`; y en Portal, la primera petición sin tarea sale como tarjeta para decidir. En el portal nuevo, la Cronología es una línea de tiempo y cada pieza muestra sus etapas y la tarjeta para aprobar.
- Interruptores (`Switch`): como en la documentación de HeroUI, el riel (`Switch.Control`) va **dentro** de `Switch.Content`, junto al texto, y la descripción fuera, debajo. Si el riel queda fuera, se apila encima de la etiqueta. Para no equivocarse, `src/ui/kit/SwitchField.jsx` lo arma siempre bien. La perilla encendida (y la del deslizador) se deja como la pinta HeroUI con `--accent-foreground`: oscura sobre nuestro cian, igual que el tema «Sky» de su documentación, y el riel apagado cambia con el modo claro u oscuro.
- En Horas y Gastos cada día o mes es una `ListView` con casillas: tocar la fila la abre para editar; marcar casillas (o Espacio) elige varias, y la `ActionBar` deja marcarlas como facturables o no, exportarlas a CSV, cambiarles la categoría o borrarlas (con confirmación; las horas ya facturadas no se tocan). Al perder un lead, la pregunta del motivo es una `QuestionCard`.
- Grupos de botones (`ButtonGroup`): el botón que va dentro de un `Dropdown` no hereda el tamaño ni el estilo del grupo, así que se le pone a mano (`size`, `variant`); y cada botón menos el primero lleva `<ButtonGroup.Separator />`, también el de `ConfirmButton`.
- `Segment.jsx` es el segmento con iconos de las secciones de cada zona (y, en su versión `bare`, la píldora de la isla de arriba, que también se desliza): una bandeja en píldora con un indicador que se desliza hasta la sección abierta. La idea viene del «Segment» de HeroUI Pro, pero está hecho desde cero con el tema: bandeja `--default`, indicador `--segment` (los colores de las pestañas de HeroUI) y estilos `.sw-segment` en `theme.css`. Son enlaces (`aria-current="page"` en la activa); en el teléfono la tira se desliza y la sección abierta se trae a la vista.
- `src/ui/catalog/`: el catálogo, una parte por grupo.
- `src/ui/negocio/`: Negocio. No tiene datos propios: `store.js` usa `negocio-core.js` (la misma carga, la misma fila de guardado y la misma sesión del panel) y `domain.js` reúne las cuentas (las de `negocio-core.js`, `negocio-gastos.js` y, sin su interfaz, las de leads y clientes). Las reglas de proyectos, tareas, horas, gastos, marketing y portal se importan tal cual de sus módulos de siempre (`negocio-work.js`, `negocio-gastos.js`, `negocio-contenido.js`, `negocio-paginas.js`, `negocio-puente.js`).

#### Negocio: cómo está organizado

Seis zonas, cada una con sus secciones en el orden en que se trabajan (`src/ui/negocio/nav.js`). Cada zona recuerda la última sección abierta; en el teléfono, la zona abre un menú con todas.

| Zona | Secciones |
|---|---|
| Inicio | Tu tablero: widgets que se añaden, se ordenan y cambian de tamaño (cifras, entradas y salidas, atajos, tareas, temporizador, seguimientos, por cobrar, embudo, proyectos, notas…) |
| Ventas | Leads → Clientes → Propuestas → Cotizaciones → Facturas → Catálogo (el camino de un cliente, y lo que se vende) |
| Trabajo | Proyectos → Tareas → Horas → Páginas |
| Dinero | Cobros (por cobrar, con «Registrar» en cada factura, e historial con la tasa de cada pago) y Gastos (con categorías) |
| Crecer | Marketing (calendario, agenda, tablero, campañas con su ficha, resultados, copias, feed y marcas con su ficha) y Portal de clientes (resumen, portales, accesos e identidad) |
| Negocio | Mi negocio (Perfil, Identidad de marca y Facturación), Formas de cobro, Biblioteca y Copia de seguridad |

Botones agrupados (`ButtonGroup`) donde hay una acción principal y otras relacionadas: «Crear» (la de la sección abierta y, en la flecha, todo lo demás por zona), el temporizador en la isla (pausar y parar), cada documento (Registrar pago o Convertir en factura, y en la flecha Factura y proyecto, rechazar, anular o abrir en el editor), cada proyecto (Nueva tarea, y Editar, Registrar horas y Facturar horas), «Nueva página» con sus plantillas, y los navegadores de mes.

Crear y editar ya no es siempre un panel lateral: lo que tiene mucho que hacer se abre como página entera.

- **Documento** (`src/ui/negocio/editor/`): como en la versión de siempre, **la hoja es interactiva** (`Hoja.jsx`): se escribe directamente sobre ella (los campos parecen texto hasta que se tocan) y ahí mismo se añaden, se ordenan (arrastrando su asa) y se quitan las líneas, el descuento, el impuesto, la retención, otros cargos, la equivalencia, la forma de cobro, las secciones del pie y, en una propuesta, sus bloques. Arriba, una barra con el tipo, la plantilla, el cliente, el proyecto, la moneda, Imprimir o PDF y las acciones; a la derecha, el panel de Personalizar (diseño), el Enlace para el cliente y los Pagos (en pantallas estrechas sale como cajón). Lo que se imprime y ve el cliente es esa misma hoja (`sheet.css`). `#/documentos/<id>/editar`; «Nueva propuesta» elige plantilla en `#/propuestas/nueva`.
- **Tarea** (`Tarea.jsx`) y **publicación** (`Pieza.jsx`, con la vista previa en un teléfono).
- **Páginas** (`Paginas.jsx`): árbol plegable con favoritas, portada, icono y bloques: texto, títulos, listas, pendientes, citas, destacados, código, separadores, imágenes, enlaces a tareas, páginas o documentos, subpáginas, **desplegables, tablas, enlaces web, vídeos (YouTube, Vimeo o Loom), PDF e índice**. «/» elige el tipo de bloque (`kit/PointPicker.jsx`), «[[» busca qué enlazar, los atajos de Markdown convierten la línea, se arrastran los bloques por su asa y se sueltan o pegan imágenes. **Importar**: archivos Markdown, texto o HTML (lo que exportan Notion, Google Docs u Obsidian) como páginas nuevas o dentro de la abierta, y al pegar Markdown o HTML en un bloque se convierte en bloques (`paginasIO.js`). Mover a…, Duplicar, Copiar o Descargar en Markdown, Imprimir y «La mencionan». Las fichas de cliente y proyecto muestran sus páginas.
- **Marketing** (`MarketingMas.jsx`): resultados del periodo (por papel en el embudo y por formato), el feed simulado de una marca (arrastrar una casilla sobre otra intercambia sus fechas), la ficha de cada campaña (cifras, publicaciones y leads) y la de cada marca (identidad, estrategia, imágenes y logos en SVG).
- **Portal** (`PortalAdmin.jsx`): crear portales, permisos de un portal o de una persona, «Conectar Claude», las cuentas (Accesos: crear, rol, portales, contraseña nueva, enlace de acceso, borrar) y la identidad de cada app con la app de verdad al lado.

- **Mi negocio** (`MiNegocio.jsx`, `#/ajustes`, `#/ajustes/marca`, `#/ajustes/facturacion`): arriba, la ficha del negocio (portada con los colores de la marca, el logo, la frase, lo que se lleva hecho y cuánto le falta al perfil, con un botón que lleva al primer dato que falta); debajo, tres pestañas. **Perfil**: quién eres, contacto y redes, con la vista previa del encabezado de la próxima factura al lado. **Identidad de marca**: colores (cualquiera puede ser el color de los documentos: el editor los ofrece junto a los de siempre), tipografía (las mismas letras de Google Fonts que el portal), las versiones del logo y los documentos de marca (PDF o imagen, guardados como los recibos), la voz y las reglas, y «Llevar a Marketing» crea o actualiza tu marca allí. **Facturación**: moneda principal, plazos y tarifa en una fila de steppers, el impuesto por defecto (nombre, porcentaje y si se añade solo a facturas y cotizaciones nuevas), la numeración que viene y los textos por defecto.
- **Monedas** (`currency.jsx`): cada moneda tiene su «moneda» dibujada ($, €, ₮, Bs). `CurrencyPicker` las pone todas a la vista (Mi negocio, Catálogo, Gastos, Proyectos, Clientes, campañas) y `CurrencyMenu` es el botón con menú de la barra del editor.
- **Formas de cobro**: tarjetas de la misma altura con la cara de cada método, sus datos para copiar, en cuántos documentos sale y «Usar por defecto»; el método se elige tocando su icono.
- **Biblioteca**: secciones (con su tipo: Términos, Pagos, Entrega, Garantía, Legal…) y bloques de propuesta guardados, con buscador y filtros. Todo se abre y se edita entero (los bloques, elemento a elemento), se duplica, se ordena y se quita.
- **Copia de seguridad** (`Copia.jsx` y, en el Worker, `makeBackup`): el cron del Worker (`triggers.crons` en `wrangler.jsonc`, a las 07:00 UTC) guarda cada día todo Negocio en `crm:backup:<fecha>` si algo cambió, y deja las últimas 14 automáticas (de 3 a 60, en la pantalla) y hasta 20 hechas a mano. Desde la pantalla se hacen, se descargan, se borran y se restauran (`/api/admin/crm/backups`, `/crm/backups/<id>/restore`, `/crm/restore` para un archivo): antes de restaurar se guarda siempre lo que había y la numeración nunca retrocede. «En tu Drive» usa la carpeta que elijas (la de Google Drive, OneDrive o Dropbox del ordenador, con File System Access en Chrome y Edge) y guarda allí una copia cada día que abres Negocio, con las 30 últimas. Los archivos (recibos, documentos de marca) no van dentro de la copia: siguen en sus claves.
- **Tareas**: en el tablero y en la lista, el clic derecho (o «⋮») abre el menú de la tarea con submenús (Mover a, Prioridad, Proyecto, Vence), cronometrar, duplicar, copiar el enlace y eliminar. Para cambiar varias a la vez: en la lista, sus casillas (es un `DataGrid` con filtros de estado y prioridad, orden y columnas); en el tablero, Ctrl/⌘ + clic, el círculo de la esquina o «⋮ › Seleccionar». La `ActionBar` deja marcarlas como hechas, moverlas, cambiarles prioridad, proyecto o fecha, duplicarlas o eliminarlas (con confirmación). `menuNodes` entiende submenús y les pasa el `onAction`, porque React Aria no lo hace solo.
- **Inicio a tu medida** (`home/widgets.jsx` y `screens/Inicio.jsx`): «Personalizar» pone el tablero en edición. Desde la galería se añaden widgets (cifras, entradas y salidas, gastos por categoría, atajos, tareas, temporizador, la semana, seguimientos, por cobrar, embudo, proyectos, lo próximo, documentos, notas y actividad); cada uno se arrastra o se mueve con sus flechas, cambia de tamaño (pequeño, mediano, grande o a todo el ancho) y se quita. Los atajos se eligen (crean lo que digan sin pasar por su sección). Se guarda en `settings.home`, así que es el mismo en todos los dispositivos. «Primeros pasos» ya no está.
- **Gráficos** (`series.js`): Cobros (facturado y cobrado por mes, y la antigüedad de lo pendiente), Gastos (por mes y por categoría), Leads › Análisis, Facturas y Cotizaciones (ventas por mes) y la cabecera de Marketing usan `ComposedChart`, `DonutChart` y `KpiGroup` en lugar de tarjetas de texto. Las cifras se adaptan al ancho de su caja (consultas de contenedor en `pro/Widget.jsx`): en una caja estrecha la cifra baja de tamaño y el minigráfico se esconde, sin cortar números.
- **Nuevo proyecto** (`NuevoProyecto.jsx`): un asistente de cinco pasos en lugar de un formulario (El proyecto, Cliente, Cobro, Plazos y Listo). El primero elige una plantilla (página web, app, identidad de marca, marketing, mantenimiento o en blanco) que propone las etapas y las tareas de partida; al terminar crea el proyecto con sus tareas. Editar un proyecto sigue siendo el formulario.
- **Lead**: su ficha es una ventana ancha en vez de un panel lateral: a la izquierda, el siguiente paso, registrar contacto y el historial; a la derecha, las etapas como píldoras (tocar «Perdido» pide el motivo), las fuentes como etiquetas y los datos.
- **Feed** (Marketing): cifras del mes, el ritmo de publicación por semana, el equilibrio del embudo en un anillo, lo próximo y un interruptor para ver u ocultar los borradores.

Un diálogo abierto desde otro (por ejemplo, los permisos desde la ficha de una persona) funciona porque `FormModal` corta el contexto del `Form` de React Aria: sin eso, el formulario de dentro hereda el `onSubmit` del de fuera y guardar uno cerraba los dos.
- `src/ui/portal/`: el portal nuevo (`/cliente-nuevo/`). `store.js` arranca con `src/portal/data.js` (Supabase o la demostración) y deriva todo con `src/portal/state.js`, así que las reglas y los permisos son los mismos.
  - Ya tiene todo lo del cliente de la app de siempre; solo el modo estudio sigue en `/cliente/` (y en Negocio › Portal de clientes).
  - **Barras**: arriba, una cápsula de cristal flotante con el proyecto (y el cambio de proyecto), la lupa, la campana con lo no leído y la cuenta; se esconde al bajar y vuelve al subir. Abajo, las pestañas con un indicador que se desliza a la abierta, y encima, a la derecha, el botón redondo de **Enviar**.
  - **Hojas encima** (`OVERLAYS` en `store.js`, con `Hoja` de `ui.jsx`): `#/hilo/<tipo>/<id>` (una conversación), `#/enviar` (y `#/enviar/<petición>`), `#/buscar`, `#/novedades` y `#/valorar`. Se abren sobre la pantalla en la que se estaba, se cierran deslizando, con Escape o con «atrás», y la pantalla de debajo no se mueve.
  - **Conversaciones** (`Hilo.jsx`): burbujas como en Mensajes, dentro de cada publicación, en cada petición («Comentar») y en cada anuncio de la Cronología. Ctrl/⌘ + Intro envía.
  - **Enviar** (`Enviar.jsx`): un mensaje, un enlace o un archivo (hasta 50 MB, con su barra de subida), suelto o para una petición; enviarlo para una petición la deja en revisión. En Peticiones, «Entregar» abre lo mismo ya con la petición, y cada una enseña lo que se le mandó (borrable mientras el estudio no lo vea).
  - **Novedades** (la campana): lo nuevo desde la última visita y «Marcar como visto». **Buscar** (`Buscar.jsx`, la lupa, «/» o Ctrl/⌘ K): en todo el proyecto, sin que estorben tildes ni mayúsculas, con lo encontrado resaltado y las últimas búsquedas.
  - **Proyecto** (`#/proyecto`), **Reuniones** (`#/reuniones`: pedir una con hasta tres horarios, verla, cancelar la propia, añadirla al calendario con un .ics y unirse; la próxima sale en Inicio), **Informe del mes** (`#/informe/2026-11`: cifras, trabajo por área, lo publicado, resultados frente al mes anterior, leads, hitos y reuniones; «PDF» lo imprime sin barras ni botones y «Compartir» manda un resumen) y **Valoración del mes** (del 20 al 7: estrellas en Inicio y su hoja).
  - **Cronología**: mantener pulsada una entrada (o clic derecho) abre su menú: abrir, comentar, copiar, compartir y, para el estudio (o en un anuncio propio), editar o borrar.
  - **Calendario**: por día, semana o mes (se recuerda la vista). **Rendimiento**: cifras con su variación, dos gráficos de los últimos seis meses (alcance e interacciones, y leads), el detalle del mes y el alcance por red en un anillo.
  - **Recursos**: tarjetas con su imagen (o el color de su tipo) y las categorías con su cuenta; los archivos subidos se descargan con una dirección firmada y las fotos se ven en la tarjeta. **Peticiones**: filtros por tipo, por plazo (atrasadas, esta semana, sin fecha) y un deslizador de prioridad; a la derecha en pantallas anchas y en un desplegable en el teléfono, con un resumen arriba.
  - **Crear, si el portal lo permite** (`Crear.jsx`): publicar un aviso en el tablón (Inicio y Cronología), proponer una publicación (Marketing; entra como idea), subir un recurso (archivo o enlace, y quitar los propios) y añadir o mover leads.
  - **Perfil** (`Perfil.jsx`): la tarjeta de la persona (la foto se cambia tocándola) y los ajustes por grupos: tú (nombre, cargo, teléfono), tu proyecto (proyecto, documentos, reuniones, informe, valoración), tu negocio (lo edita el dueño), notificaciones (activarlas en este dispositivo, probarlas y silenciar por categoría), apariencia y la app (instalar, cambiar la contraseña, la versión de siempre).
  - **Avisos al teléfono** (`push.js`): con el service worker de `/cliente-nuevo/`. Inicio y Novedades invitan a activarlos; si ya hay permiso, la suscripción se vuelve a guardar al abrir; en el iPhone, primero hay que instalar la app.

#### Apps instalables

Negocio y la app nueva del cliente se instalan como apps (PWA), con su ventana, su icono y sus atajos, sin tienda ni descargas:

- **Negocio en Windows** (o macOS): en Edge o Chrome, abre `schwarckdev.com/admin/negocio/` y toca el icono de instalar de la barra de direcciones (o el botón de la isla, o Cuenta › «App de escritorio» › Instalar). Queda en el menú Inicio y en la barra de tareas, abre en su propia ventana y su menú contextual trae Registrar horas, Nueva tarea, Nuevo gasto y Cobros. Usa el mismo Worker y la misma sesión del panel: no hay nada más que configurar en el servidor.
- **La app del cliente**: en Android, Perfil › La app › «Instalar» (o el aviso del navegador); en el iPhone, Compartir › «Añadir a pantalla de inicio» (el Perfil lo explica). Atajos a Peticiones, Calendario y Cronología.
- Los archivos: `public/admin/negocio/` y `public/cliente-nuevo/` (manifiesto y service worker), `src/ui/kit/install.js` (el aviso del navegador, `useInstall` y el registro del service worker, solo en la versión publicada) y sus cabeceras en `public/_headers`. Los service workers guardan la última versión para abrir sin conexión y nunca guardan `/api/` ni los datos; el de la app del cliente ya entiende los avisos push. Para probarlos en local: `npm run build` y la configuración «compilado» (`vite preview`, puerto 4173).

Para probar Negocio en local hace falta la API: `npm run build` y luego `npx wrangler dev --local` (la configuración «api-local» de `.claude/launch.json`; `--local` evita que pida la cuenta de Cloudflare por el modelo de IA). Se abre en `http://localhost:8787/admin/negocio/`. Desde `npm run dev` (puerto 5173) la entrada falla con «Origen no permitido»: el Worker solo acepta su propio origen. El catálogo y el portal en demostración sí se ven con `npm run dev`.

La documentación de la versión instalada está en `node_modules/@heroui/react/docs/` (índice en `llms.txt`). La fuente de verdad para instalar y para la API de cada componente es el servidor MCP de HeroUI (`@heroui/react-mcp`).

## El panel

`/admin/` es la entrada: cuatro tarjetas que llevan a Negocio, al portal de clientes (la app, en modo estudio), a Mis apps y a la demostración del modo estudio. Se llega desde el icono de cuadrícula de la barra de la portada (y desde «Panel» en su menú del teléfono y en el pie). Cada sección pide la contraseña del panel por su cuenta; la entrada solo dice si la sesión sigue abierta.

### Mis apps

Está en `/apps/` (antes era `/admin/`). Sirve para:

- **Novedades**: añadir, editar, ordenar, ocultar o borrar versiones. La primera de la lista sale abierta en la página.
- **Reseñas**: aprobar, rechazar o borrar lo que envía la gente. Nada se publica sin aprobarlo.
- **Botón de descarga**: en qué punto está CeroFiao y qué dicen sus botones (el de arriba, el de la barra, el del menú del teléfono y el del cierre).
  - **Próximamente**: los botones llevan a la sección de descarga y el del cierre pide acceso a la prueba, por correo o con el enlace que pongas.
  - **Prueba abierta**: todos llevan al enlace para unirse.
  - **En Google Play**: todos llevan a la ficha.
  - Cada texto se puede cambiar; vacío, dice lo de su estado. Debajo se ve cómo quedan.
  - Se guarda en KV (`cerofiao:download`), la página lo pide a `/api/download` y lo recuerda en el navegador para no parpadear la próxima vez (`src/cf-download.js`). Sin JavaScript se ven los textos de «Próximamente».

Todo el panel (`/admin/`, `/admin/negocio/`, `/apps/` y `/apps/tienda/`) lleva el sistema de diseño de la app CeroFiao: los tokens de `core-designsystem` (fondo gris claro o negro puro, superficies blancas o `#17171A` con borde de 1 px, el cian `#00B8D4`/`#00E5FF`), botones en píldora, chips y segmentos con la opción activa en negro (blanco en oscuro), Anton en las cifras, campos rellenos como en el kit de HeroUI de CeroFiao y la navegación en una cápsula de cristal. Las barras de desplazamiento son una píldora fina, los desplegables abren una lista con ese mismo estilo (en Chrome y Edge; en el resto, la del sistema), la pieza activa de pestañas y segmentos se desliza de una opción a otra (`src/panel-motion.js`) y el cambio de página es una transición suave. Vive en `src/panel.css`, que se carga la última solo en esas páginas y traduce a esos valores los tokens que ya usan sus estilos: la web pública y la página que abre el cliente no cambian. La letra es One UI Sans si está instalada en el equipo; si no, Inter.

### Ponerle contraseña (una sola vez)

La contraseña no está en el repositorio. Se define en Cloudflare:

1. Workers y Pages › `webschwarckdev` › Settings › Variables and Secrets.
2. Añade un **secreto** llamado `ADMIN_PASSWORD`, de al menos 10 caracteres.
3. Guarda. A los pocos segundos `/admin/` deja entrar con ella.

Mientras no exista, `/apps/` muestra estas mismas instrucciones y nadie puede entrar.

### El modelo en línea de CeroFiao

`POST /api/cerofiao/ai` atiende a la app cuando alguien enciende **Ajustes › Escáner y voz › Modelo en línea**: recibe la conversación (lo que se preguntó, o el texto leído de una factura, y las cifras que la app le pasa al modelo), se la da a Workers AI con `@cf/google/gemma-4-26b-a4b-it` y devuelve `{ text, tool_calls, usage }`. No guarda nada. El modelo lo fija el servidor, cada conexión tiene un tope de 30 preguntas por minuto (`AI_LIMIT`) y el gasto va a la cuenta de Cloudflare (Workers AI, con su cuota gratis diaria).

Para encenderlo, una sola vez:

1. Workers y Pages › `webschwarckdev` › Settings › Variables and Secrets.
2. Añade un **secreto** llamado `CEROFIAO_AI_KEY`: una clave larga que inventes (por ejemplo, 32 letras y números al azar).
3. En la app, pon esa misma clave en Modelo en línea.

Sin la clave, el punto contesta 503 y la app dice que el modelo en línea no está activado.

### Gráficos para Google Play

En `/apps/tienda/` se componen las imágenes de la ficha con las capturas de la app y se descargan en la medida que pide Play Console:

- **Capturas de teléfono**: 1080 × 1920 px (9:16). Play admite de 2 a 8.
- **Gráfico de funciones**: 1024 × 500 px.

Hay varias plantillas, fondos, adornos y letras; «Ideas» enseña el mismo contenido en otros estilos y «Proponer una serie» arma las ocho capturas con el estilo elegido. «Descargar todo» entrega un `.zip` con la serie y el gráfico de funciones.

Los archivos salen en PNG de 24 bits sin transparencia (Play rechaza los PNG con canal alfa) o en JPEG. Todo se dibuja en el navegador: no se sube nada y no hace falta contraseña. El trabajo se guarda en ese navegador; las capturas subidas a mano solo duran lo que dure la pestaña.

- `src/store-render.js`: las plantillas. Cada una es una función que pinta en un `<canvas>`; para añadir otra basta sumarla a `PHONE_TEMPLATES` o `FEATURE_TEMPLATES`.
- `src/store-export.js`: escribe el PNG, el JPEG y el `.zip`.
- `src/store-studio.js`: los controles de la página.

Para añadir una captura nueva, guárdala en `public/img/cerofiao/store/` como `nombre.webp` (1080 px de ancho), `nombre-thumb.webp` (216 px) y, si existe en oscuro, `nombre-dark.webp` y `nombre-dark-thumb.webp`; luego añádela a `LIBRARY` en `src/store-studio.js`.

### Negocio

En `/admin/negocio/` se llevan los clientes y se emiten facturas, cotizaciones y recibos. Entra con la misma contraseña del panel.

- **Facturas y cotizaciones**: se editan sobre la hoja misma. Llevan descuento, impuesto, retención, otros cargos y una equivalencia en otra moneda con su tasa (BCV, paralelo…). Se numeran solas por tipo y año (`FAC-2026-0001`, `COT-…`, `REC-…`) y se imprimen o guardan en PDF desde el navegador.
- **Cobros**: cada factura admite pagos parciales; cada pago puede generar su recibo. Una cotización aceptada se convierte en factura con un clic.
- **Formas de cobro** (en Ajustes): Pago Móvil, Zelle, Binance Pay… Si llevan enlace de pago, la factura enseña un botón y un código QR.
- **Clientes y catálogo**: los datos del cliente y los servicios con su precio (y su foto, si la tiene) se rellenan solos en cada documento. Un documento guarda su propia copia: editar un cliente no cambia lo ya emitido.
- **Editor**: cada línea tiene un asa (a su izquierda) para arrastrarla a otro sitio o abrir su menú: poner una foto, duplicarla, subirla o bajarla, o guardarla en el catálogo. Las secciones del pie (términos, garantía…) se ordenan y se guardan en la **biblioteca**; desde «De la biblioteca» se añaden a cualquier factura, cotización o propuesta. En las propuestas también se guarda un bloque entero (con el marcador de su barra) y hay un bloque de imagen. La biblioteca se ordena en Ajustes.

- **Panel del proyecto** (como el de Runey): seis cifras arriba (presupuesto restante, ganado, facturado, cobrado, horas y tareas), las etapas, un **calendario de actividad** (línea de tiempo, semana o mes) con todo lo que pasó —proyecto creado, etapas completadas, tareas nuevas, hechas o borradas, horas, documentos, cobros, firmas y páginas—, lo que cuelga del proyecto (tareas, documentos y páginas) y la lista de actividad más reciente.
- **Proyectos**: cada uno es de un cliente. El listado cuenta activos, pendientes y completados; la ficha tiene seis cifras (presupuesto restante, ganado, facturado, cobrado, horas y tareas), etapas que se completan en orden (Arranque → En curso → Revisión → Entregado, editables) y sus documentos. En el editor, el chip «Proyecto» enlaza una factura o cotización a un proyecto.
- **Tareas**: tablero (Solicitud, Por hacer, En curso, Revisión, Hecho) con arrastrar y soltar, o lista. Cada tarea tiene prioridad, fechas, valor fijo o tarifa por hora, checklist, comentarios y sus horas. En `#/tareas` están las de todos los proyectos.
- **Al estilo de Linear**: cada proyecto tiene una clave (WEB, CF…; se propone sola y se cambia en el proyecto) y cada tarea un número dentro de él: `WEB-12`. `#/tareas/WEB-12` abre esa tarea. Una tarea tiene **portada** (un color o una imagen), **subtareas** (dentro de su ficha; en el tablero se ven con «Subtareas») y **enlaces**: relaciones con otras tareas (bloquea a, bloqueada por, relacionada, duplicado de), páginas, documentos o webs. Escribir la clave de otra tarea, el número de un documento (`FAC-2026-0001`) o `[[el título de una página]]` en la descripción o en un comentario la enlaza; escribir `[[` abre un buscador. La ficha enseña también quién la menciona. Si una tarea cambia de proyecto o un proyecto de clave, las claves viejas siguen llevando a ella.
- **Horas**: el temporizador del riel (uno a la vez; vive en los datos, así que sobrevive a recargar) o el registro a mano. La tarifa sale de la entrada, la tarea, el proyecto o Ajustes, en ese orden. «Facturar horas» crea una factura con lo pendiente, agrupado por tarea, por día o por entrada, y lo marca como facturado; si esa factura se borra o se anula, las horas vuelven a quedar pendientes.

Ajustes también tiene «Descargar copia», que baja todo en un JSON.

- **Buscador (Ctrl+K o ⌘K, o la lupa del riel)**: lleva a cualquier sección, crea lo mismo que el «+» y abre clientes, proyectos, tareas (por título o por clave), documentos (por número), páginas y leads. Se maneja con el teclado y recuerda lo último abierto.
- **Movimiento** (`src/negocio-fx.js` y `src/negocio-fx.css`): las cifras de los KPI cuentan al abrir cada página, filas y tarjetas entran escalonadas, una pieza se desliza por el riel hasta la sección activa, los botones se hunden al pulsar y las ventanas se van con suavidad. En el teléfono el riel deja el «+» fijo, centra la sección activa y desvanece los bordes cuando hay más. El análisis completo está en `docs/negocio-ui-analisis.md`.

- `src/negocio.js`: entrada, rutas y riel.
- `src/negocio-core.js`: datos, fila de guardado, cálculos y piezas de interfaz.
- `src/negocio-views.js`: listados, clientes, catálogo y ajustes.
- `src/negocio-doc.js`: el editor de documentos.
- `src/negocio-work.js`: proyectos, tareas y horas: cuentas, temporizador y facturar horas.
- `src/negocio-projects.js`, `src/negocio-tasks.js`, `src/negocio-time.js`: sus pantallas; estilos en `src/negocio-trabajo.css`.
- `src/negocio-enlaces.js`: claves, enlaces entre tareas, páginas y documentos, el texto con enlaces y las portadas.

### Páginas

En «Páginas» (`#/paginas`) se escriben notas, guías, briefs y actas de reunión, como las páginas de Runey o Notion. Cada página tiene icono, portada, subpáginas (el árbol de la izquierda), favoritas y, si se quiere, un cliente y un proyecto: entonces sale también en su ficha.

- **Bloques**: texto, títulos, listas, listas numeradas, pendientes, citas, destacados, código, separadores, imágenes (también pegándolas o arrastrándolas) y enlaces a una tarea, página o documento. «/» elige el tipo; empezar una línea con `#`, `##`, `###`, `-`, `1.`, `[]`, `>`, ```` ``` ```` o `---` la convierte. Cada bloque se arrastra por su asa o se cambia desde su menú. `Ctrl+B` y `Ctrl+I` ponen negrita y cursiva.
- **Enlaces**: igual que en las tareas, la clave de una tarea, el número de un documento o `[[otra página]]` se leen como enlaces, y un `[[título]]` que no existe crea la página al tocarlo. Al renombrar una página, sus enlaces cambian con ella. Al pie se ven las subpáginas y quién la menciona.
- **Plantillas**: en blanco, notas de reunión, brief de proyecto, guía, checklist de lanzamiento, idea de contenido y retrospectiva.
- Se copian como Markdown o se imprimen.

- `src/negocio-paginas.js` y `src/negocio-paginas.css`.

### Leads

En «Leads» (`#/leads`) se lleva a quien todavía no es cliente: de dónde llegó (Instagram, WhatsApp, la web, una recomendación…; la marca, la campaña y la publicación), qué le interesa, cuánto vale y cuándo toca volver a escribirle.

- **Embudo**: Nuevo, Contactado, Calificado, Propuesta, Negociación, Ganado y Perdido, con lo que suma cada columna. Se arrastra de una etapa a otra; al perder uno se pide el motivo.
- **Ficha**: el siguiente paso con su fecha (hoy, mañana, en 3 días…) y «Hecho»; registrar un mensaje, una llamada, un correo o una reunión; el historial con cada cambio de etapa; «Pasar a cliente» y crearle una propuesta o una cotización a su nombre.
- **Para hoy**: los seguimientos del día y los atrasados, arriba de la página, en el inicio y en el calendario de marketing.
- **Análisis**: leads nuevos y ganados (con la variación frente al periodo anterior), conversión, valor del embudo ponderado por la probabilidad de cada etapa, embudo de conversión, leads por mes, por fuente, por marca y por campaña (con el coste por lead) y los motivos de pérdida.

- `src/negocio-leads.js` y `src/negocio-leads.css`.
- `src/cf-tokens.css`: los colores de CeroFiao, compartidos con su página.

### Gastos e inicio

- **Inicio** (la portada del negocio): lo cobrado, lo gastado y lo que falta por cobrar en el periodo elegido, comparado con el tramo anterior; el beneficio; un gráfico de entradas y salidas de los últimos 12 meses; lo último que pasó; las facturas por cobrar y los últimos gastos. Mientras falte algo por configurar enseña unos «Primeros pasos».
- **Gastos**: cada gasto se apunta en una ventana (concepto, importe, moneda, fecha, categoría, proveedor, forma de pago, notas y recibo). Si no está en la moneda principal pide la tasa del día del pago (BCV, paralelo…), y con ella se pasa a la moneda principal para siempre. El gasto recuerda frente a qué moneda se puso esa tasa: si un día cambias la moneda principal, ese gasto sale como «sin tasa» en vez de convertirse mal.
- **Cobros en otra moneda**: al registrar el pago de una factura que no está en la moneda principal se pide también la tasa del día del pago, con la misma regla que en los gastos («1 [la moneda más fuerte] = tasa [la más débil]»). Viene rellenada con la equivalencia de la factura, si la tiene. El pago guarda la tasa, su fuente y frente a qué moneda se puso (`rate`, `rateSource`, `rateBase`). Con ella cuenta en lo cobrado de Inicio (también en el gráfico), Facturas, Clientes y Proyectos (`paymentBase` y `paymentIn` en `src/negocio-core.js`). Los pagos de antes no tienen tasa propia y se siguen pasando con la equivalencia de la factura; si tampoco hay equivalencia, salen como «sin equivalencia». Lo facturado y lo que falta por cobrar se siguen pasando con la equivalencia de la factura.
- **Recibos**: foto o PDF de hasta 3 MB, arrastrándolo a la ventana. Las fotos se reducen antes de subirse. Se guardan aparte en KV (`crm:file:<id>`) y solo se sirven a quien tiene la sesión del panel.
- **Proveedores**: se crean solos al escribir su nombre; con su web se muestra su logo (lo da DuckDuckGo a partir del dominio).
- **Categorías**: se proponen ocho la primera vez; en «Categorías» se renombran, ordenan, recolorean, archivan o borran.

- `src/negocio-inicio.js`: el inicio.
- `src/negocio-gastos.js`: gastos, proveedores, categorías y recibos.
- `src/negocio-gastos.css`: los estilos de ambos.

### Propuestas y enlaces para el cliente

- **Propuestas**: documentos hechos de bloques (introducción, objetivos, alcance, calendario, equipo, testimonios, trabajos anteriores y precio) que se añaden, ordenan y quitan sobre la hoja. Empiezan desde una plantilla (app para Android, sitio web, identidad de marca o en blanco) y se numeran `PRO-2026-0001`.
- **Enlace para el cliente**: cualquier factura, cotización o propuesta se comparte con «Compartir». El enlace lleva un token largo y aleatorio después de `#`, puede tener contraseña (se guarda resumida, nunca en claro) y caducar a los 7, 30 o 90 días, y se desactiva cuando se quiera. El cliente ve la hoja con la estética de CeroFiao, la imprime o la paga; no ve nada más del panel.
- **Aperturas**: cada vez que el cliente abre el enlace queda anotado (como mucho una vez cada media hora). La cotización o la propuesta pasa a «Vista» y el inicio lo cuenta.
- **Firma**: en cotizaciones y propuestas, el cliente acepta escribiendo su nombre o dibujando su firma, y queda la fecha y la hora. También puede rechazar con un motivo. Lo firmado se bloquea: el servidor no deja cambiar su contenido, solo su estado y a qué factura o proyecto llevó.
- **Después de firmar**: «Convertir en factura» copia las líneas a una factura nueva, y «Factura y proyecto» además crea el proyecto con su presupuesto.
- **En su portal**: si el cliente tiene portal (y la cuenta del estudio está conectada), «Enlace» › «Publicar en su portal» la pone en su app (Facturas y documentos) con un aviso; su estado se mantiene al día solo y «Quitar de su portal» la retira. Si aún no tenía enlace, se crea uno sin contraseña ni caducidad.

El panel se entera de aperturas y firmas al volver a su pestaña. Abrir el enlace con «Abrir» desde el panel no cuenta como visita del cliente.

- **Lo que ya no se firma**: una cotización o propuesta anulada o marcada como rechazada ya no admite respuesta, y una factura anulada sale como «Anulada», sin botón ni QR para pagar. La validez dura hasta la medianoche de Venezuela del último día, igual en la página y en el servidor.
- **Números**: el último número de cada serie (`FAC-2026`, `COT-2026`…) queda en `crm:seq` y nunca baja: borrar la última factura no hace que la siguiente repita su número.

- `src/negocio-propuesta.js`: los bloques y las plantillas.
- `src/negocio-sheet.js`: la hoja de solo lectura (enlace público y documentos firmados).
- `src/documento.js` y `src/documento.css`: la página que abre el cliente.
- En `worker/index.js`, «Enlaces públicos de documentos»: crear y desactivar enlaces, servir el documento, anotar aperturas y recibir la firma o el rechazo. Las firmas tienen un freno de ráfagas (`WRITE_LIMIT`) y las contraseñas otro (`LOGIN_LIMIT`).

### Marketing

En «Marketing» se planifica el contenido de las tres marcas del estudio (CeroFiao, Schwarck Developer y Lion Fitness), que se crean solas la primera vez con sus datos y sus capturas reales. Un filtro de marca, de rol en el embudo y de estado vale para todas las pestañas:

- **Calendario**: el mes con cada publicación en su día, del color de su marca. Se arrastra de un día a otro para cambiarla de fecha. Si se quiere, enseña también las tareas que vencen y los cobros pendientes. En el teléfono se ve como agenda.
- **Tablero**: el flujo editorial (idea, guion, diseño, aprobado, programado, publicado). Se arrastra entre columnas.
- **Copias**: el copy de Instagram (con sus hashtags) y el de Facebook, listos para copiar con un botón.
- **Feed**: cómo quedará la cuadrícula del perfil de Instagram de cada marca, y el equilibrio entre atracción, autoridad, conversión y comunidad del mes.
- **Marcas**: colores, tipografía, tono, público, pilares, llamada a la acción, hashtags y pautas, más sus imágenes (en claro y en oscuro) y sus logos en SVG para copiar o descargar.

Cada publicación lleva título, marca, fecha y hora, formato, categoría, rol en el embudo, estado, responsable, campaña, pilar de contenido, imagen o color de portada, guion visual, copy de Instagram, hashtags y copy de Facebook. El copy de Instagram puede empezar desde una plantilla (AIDA, PAS o lanzamiento) y el de Facebook se adapta desde él con un clic: quita el bloque de hashtags y pone el enlace de la marca donde decía «link en la bio». Los grupos de hashtags de la marca se añaden con un toque, y «Duplicar» la copia una semana después.

- **Resultados de cada publicación**: alcance, me gusta, comentarios, guardados, compartidos, clics y seguidores nuevos (se apuntan a mano desde las estadísticas de Instagram o Facebook), el enlace a la publicación y los leads que trajo, con un botón para apuntar uno nuevo.
- **Calendario**: por mes, por semana (con miniaturas) o como agenda de los próximos 30 días. Las campañas en marcha se ven como una franja de su color y, si la marca tiene una cadencia (publicaciones por semana), el resumen dice si se va al día. Además de tareas y cobros, enseña los seguimientos de leads.
- **Campañas**: un lanzamiento, una promoción o un mes de contenido, con marca, fechas, objetivo, presupuesto, lo gastado y los leads que se esperan. Cada campaña cuenta sus publicaciones, sus leads, el coste por lead, las ventas de los leads ganados y el retorno.
- **Resultados**: las publicadas del periodo, su alcance, la interacción media, los leads de redes y las que mejor funcionaron; y qué papel del embudo y qué formato enganchan más.
- **Copias**: ahora también «Publicada», para marcarla al pegarla. **Feed**: arrastrar una casilla sobre otra intercambia sus fechas.

- `src/negocio-contenido.js`: marcas, publicaciones, plantillas y el formulario.
- `src/negocio-calendario.js`: el calendario y el tablero.
- `src/negocio-marketing.js`: la página, las campañas, los resultados, las copias, el feed y las marcas.
- `src/negocio-marketing.css`: sus estilos.

### Guardado y varios dispositivos

- Cada cambio se guarda solo, en lotes, un segundo y medio después de dejar de escribir (las páginas, a los dos segundos), y al momento al dejar la pestaña o cerrarla.
- Si el servidor rechaza un cambio (por ejemplo, una página que pasa del tamaño máximo), ese cambio se aparta con un aviso que dice cuál fue y lo demás se sigue guardando.
- Al volver a la pestaña tras un rato, el panel vuelve a leerlo todo: lo hecho desde el teléfono aparece aquí. Para no gastar la cuota diaria de KV, como mucho una vez cada dos minutos.
- Un documento abierto a la vez en dos sitios no se pisa: cada guardado lleva la versión de la que partió, y si en el servidor hay una más nueva (con un pago registrado desde el teléfono, por ejemplo) el panel carga esa y avisa.
- Lo firmado por el cliente mientras estaba abierto en el panel se queda como lo firmó: el panel carga esa versión y lo dice.

### Dónde se guardan los datos

En un espacio KV de Cloudflare enlazado como `SITE` (salvo el portal de clientes, que vive en Supabase: ver arriba) (lo crea `wrangler deploy` la primera vez). Guarda la lista de novedades, el botón de descarga de CeroFiao, las reseñas y los datos del negocio (cada colección en una clave `crm:*`, también las páginas, los leads y las campañas; cada archivo subido —recibos, fotos de líneas, portadas e imágenes— en `crm:file:*`, cada enlace público en `crm:share:*`, lo que pasa en él en `crm:pub:*` y `crm:sig:*`, el último número de cada serie de documentos en `crm:seq` y, durante dos minutos, el pase de un solo uso con el que Negocio crea la cuenta del estudio del portal en `portal:ticket:*`). Las reseñas llevan el nombre que escribió la persona, su calificación, el texto y la fecha; no se guarda correo ni dirección IP.

## Portal de clientes

`/cliente/` es una app que se instala en el teléfono (o se usa en el ordenador), la misma para el cliente y para el estudio:

- **El cliente** ve su proyecto. Entra con el correo y la contraseña que le da el estudio, toca «Instalar» y queda como una app más, con su icono, sin barra del navegador y con avisos push.
- **El estudio** entra con su cuenta (marcada como estudio en Supabase) y ve el portal de cada cliente con todo editable, lo que le envían y sus herramientas: es el panel del portal, pensado para el teléfono.

### Lo que ve el cliente

- **Inicio**: saludo, «Hoy en tu proyecto» (lo que el estudio hizo hoy y lo que está haciendo ahora, con un anillo de progreso), el tablón (si su portal lo permite, también publica en él para su equipo y para el estudio), lo que tiene que aprobar, lo que le pedimos, el resumen de resultados del mes, lo próximo del calendario y lo último que pasó.
- **Cronología**: todo, por días: el **reporte diario** del estudio (cada tarea hecha, en curso o planificada, con su tiempo, quién lo mandó y a qué hora, y sus dificultades y observaciones), anuncios, avances, hitos, entregas, peticiones, contenido, resultados y lo que el propio cliente envió o comentó. Lo nuevo desde su última visita sale marcado.
- **Marketing**:
  - **Calendario** por mes (con el equilibrio del mes entre atracción, autoridad, conversión y comunidad), en lista o como la cuadrícula del perfil de Instagram. Se cambia de mes deslizando.
  - **La ficha de cada publicación**: imágenes y vídeos, sus redes (una misma pieza puede salir en varias), formato, embudo, pilar y campaña, fecha, las etapas (idea → producción → revisión → aprobado → programado → publicado), objetivo, llamada a la acción, texto y hashtags (con botón de copiar), la producción según el formato (texto en la pieza y diseño en un post; cada diapositiva en un carrusel; cada pantalla en una historia; guion por tiempos, duración y notas de grabación en un reel o vídeo; esquema y palabra clave en un artículo), referencias y la conversación. Lo que está para revisar lo **aprueba** o **pide cambios**; y puede **rechazar** cualquier publicación hasta que se programa (con quién lo hizo, a la vista del estudio).
  - **Proponer** (si su portal lo permite): una idea con su fecha, redes, formato y un ejemplo. Llega al estudio como «Idea del cliente»; mientras siga siendo idea, quien la propuso la puede retirar.
  - **Rendimiento** del mes: alcance (con la variación frente al mes anterior y los últimos 6 meses), seguidores, interacciones y su tasa, leads y coste por lead, ventas y retorno, clics, impresiones, publicaciones, inversión y el desglose por red.
  - **Leads**: los del mes, los ganados y la conversión, el valor del embudo, el embudo por etapas, las fuentes y la lista. Si su portal lo permite, añade leads y los mueve de etapa.
- **Recursos**: guías, manuales, fotos, vídeos y enlaces, con buscador y categorías. Si su portal lo permite, sube los suyos (y solo borra esos).
- **Peticiones**: lo que le pedimos (con prioridad, fecha y qué se espera). La marca como enviada o manda lo pedido desde ahí; cada petición tiene su conversación.
- **Enviar** (el botón flotante): mensajes, enlaces, archivos y vídeos de hasta 50 MB.
- **Perfil**: su foto, nombre, cargo y teléfono; los datos de su negocio (sector, descripción, web, redes, teléfono, correo, dirección y horario); qué avisos quiere recibir; vibración, sonidos y tema; instalar la app, cambiar la contraseña y salir.
- **Proyecto** (`#/proyecto`, y su tarjeta en Inicio): el proyecto de Negocio tal como avanza: etapas, porcentaje de tareas hechas, horas del mes y totales, fechas, lo próximo con fecha, y sus hitos y entregas.
- **Facturas y documentos** (`#/documentos`, arriba de Recursos y en Inicio lo que espera algo): las facturas, cotizaciones, propuestas y recibos que el estudio publica desde Negocio, con lo que falta por pagar y lo pagado en el año. Cada uno abre su hoja (`/documento/#…`) para pagarla o firmarla; el estado se pone al día solo.
- **Reuniones** (`#/reuniones`): pide una con su tema, la modalidad (videollamada, llamada o en persona), la duración y hasta tres horarios que le vienen bien (también desde «Enviar»). La próxima sale en Inicio con «Unirse» y «Añadir al calendario» (un `.ics` con aviso 15 minutos antes). Puede cancelar la suya.
- **Valoración del mes**: del día 20 al 7 del mes siguiente, Inicio pregunta «¿Cómo lo hicimos en noviembre?» (1 a 5 estrellas y un comentario, que solo ve el estudio). Se puede cambiar dentro de ese plazo, también desde Perfil.
- **Informe del mes** (`#/informe/2026-11`, desde Cronología, Perfil y, la primera semana del mes, Inicio): el trabajo con sus horas por área, lo publicado, los resultados frente al mes anterior, los leads, los hitos y reuniones y el proyecto, con su marca. «PDF» lo imprime limpio (sin barras ni botones) y «Compartir» manda un resumen. Solo enseña lo que esa persona puede ver.
- **Buscar** (la lupa de arriba, o `/` y ⌘K en el ordenador): publicaciones, trabajo, peticiones, recursos, anuncios, conversaciones, leads, documentos y reuniones, sin que estorben tildes ni mayúsculas, con lo encontrado resaltado y las últimas búsquedas.

### Lo que hace el estudio

Todo lo anterior, editable (mantener pulsado un recurso, una petición o una publicación también lo abre para editar), y además:

- **Inicio del estudio**: lo que pide atención (envíos sin ver, peticiones enviadas, cambios pedidos, rechazos, ideas del cliente y comentarios sin responder), ocho atajos para crear y el trabajo de hoy, que se marca como hecho, en curso o planificado con un toque.
- **Hoy en todos tus clientes** (con más de un portal): en una sola lista, lo que te respondieron, las ideas de cada cliente, lo que sale hoy, lo que espera su aprobación, las peticiones y lo que te enviaron. Cada línea abre ese portal justo ahí.
- **El botón «Crear»**: reporte de hoy (varias líneas de golpe, con quién lo manda, dificultades y observaciones, que el cliente ve debajo), pegar el reporte de Nexus, importar el calendario de Claude, trabajo, anuncio o avance, petición, publicación del calendario (la ficha completa, con imágenes y vídeos, y la producción según el formato), recurso, lead y resultados del mes (en total o por red).
- **Plantillas**: una publicación o una petición se guarda como plantilla («Reel de proceso», «Pedir fotos del mes»…) y la siguiente empieza desde ahí. También se duplican.
- **Calendario**: arrastrar una publicación a otro día la mueve; «Seleccionar varias» cambia de etapa o borra muchas de golpe; mantener pulsada una deja editarla, duplicarla, moverla de día o borrarla.
- **Clientes**: el logo de arriba a la izquierda cambia de cliente (con lo pendiente de cada uno) y crea portales.
- **Reuniones**: las que pide el cliente salen en lo que pide atención; se confirman con uno de sus horarios (u otra hora), con el enlace de la videollamada (se recuerda para la próxima) o la dirección, o se responde «No puedo» con un mensaje. «Crear › Reunión» agenda una directamente. Su valoración del mes sale en Inicio (media, frente al mes anterior y el último comentario) y en Perfil › Valoraciones.
- **Tareas en Negocio**: cada cosa que pide el cliente (un envío, una petición entregada, un cambio pedido, un rechazo, una idea, un comentario o una reunión) tiene su botón «Tarea»: crea la tarea en la columna «Solicitud» de su proyecto de Negocio, con el enlace de vuelta al portal, y el botón pasa a enseñar su clave (`CAF-28`). Usa la sesión del panel; si no está abierta, pide la contraseña en una hoja.
- **Accesos** (en el perfil o en los atajos): dar acceso con un correo (la contraseña se ve una sola vez, con el mensaje listo para mandar por WhatsApp), cambiar el rol y las excepciones de cada persona, los permisos de todo el portal, crear una contraseña nueva, copiar un enlace de acceso de un solo uso o quitar el acceso. No se envía ningún correo.

### Desde Negocio › Portal de clientes

La administración de los portales, con la misma cuenta del estudio que la app (la sesión se comparte: es el mismo sitio). **Entra sola**: como ya tienes abierta la sesión del panel, Negocio pide al Worker un pase de un solo uso, la función `portal` lo comprueba (acción `ticket_login`) y devuelve un enlace mágico de la cuenta del estudio, que se abre sin escribir nada (`autoStudioLogin` en `src/negocio-puente.js`). Si no hay cuenta del estudio todavía, lo dice y deja crearla. Arriba, «Abrir el portal» (y en su flecha, la app nueva y la demostración del estudio) y el QR para el teléfono en un desplegable. Cuatro pestañas:

- **Resumen**: portales, personas con acceso, lo que te enviaron sin ver, las peticiones por revisar, las reuniones por confirmar y la valoración media, con la actividad de las últimas ocho semanas en un gráfico y las personas de cada portal en un anillo; y «Mandar al portal», que publica directamente en el reporte de hoy de cada cliente lo que terminaste en Negocio (tareas hechas y horas, eligiendo qué), sin repetir lo que ya esté («Editarlo en la app antes» lo abre en la app, como antes).
  - **Lo que te piden tus clientes**: en todos los portales, los envíos sin ver, las peticiones entregadas, los cambios pedidos, los rechazos, las ideas y las reuniones pedidas. «Crear tarea» la pone en «Solicitud» del proyecto de ese cliente; si ya tiene tarea, enseña su clave.
  - **Al día con los portales**: se ponen al día solos unos segundos después de cada cambio (o con «Sincronizar ahora»): los **proyectos** de cada cliente enlazado (etapas, avance, horas, lo próximo con fecha; cada etapa completada llega una sola vez como hito a su cronología, y solo avisa al teléfono la más reciente), los **documentos publicados** (pagos, aperturas, firmas, importes) y los **datos del cliente** (correo, teléfono, dirección y web: se rellena lo que falte en cada lado, y si los dos tienen algo distinto se elige cuál vale).
- **Clientes**: cada portal con su logo, su color, su gente y cuántos permisos tiene cambiados, y sus botones a la vista (Abrir, Editar, Personas). **Nuevo portal** es un asistente de cinco pasos: de qué cliente es, su marca (color, sector), qué podrá hacer su gente (con niveles ya hechos: Solo ver, Como viene, Colaborar o Todo), quién entra (crea su cuenta y enseña la contraseña una sola vez) y la bienvenida. Los **permisos** (qué ve y qué puede hacer su gente) se ordenan por grupos en pestañas, con los mismos niveles arriba, «Todo» y «Nada» por grupo y un contador; la ventana se desplaza con sombra en los bordes. **Conectar Claude** (ver abajo), archivarlo (su gente deja de verlo) o borrarlo con todo lo suyo.
- **Accesos**: todas las cuentas, con buscador y filtro por portal. «Nueva cuenta» crea la de un cliente (portal, rol y excepciones) o la de alguien del estudio, con una contraseña generada o elegida; se ve una sola vez, con el mensaje listo para mandar. En cada cuenta: hacerla del estudio o no, cambiar su rol o sus excepciones en cada portal (la llave), añadirla a otro portal o quitarla, crear una contraseña nueva, copiar un enlace de acceso de un solo uso o borrarla.
- **Identidad**: la marca de cada cliente en su app, con la app de verdad al lado (en un teléfono, al ancho real) que cambia mientras editas: nombre del cliente y nombre de la app, logo, color principal y secundario, bienvenida, tipografía de los títulos (nueve), esquinas (rectas, suaves o redondas), inicio (degradado, color liso o imagen de portada) y tema por defecto (si la persona elige otro en su perfil, manda el suyo).

### Roles y permisos

- **Estudio** (`app_metadata.role = 'admin'`): entra en todos los portales y lo puede todo, también en Negocio.
- **Dueño**: lo que permita su portal, y es el único que edita los datos del negocio. La primera persona de cada portal lo es.
- **Equipo**: lo que permita su portal, salvo editar el negocio.
- **Solo lectura**: solo ve lo que su portal deja ver.

Encima de eso, cada portal tiene sus **permisos** (Negocio › Clientes › Permisos, o Accesos › Permisos del cliente en la app):

| Grupo | Permisos | Si nadie lo cambia |
| --- | --- | --- |
| Ve | cronología, reporte diario, calendario, rendimiento, leads, recursos y peticiones | sí |
| Decide sobre el contenido | aprobar o pedir cambios, rechazar | sí |
| | proponer publicaciones | no |
| Crea y envía | publicar anuncios, subir recursos, añadir leads, mover leads | no |
| | entregar peticiones, enviar mensajes y archivos, comentar | sí |
| Su negocio | editar los datos del negocio | sí (solo el dueño) |
| Ve (v5) | proyecto, facturas y documentos | sí |
| Pide (v5) | pedir reuniones, valorar el mes | sí (no «Solo lectura») |

Y a una persona se le ponen **excepciones**: lo que se marque solo para ella manda sobre su rol y su portal; lo demás los sigue. Así, por ejemplo, Patryk ve la producción, aprueba y rechaza pero no crea, y a alguien de su equipo se le quita rechazar.

No es solo la interfaz: la regla es una sola (`private.perm` en la base, `memberCan` en `src/portal/brand.js` y en la función `portal`), y la base no da los datos ni acepta los cambios que no tocan; tampoco llegan avisos de lo que no se ve. Lo que crea un cliente entra marcado como suyo: una propuesta siempre como idea, un anuncio sin fijar y con su nombre.

### Reporte de Nexus

El reporte diario que se copia en Nexus («📋 REPORTE DIARIO DE ACTIVIDADES», con fecha, asistente, hora, tareas realizadas, pendientes, dificultades y observaciones) se publica tal cual: Crear › «Pegar reporte de Nexus» (o el botón «Nexus» junto a «Trabajo de hoy»). Cada tarea realizada queda como una línea hecha y cada pendiente como «en curso», en el día del reporte; quién lo mandó, a qué hora, las dificultades y las observaciones quedan como notas del día, que el cliente ve debajo del reporte («Ninguno» se ignora). Pegar el mismo reporte dos veces no repite nada. Si el navegador ya dio permiso para leer el portapapeles, al volver a la app con el reporte copiado aparece un aviso para publicarlo con un toque. Quien pega el reporte necesita una cuenta del estudio.

### Claude y el calendario

Después de idear el contenido con Claude (por ejemplo, en el proyecto de PatrykBioHacker), Claude lo carga de una vez en el calendario del cliente, para las redes que se le digan. Dos formas:

- **Conector** (lo recomendado): Negocio › Portal de clientes › Clientes › ⋯ › «Conectar Claude» crea una dirección secreta para ese portal (se ve una sola vez; en la base solo queda su huella). En Claude: Ajustes › Conectores › «Añadir conector personalizado», pegar la dirección y activarlo en la conversación. Herramientas: `ver_portal`, `ver_calendario`, `ver_publicacion`, `crear_publicaciones` (hasta 60 de golpe; si una falla, no se carga ninguna y dice cuál), `editar_publicacion` (solo ideas o en producción) y `borrar_publicacion` (solo las ideas que cargó el conector). «Cambiar la dirección» deja la anterior sin valor; «Desconectar» la borra.
- **Pegar**: en el mismo diálogo, «Copiar instrucciones» da el texto para Claude; él responde con un bloque que se pega en la app (Crear › «Importar calendario de Claude»), que enseña antes de cargar cuántas son, de qué fechas, por red, y lo que no se puede cargar.

Lo que carga Claude entra como «Idea» marcada «De Claude»: el cliente no lo ve ni recibe avisos hasta que el estudio lo pasa a producción o a revisión. Es la función `supabase/functions/portal-mcp/` (MCP por HTTP, sin estado).

### Tacto, sonido y movimiento

- Cada toque responde: vibración en Android y, en el iPhone (iOS 18 o posterior), el golpe háptico del interruptor nativo. Patrones distintos para tocar, cambiar de pestaña, confirmar, avisar y equivocarse (`src/portal/feel.js`).
- Sonidos cortos generados al momento (sin archivos) para abrir y cerrar hojas, enviar, aprobar, activar y errores. En el iPhone respetan el modo silencio. Las dos cosas se apagan en el perfil.
- Barra de arriba al estilo iOS: el título grande de cada pantalla se recoge en uno pequeño centrado sobre un cristal al bajar, y crece un poco al tirar hacia abajo.
- Hojas que suben con muelle y se cierran deslizando hacia abajo, menús de acciones como los de iOS, controles segmentados y fichas que rebotan, números que cuentan, barras y anillos que crecen, confeti al aprobar o enviar, botones que se hunden al pulsar. Con «reducir movimiento» todo queda quieto.

### Avisos al teléfono

Los manda la propia base: cada cambio que importa llama (con `pg_net`) a la función `portal` de Supabase, que decide a quién avisar y firma y cifra el aviso (Web Push con VAPID y aes128gcm, sin librerías):

- **Al cliente**: anuncios y recursos nuevos, el reporte del día (un solo aviso que se actualiza: «Reporte de hoy: 4 tareas hechas»), lo que el estudio empieza a hacer, peticiones nuevas y revisadas, contenido para revisar o publicado, resultados del mes y las respuestas del estudio. Cada categoría se puede silenciar en el perfil.
- **Al estudio**: lo que envía cada cliente, las peticiones que marca como enviadas, lo que aprueba, pide cambiar o rechaza, sus ideas, sus anuncios, recursos y leads, y sus comentarios. Los anuncios de un cliente también le llegan al resto de su equipo.
- **Recordatorios**: cada mañana a las 9:00 (Venezuela), `pg_cron` recuerda a cada cliente lo que vence hoy, mañana o ya venció, y a quien aprueba, lo que lleva más de 20 horas esperando su respuesta. Los lunes, además, el resumen de la semana.
- **Con la v5**: al cliente, cada factura o propuesta publicada, el pago recibido y la reunión confirmada, movida o sin hora; al estudio, las reuniones pedidas o canceladas, las firmas y rechazos y cada valoración del mes. Y por la mañana, las facturas que vencen hoy o mañana (o ya vencieron) y las reuniones del día (al cliente y al estudio).

La app pide el permiso tras entrar, con una hoja que explica para qué sirve (en el iPhone, primero pide instalarla: los avisos solo llegan a la app instalada, con iOS 16.4 o posterior). En el perfil se ve el estado y hay un botón «Probar».

### Dónde viven los datos

Todo en **Supabase** (proyecto SchwarckDevWeb); Cloudflare solo sirve los archivos de la página. Así el portal no gasta la cuota gratuita de KV, y los archivos y vídeos van al almacén de Supabase (1 GB gratis).

- `supabase/migrations/`: las tablas (portales, miembros, tablón, trabajo, notas del reporte de cada día, contenido, recursos, peticiones, envíos, comentarios, rendimiento, leads, plantillas y suscripciones a avisos), las reglas (RLS), los permisos y los avisos. El cliente solo ve sus portales y hace lo que le dejen sus permisos (marcar peticiones como enviadas, no darlas por buenas; aprobar, pedir cambios o rechazar contenido; comentar; enviar archivos a su carpeta; proponer ideas, anunciar, subir recursos o añadir leads si se le permite; editar su perfil y, si es el dueño, las columnas públicas de su negocio). El estudio (cuentas con `app_metadata.role = 'admin'`) lo puede todo. Las direcciones del conector de Claude viven en `private.portal_mcp_keys`, solo como huella.
- `supabase/migrations/20261125120000_portal_v5_negocio.sql` (**v5**): `portal_projects` (el proyecto de Negocio de cada cliente), `portal_documents` (lo publicado desde Negocio), `portal_meetings` (las reuniones: el cliente solo las pide, sin hora fijada, y solo cancela las suyas) y `portal_ratings` (una valoración por persona y mes, del mes que corre o el anterior), `portal_posts.source` (para no repetir un hito) y los permisos nuevos. Mientras no esté aplicada, la app y Negocio siguen como antes: lo nuevo no aparece y no da errores.
- `supabase/functions/portal-mcp/`: el conector de Claude para el calendario.
- `supabase/functions/portal/`: la función de accesos y avisos. Las claves VAPID las crea ella misma la primera vez y las guarda en Vault, igual que el secreto con el que la base la llama: no hay ningún secreto en el código ni en Cloudflare.
- `src/portal/config.js`: la dirección y la clave publicable del proyecto (son públicas).

### Ponerlo en marcha

Ya está hecho: las migraciones aplicadas, la función desplegada y un portal «Cliente de prueba» con su cuenta (`demo@schwarckdev.com`; la contraseña está en el archivo local `.env.portal-prueba`).

Falta, una sola vez (además de la **v5**, abajo):

1. **Tu cuenta del estudio**: en `schwarckdev.com`, Negocio › Portal de clientes › «Crear mi cuenta del estudio» (o «Ya tengo cuenta» si ya la tienes). Como ya tienes abierta la sesión del panel, el Worker da un pase de un solo uso (dos minutos) y la función `portal` crea la cuenta o convierte la tuya en cuenta del estudio. Solo funciona en el sitio publicado: la función comprueba el pase contra `schwarckdev.com`.

2. En Authentication › Sign In / Providers, desactiva «Allow new users to sign up» (las cuentas las crea el estudio) y activa la protección de contraseñas filtradas. En URL Configuration, pon `https://schwarckdev.com/cliente/` como Site URL (lo usan los enlaces de acceso de un solo uso).

La **entrada automática** de Negocio › Portal de clientes usa la acción `ticket_login` de la función `portal` (`supabase/functions/portal/index.ts`, desplegada como versión 5, con `verify_jwt` desactivado como siempre). Entra con la cuenta del estudio pedida o, si hay varias, con la que entró por última vez. Si algo falla, Negocio lo dice y deja entrar a mano como antes.

**La v5** (proyecto, documentos, reuniones y valoraciones) ya está en Supabase: la migración `20261125120000_portal_v5_negocio.sql` aplicada (como `portal_v5_negocio`) y la función `portal` desplegada con los avisos y recordatorios nuevos (versión 4, `verify_jwt` desactivado como antes). Sus reglas se probaron en la base real dentro de una transacción deshecha: el cliente no puede fijarse una hora ni confirmar su reunión, solo cancelar la suya; su valoración queda a su nombre y solo del mes que corre o el anterior; no crea documentos ni proyectos; nadie ve la valoración de otro; un hito no se repite.

`/cliente/?demo` enseña la app del cliente con datos de ejemplo (también lo de la v5), y `/cliente/?demo=estudio`, el modo estudio.

### Archivos

- `cliente/index.html`, `src/cliente.js` y `src/cliente.css`: la app (rutas, barra de arriba, pestañas y estilos).
- `src/portal/`: `data.js` (Supabase y la demostración), `state.js` (la cronología, lo pendiente y los permisos de quien mira), `kit.js` (piezas, hojas y controles), `feel.js` (vibración y sonido), `screens.js` (Inicio, Cronología, Recursos y Peticiones), `marketing.js`, `profile.js`, `threads.js` (conversaciones), `studio.js` (todo lo del estudio), `importers.js` (el reporte de Nexus y el calendario de Claude) y `tab-icons.js` (los iconos de las pestañas).
- `public/cliente/`: el manifiesto, el service worker (sin conexión y avisos) y los iconos.
- `src/portal/brand.js`: la identidad de cada cliente (tipografías, esquinas, inicio, tema y colores), los roles y los permisos.
- `src/negocio-portal.js` y `src/negocio-portal.css`: la administración desde Negocio (clientes, permisos, el conector de Claude, accesos e identidad).
- `src/negocio-puente.js`: Negocio ⇄ portal: la sesión de Supabase del estudio (una sola para todo Negocio), proyectos, documentos, datos del cliente, el reporte directo, lo que piden los clientes y la sincronización automática.
- `src/portal/project.js`, `documents.js`, `meetings.js`, `rating.js`, `report.js` y `search.js`: proyecto, documentos, reuniones, valoración del mes, informe del mes y buscador. `src/portal/negocio-link.js`: el botón «Tarea» del modo estudio (crea la tarea en Negocio con sus propios módulos).

## Cuando CeroFiao esté en Google Play

En el panel, «Botón de descarga» › «En Google Play», pega el enlace de la ficha y guarda. Todos los botones de la página pasan a llevar a ella en un minuto como mucho, sin desplegar nada.

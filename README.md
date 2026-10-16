# Sitio de Schwarck

El sitio de [schwarckdev.com](https://schwarckdev.com): la página del estudio, la de CeroFiao, su política de privacidad, el marcador de Lion Fitness y un panel de administración.

Cada `git push` a `main` se publica solo en Cloudflare.

## Qué hay

| Ruta | Archivo | Qué es |
|---|---|---|
| `/` | `index.html` | El estudio |
| `/cerofiao/` | `cerofiao/index.html` | La app, con novedades y reseñas |
| `/cerofiao/privacidad/` | `cerofiao/privacidad/index.html` | Política de privacidad (la URL que pide Play Console) |
| `/lionfitness/` | `lionfitness/index.html` | Marcador |
| `/admin/` | `admin/index.html` | Panel: novedades y reseñas |
| `/admin/tienda/` | `admin/tienda/index.html` | Estudio de gráficos para la ficha de Google Play |
| `/admin/negocio/` | `admin/negocio/index.html` | Negocio: clientes, leads, facturas, proyectos, tareas, páginas y marketing |
| `/documento/#…` | `documento/index.html` | Lo que abre el cliente con un enlace: ver, pagar o firmar |
| `/api/*` | `worker/index.js` | La API que usan la página y el panel |

Son páginas HTML con CSS y un poco de JavaScript, construidas con Vite. No hay framework.

### La portada del estudio

Técnica y minimalista, con el gradiente del logo como único acento y el vidrio y los teléfonos de CeroFiao. Geist para el texto y Geist Mono para las etiquetas. Las secciones van numeradas de [01] a [07] con mucho aire entre ellas: productos, proceso, principios, cifras, roadmap, preguntas y contacto.

- **Movimiento**: el titular entra palabra a palabra y el teléfono del hero se monta en su marco técnico (esquinas, órbitas, chips que flotan y una etiqueta que se escribe sola); el hero se aleja al bajar. Con ratón, la retícula del fondo tiene un foco que sigue al cursor, las tarjetas se iluminan e inclinan, y los botones principales tienen imán. El proceso es un teléfono fijo cuya pantalla cambia con cada paso; las cifras giran como un cuentakilómetros; el roadmap se dibuja; el logo grande del contacto se traza solo, y el nombre gigante del pie se ilumina bajo el cursor (en el teléfono se llena de color al aparecer). En pantallas anchas, un índice lateral marca la sección en la que estás.
- **Sin JavaScript o con «reducir movimiento»** todo se ve completo y quieto, y las preguntas quedan abiertas.
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

Eso sirve las páginas en `http://localhost:5173`. Las novedades se ven; las reseñas y el panel necesitan la API. Para tenerla, en otra terminal:

```bash
npm run build
```

```bash
npx wrangler dev
```

`wrangler dev` sirve el sitio ya construido con su API en `http://localhost:8787`, con un almacén de datos local. Para entrar al panel en local, copia `.dev.vars.example` como `.dev.vars` y pon una contraseña de prueba.

## El panel

Está en `/admin/`. Sirve para:

- **Novedades**: añadir, editar, ordenar, ocultar o borrar versiones. La primera de la lista sale abierta en la página.
- **Reseñas**: aprobar, rechazar o borrar lo que envía la gente. Nada se publica sin aprobarlo.
- **Botón de descarga**: en qué punto está CeroFiao y qué dicen sus botones (el de arriba, el de la barra, el del menú del teléfono y el del cierre).
  - **Próximamente**: los botones llevan a la sección de descarga y el del cierre pide acceso a la prueba, por correo o con el enlace que pongas.
  - **Prueba abierta**: todos llevan al enlace para unirse.
  - **En Google Play**: todos llevan a la ficha.
  - Cada texto se puede cambiar; vacío, dice lo de su estado. Debajo se ve cómo quedan.
  - Se guarda en KV (`cerofiao:download`), la página lo pide a `/api/download` y lo recuerda en el navegador para no parpadear la próxima vez (`src/cf-download.js`). Sin JavaScript se ven los textos de «Próximamente».

Todo el panel (`/admin/`, `/admin/tienda/` y `/admin/negocio/`) lleva el sistema de diseño de la app CeroFiao: los tokens de `core-designsystem` (fondo gris claro o negro puro, superficies blancas o `#17171A` con borde de 1 px, el cian `#00B8D4`/`#00E5FF`), botones en píldora, chips y segmentos con la opción activa en negro (blanco en oscuro), Anton en las cifras, campos rellenos como en el kit de HeroUI de CeroFiao y la navegación en una cápsula de cristal. Las barras de desplazamiento son una píldora fina, los desplegables abren una lista con ese mismo estilo (en Chrome y Edge; en el resto, la del sistema), la pieza activa de pestañas y segmentos se desliza de una opción a otra (`src/panel-motion.js`) y el cambio de página es una transición suave. Vive en `src/panel.css`, que se carga la última solo en esas páginas y traduce a esos valores los tokens que ya usan sus estilos: la web pública y la página que abre el cliente no cambian. La letra es One UI Sans si está instalada en el equipo; si no, Inter.

### Ponerle contraseña (una sola vez)

La contraseña no está en el repositorio. Se define en Cloudflare:

1. Workers y Pages › `webschwarckdev` › Settings › Variables and Secrets.
2. Añade un **secreto** llamado `ADMIN_PASSWORD`, de al menos 10 caracteres.
3. Guarda. A los pocos segundos `/admin/` deja entrar con ella.

Mientras no exista, el panel muestra estas mismas instrucciones y nadie puede entrar.

### Gráficos para Google Play

En `/admin/tienda/` se componen las imágenes de la ficha con las capturas de la app y se descargan en la medida que pide Play Console:

- **Capturas de teléfono**: 1080 × 1920 px (9:16). Play admite de 2 a 8.
- **Gráfico de funciones**: 1024 × 500 px.

Hay varias plantillas, fondos, adornos y letras; «Ideas» enseña el mismo contenido en otros estilos y «Proponer una serie» arma las ocho capturas con el estilo elegido. «Descargar todo» entrega un `.zip` con la serie y el gráfico de funciones.

Los archivos salen en PNG de 24 bits sin transparencia (Play rechaza los PNG con canal alfa) o en JPEG. Todo se dibuja en el navegador: no se sube nada y no hace falta contraseña. El trabajo se guarda en ese navegador; las capturas subidas a mano solo duran lo que dure la pestaña.

- `src/store-render.js`: las plantillas. Cada una es una función que pinta en un `<canvas>`; para añadir otra basta sumarla a `PHONE_TEMPLATES` o `FEATURE_TEMPLATES`.
- `src/store-export.js`: escribe el PNG, el JPEG y el `.zip`.
- `src/store-studio.js`: los controles de la página.

Para añadir una captura nueva, guárdala en `public/img/cerofiao/store/` como `nombre.webp` (1080 px de ancho), `nombre-thumb.webp` (216 px) y, si existe en oscuro, `nombre-dark.webp` y `nombre-dark-thumb.webp`; luego añádela a `LIBRARY` en `src/store-studio.js`.

### Negocio

En `/admin/negocio/` se llevan los clientes y se emiten facturas, cotizaciones y recibos, con la estética de CeroFiao. Entra con la misma contraseña del panel.

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

En un espacio KV de Cloudflare enlazado como `SITE` (lo crea `wrangler deploy` la primera vez). Guarda la lista de novedades, el botón de descarga de CeroFiao, las reseñas y los datos del negocio (cada colección en una clave `crm:*`, también las páginas, los leads y las campañas; cada archivo subido —recibos, fotos de líneas, portadas e imágenes— en `crm:file:*`, cada enlace público en `crm:share:*`, lo que pasa en él en `crm:pub:*` y `crm:sig:*`, y el último número de cada serie de documentos en `crm:seq`). Las reseñas llevan el nombre que escribió la persona, su calificación, el texto y la fecha; no se guarda correo ni dirección IP.

## Cuando CeroFiao esté en Google Play

En el panel, «Botón de descarga» › «En Google Play», pega el enlace de la ficha y guarda. Todos los botones de la página pasan a llevar a ella en un minuto como mucho, sin desplegar nada.

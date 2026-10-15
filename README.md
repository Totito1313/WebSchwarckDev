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
| `/admin/negocio/` | `admin/negocio/index.html` | Negocio: clientes, catálogo, facturas, cotizaciones y cobros |
| `/documento/#…` | `documento/index.html` | Lo que abre el cliente con un enlace: ver, pagar o firmar |
| `/api/*` | `worker/index.js` | La API que usan la página y el panel |

Son páginas HTML con CSS y un poco de JavaScript, construidas con Vite. No hay framework.

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
- **Clientes y catálogo**: los datos del cliente y los servicios con su precio se rellenan solos en cada documento. Un documento guarda su propia copia: editar un cliente no cambia lo ya emitido.

- **Proyectos**: cada uno es de un cliente. El listado cuenta activos, pendientes y completados; la ficha tiene seis cifras (presupuesto restante, ganado, facturado, cobrado, horas y tareas), etapas que se completan en orden (Arranque → En curso → Revisión → Entregado, editables) y sus documentos. En el editor, el chip «Proyecto» enlaza una factura o cotización a un proyecto.
- **Tareas**: tablero (Solicitud, Por hacer, En curso, Revisión, Hecho) con arrastrar y soltar, o lista. Cada tarea tiene prioridad, fechas, valor fijo o tarifa por hora, checklist, comentarios y sus horas. En `#/tareas` están las de todos los proyectos.
- **Horas**: el temporizador del riel (uno a la vez; vive en los datos, así que sobrevive a recargar) o el registro a mano. La tarifa sale de la entrada, la tarea, el proyecto o Ajustes, en ese orden. «Facturar horas» crea una factura con lo pendiente, agrupado por tarea, por día o por entrada, y lo marca como facturado; si esa factura se borra o se anula, las horas vuelven a quedar pendientes.

Ajustes también tiene «Descargar copia», que baja todo en un JSON.

- `src/negocio.js`: entrada, rutas y riel.
- `src/negocio-core.js`: datos, fila de guardado, cálculos y piezas de interfaz.
- `src/negocio-views.js`: listados, clientes, catálogo y ajustes.
- `src/negocio-doc.js`: el editor de documentos.
- `src/negocio-work.js`: proyectos, tareas y horas: cuentas, temporizador y facturar horas.
- `src/negocio-projects.js`, `src/negocio-tasks.js`, `src/negocio-time.js`: sus pantallas; estilos en `src/negocio-trabajo.css`.
- `src/cf-tokens.css`: los colores de CeroFiao, compartidos con su página.

### Gastos e inicio

- **Inicio** (la portada del negocio): lo cobrado, lo gastado y lo que falta por cobrar en el periodo elegido, comparado con el tramo anterior; el beneficio; un gráfico de entradas y salidas de los últimos 12 meses; lo último que pasó; las facturas por cobrar y los últimos gastos. Mientras falte algo por configurar enseña unos «Primeros pasos».
- **Gastos**: cada gasto se apunta en una ventana (concepto, importe, moneda, fecha, categoría, proveedor, forma de pago, notas y recibo). Si no está en la moneda principal pide la tasa del día del pago (BCV, paralelo…), y con ella se pasa a la moneda principal para siempre.
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

El panel se entera de aperturas y firmas al volver a su pestaña.

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

Cada publicación lleva título, marca, fecha y hora, formato, categoría, rol en el embudo, estado, responsable, imagen o color de portada, guion visual, copy de Instagram, hashtags y copy de Facebook. El copy de Instagram puede empezar desde una plantilla (AIDA, PAS o lanzamiento) y el de Facebook se adapta desde él con un clic: quita el bloque de hashtags y pone el enlace de la marca donde decía «link en la bio».

- `src/negocio-contenido.js`: marcas, publicaciones, plantillas y el formulario.
- `src/negocio-calendario.js`: el calendario y el tablero.
- `src/negocio-marketing.js`: la página, las copias, el feed y las marcas.
- `src/negocio-marketing.css`: sus estilos.

### Dónde se guardan los datos

En un espacio KV de Cloudflare enlazado como `SITE` (lo crea `wrangler deploy` la primera vez). Guarda la lista de novedades, las reseñas y los datos del negocio (cada colección en una clave `crm:*`, cada recibo en `crm:file:*`, cada enlace público en `crm:share:*`, y lo que pasa en él en `crm:pub:*` y `crm:sig:*`). Las reseñas llevan el nombre que escribió la persona, su calificación, el texto y la fecha; no se guarda correo ni dirección IP.

## Cuando CeroFiao esté en Google Play

En `src/cerofiao.js`, pega la URL de la ficha en `PLAY_URL`. Todos los botones pasan de «Próximamente» a «Descargar».

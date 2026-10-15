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

Ajustes también tiene «Descargar copia», que baja todo en un JSON.

- `src/negocio.js`: entrada, rutas y riel.
- `src/negocio-core.js`: datos, fila de guardado, cálculos y piezas de interfaz.
- `src/negocio-views.js`: listados, clientes, catálogo y ajustes.
- `src/negocio-doc.js`: el editor de documentos.
- `src/cf-tokens.css`: los colores de CeroFiao, compartidos con su página.

### Dónde se guardan los datos

En un espacio KV de Cloudflare enlazado como `SITE` (lo crea `wrangler deploy` la primera vez). Guarda la lista de novedades, las reseñas y los datos del negocio (cada colección en una clave `crm:*`). Las reseñas llevan el nombre que escribió la persona, su calificación, el texto y la fecha; no se guarda correo ni dirección IP.

## Cuando CeroFiao esté en Google Play

En `src/cerofiao.js`, pega la URL de la ficha en `PLAY_URL`. Todos los botones pasan de «Próximamente» a «Descargar».

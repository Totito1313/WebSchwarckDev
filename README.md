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
| `/api/*` | `worker/index.js` | La API que usan la página y el panel |

Son páginas HTML con CSS y un poco de JavaScript, construidas con Vite. No hay framework.

- `src/motion.js`: revelados y animaciones ligadas al scroll. Sin JavaScript, o si la persona pidió menos movimiento, las páginas quedan completas y quietas.
- `src/theme.js`: tema claro u oscuro. Sin elección guardada sigue al sistema.
- `data/changelog.json`: las novedades de CeroFiao tal como salen sin panel. Vite las pinta en la página al construir.
- `public/img/cerofiao/`: capturas reales de la app, en claro y en oscuro (`-dark`).

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

### Dónde se guardan los datos

En un espacio KV de Cloudflare enlazado como `SITE` (lo crea `wrangler deploy` la primera vez). Guarda la lista de novedades y las reseñas. Las reseñas llevan el nombre que escribió la persona, su calificación, el texto y la fecha; no se guarda correo ni dirección IP.

## Cuando CeroFiao esté en Google Play

En `src/cerofiao.js`, pega la URL de la ficha en `PLAY_URL`. Todos los botones pasan de «Próximamente» a «Descargar».

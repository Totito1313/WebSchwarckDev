# Negocio: análisis de la interfaz (octubre de 2026)

Revisión de `/admin/negocio/` en escritorio y en el teléfono, en claro y en oscuro, con datos reales del panel local. Qué funciona, qué falla, qué se cambió ya y qué conviene hacer después.

## Lo que ya está bien

- **Un solo sistema visual.** Los tokens de CeroFiao (`panel.css`) se aplican a todo: superficies con borde de 1 px, píldoras, Anton en las cifras, segmentos negros. No hay pantallas que parezcan de otra app.
- **Movimiento con intención.** El cambio de página es una transición de vista con el riel quieto; las pestañas y segmentos tienen una pieza que se desliza; las ventanas suben al abrirse; las barras de progreso crecen.
- **Respeta «reducir movimiento»** en todas las animaciones.
- **Guardado invisible**: la fila de guardado, los conflictos entre dispositivos y los avisos de rechazo están muy bien resueltos y no estorban.

## Lo que fallaba

| # | Problema | Dónde | Gravedad |
|---|---|---|---|
| 1 | **El riel del teléfono escondía 13 de sus 19 botones.** Se desplaza de lado, pero nada lo indica: Facturas, Leads, Clientes, Marketing o Ajustes eran casi imposibles de encontrar. | Teléfono | Alta |
| 2 | **Con 18 secciones no había forma rápida de saltar** a un cliente, una factura o una tarea concreta: siempre lista → buscar → abrir. | Todo | Alta |
| 3 | Las cifras de las tarjetas aparecían de golpe; el ojo no sabe dónde mirar al entrar. | Inicio y listados | Media |
| 4 | Las filas y tarjetas entraban todas a la vez: la página «salta» en vez de construirse. | Listados | Media |
| 5 | Los botones no respondían al pulsar (sin hundirse), en el teléfono parecía que no habían recibido el toque. | Todo | Media |
| 6 | Las ventanas se cerraban de golpe aunque se abrían con animación. | Diálogos | Baja |
| 7 | Los avisos (toast) eran solo texto: no distinguían a simple vista un éxito de un error. | Todo | Baja |
| 8 | «Cargando…» en texto plano mientras llegan los datos. | Entrada | Baja |
| 9 | La sección activa del riel cambiaba de golpe, a diferencia de las pestañas. | Riel | Baja |

## Lo que se cambió

- **Buscador de todo (Ctrl+K / ⌘K, o la lupa del riel)** — `src/negocio-cmdk.js`. Va a cualquier sección, crea cualquier cosa (las mismas acciones del «+») y abre clientes, proyectos, tareas (por título o por clave `WEB-12`), documentos (por número `FAC-2026-0001`), páginas y leads. Ignora acentos, ordena primero lo que empieza por lo escrito, recuerda lo último abierto y se maneja entero con el teclado.
- **Riel del teléfono** — el «+» queda fijo a la izquierda, la sección activa se centra sola y los bordes se desvanecen cuando queda algo por ver a ese lado.
- **Pieza deslizante en el riel** — viaja hasta la sección activa, igual que en las pestañas.
- **Cifras que cuentan** — los KPI y el beneficio de Inicio cuentan hasta su valor la primera vez que se abre la página (respetando el formato `1.000,00`); al repintar por datos nuevos no se repite.
- **Entrada escalonada** — KPI, filas, tarjetas y columnas del tablero aparecen una tras otra (solo las primeras 15: lo de abajo no espera).
- **Respuesta al tocar** — píldoras, iconos, chips y botones del riel se hunden un poco al pulsarlos.
- **Ventanas que se van** con la misma suavidad con la que llegan.
- **Avisos con icono** (✓ en verde o ! en los errores) que llegan con un pequeño rebote.
- **Carga** con el logo respirando y una barra que corre.

Todo vive en `src/negocio-fx.js` y `src/negocio-fx.css`; la única pieza tocada del núcleo es el cierre de `dialog()` en `src/negocio-core.js`.

## Siguientes pasos recomendados

1. **Agrupar el riel en escritorio** (Trabajo · Dinero · Crecimiento · Clientes) con un separador fino y la etiqueta al pasar: 19 iconos seguidos cuestan de aprender.
2. **Inicio con «Para hoy»** en lo alto: tareas que vencen, seguimientos de leads, cobros atrasados y lo nuevo del portal de clientes, en una sola lista accionable.
3. **Deshacer en los avisos** («Tarea borrada · Deshacer») en lugar de confirmar antes de borrar cosas pequeñas.
4. **Mini-gráficas en los KPI** (los últimos 6 meses como una línea de 40 px) para leer la tendencia sin abrir nada.
5. **Atajos de teclado** visibles en el buscador: `N` nueva tarea, `F` nueva factura, `G` luego `T` para ir a Tareas.
6. **Modo compacto** en las listas largas (facturas, horas) para ver el doble de filas en escritorio.

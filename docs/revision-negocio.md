# Revisión del administrador de negocios

Octubre de 2026. Alcance: `/admin/negocio` completo y su parte del Worker (`/api/admin/crm*`, los enlaces públicos `/api/public/doc/*` y la página `/documento/`). La tienda queda fuera, como se pidió.

## Resumen

El panel está bien construido. No hay agujeros de seguridad: la sesión va firmada y solo viaja a `/api/admin`, todo lo que cambia algo exige el mismo origen, los enlaces públicos usan tokens largos y contraseñas resumidas, y ningún dato guardado llega al HTML sin escaparse (solo los iconos fijos usan `innerHTML`, y los enlaces pasan por `safeLink`).

Los problemas reales estaban en tres sitios, y se corrigieron todos los graves:

1. **Guardado**: un solo cambio que el servidor rechazara (una página demasiado grande, por ejemplo) bloqueaba para siempre todo lo que viniera después, sin que se notara más que un aviso de error.
2. **Varios dispositivos**: el panel cargaba los datos una vez y nunca más. Una pestaña abierta todo el día en el portátil podía borrar, sin avisar, un pago registrado desde el teléfono.
3. **Documentos firmados y dinero**: se podía cambiar el tipo de una cotización ya firmada, convertir dos veces la misma cotización en factura, cambiar la moneda de una factura con pagos, registrar un pago con un cero de más sin aviso, y firmar desde el enlace una cotización anulada.

En total: 28 problemas confirmados leyendo el código, 26 corregidos y 2 anotados para más adelante. Lo corregido se probó en local contra el Worker.

## Corregido

### Graves

- **Un cambio rechazado bloqueaba el guardado.** Ahora, si el servidor rechaza un lote, los siguientes se parten por la mitad hasta dar con el cambio culpable. Ese cambio se aparta con un aviso que dice cuál fue («No se guardó la página «X»: pesa demasiado») y lo demás se sigue guardando. Probado: tras rechazar una página de 190 KB, la siguiente página se guardó bien. `src/negocio-core.js:229`
- **Una pestaña vieja pisaba lo hecho en otro dispositivo.**
  - Al volver a la pestaña tras un rato (como mucho una vez cada dos minutos), el panel vuelve a leerlo todo si no hay nada pendiente. Antes solo miraba los enlaces públicos. `src/negocio-core.js:76`, `src/negocio.js:254`
  - Además, cada guardado de un documento lleva la versión de la que partió. Si en el servidor hay una más nueva, no la pisa: devuelve esa, el panel la carga y avisa. Probado con una edición vieja contra una nueva. `worker/index.js:420`, `src/negocio-core.js:185`
- **Mirar los enlaces podía dejar el panel sin cargar.** Cada vuelta a la pestaña (cada 20 s como mínimo, al enfocar y al cambiar de pestaña) hacía un `list` de KV, y el plan gratuito da unos 1.000 al día. Si se agotaban, `/api/admin/crm` devolvía error 500 y el panel no abría. Ahora:
  - Si KV no deja listar, el panel carga igual y se queda con lo que tenía. `worker/index.js:507`
  - Solo se lee al volver a la pestaña, no al enfocarla, y como mucho una vez cada dos minutos.
- **Cotización firmada convertible en «factura».** El botón de tipo seguía activo en lo firmado. El servidor descartaba el cambio sin decirlo y el panel enseñaba algo distinto de lo guardado. Ahora:
  - En lo firmado el tipo no se ofrece. `src/negocio-doc.js:788`
  - Si el cliente firma mientras el documento está abierto, el servidor marca el guardado como bloqueado y el panel carga la versión firmada y avisa.
- **Firmar algo que ya no vale.** El enlace dejaba aceptar una cotización anulada o marcada como rechazada, y una factura anulada seguía pidiendo el pago con su botón y su QR. Ahora:
  - El servidor rechaza la firma de lo anulado o rechazado. `worker/index.js:630`
  - La página del cliente lo enseña como «Anulada» o «Ya no está vigente», sin firma ni pago. `src/documento.js:229`
  - Las facturas pagadas tampoco enseñan el QR.

### Medios

- **Vencimiento en UTC.** El servidor comparaba la validez con la fecha UTC, y la página con la local. En Venezuela, desde las 8 de la noche del último día la página dejaba firmar y el servidor decía «ya venció». Ahora los dos usan la fecha de Venezuela. `worker/index.js:162`
- **Números repetidos.** El siguiente número era «el más alto que existe + 1». Al borrar la última factura o un pago con recibo, su número volvía a usarse aunque ya se hubiera enviado. Ahora el último número de cada serie queda guardado en `crm:seq` y nunca baja. Probado: se borró `FAC-2026-0004` y la siguiente salió `0005`. `worker/index.js:355`
- **Convertir dos veces en factura.** «Convertir en factura» seguía en el menú de una cotización ya convertida y creaba otra factura, dejando la primera desligada. Ahora, si ya tiene factura, el botón es «Ver factura». `src/negocio-doc.js:733`
- **Moneda de una factura con pagos.** Se podía cambiar, y los pagos pasaban a leerse en la moneda nueva. Ahora está bloqueada, con un candado, una vez hay pagos. `src/negocio-doc.js:833`
- **Pago mayor que el saldo.** Se aceptaba sin aviso: 5.000 en vez de 500 dejaba la factura pagada e inflaba lo cobrado. Ahora pide confirmación diciendo cuánto sobra. `src/negocio-doc.js:1064`
- **Fecha de la tasa.** Recibos, duplicados y conversiones copiaban la tasa con la fecha del documento nuevo: una tasa vieja parecía la del día. Ahora la tasa guarda su propia fecha y es la que se imprime. `src/negocio-doc.js:480`
- **Firma dibujada que se borraba en el móvil.** Abrir o cerrar el teclado (al escribir el nombre) disparaba un `resize` que vaciaba el lienzo. Ahora solo se rehace si cambia el ancho, y conserva lo dibujado. `src/documento.js:102`
- **Gastos tras cambiar la moneda principal.** La tasa de cada gasto se escribió frente a la moneda principal de entonces, pero se aplicaba frente a la actual, y los informes viejos salían mal. Ahora el gasto recuerda esa moneda; si ya no coincide, cuenta como «sin tasa» en vez de convertirse mal. Afecta a los gastos nuevos: los viejos se suponen en la moneda actual. `src/negocio-gastos.js:75`
- **La tasa de un gasto perdía decimales al editarlo.** Se mostraba redondeada a dos decimales y así se volvía a guardar. Ahora se muestra completa.
- **Categoría archivada.** Al editar un gasto con categoría archivada, el formulario la cambiaba sola por la primera de la lista (y también la del proveedor). Ahora aparece como «(archivada)» y se conserva. `src/negocio-gastos.js:245`
- **Cobros con la tasa de la factura, no la del día del pago.** Un pago en bolívares semanas después de la factura se pasaba a la moneda principal con la tasa de la factura. Ahora el formulario de pago pide la tasa del día (rellenada con la de la factura) y cada pago la guarda; Inicio, Facturas, Clientes y Proyectos la usan. Los pagos de antes siguen como estaban. `src/negocio-core.js:436`
- **Inicio contaba como 0 los cobros sin equivalencia.** Ahora la tarjeta «Cobrado» dice cuántos quedaron fuera, como ya hacía «Gastado». `src/negocio-inicio.js:31`
- **Texto de una página perdido al cerrar la pestaña.** Las páginas guardan a los 2 s. El aviso de «cambios sin guardar» miraba antes de que entraran en la fila, así que cerrar justo después de escribir los perdía. Ahora los editores vacían su espera antes de esa comprobación, y todo se guarda al momento al dejar la pestaña (en el teléfono el navegador puede cerrarla sin avisar). `src/negocio.js:228`
- **Autoguardado del editor de documentos.** Guardaba tras cada pausa de 0,8 s, y cada guardado reescribe la colección entera en KV. Ahora espera 1,5 s, y al dejar la pestaña guarda enseguida.

### Leves

- **Firma al pie distinta.** El editor usaba la firma de Ajustes y la hoja del cliente el nombre del negocio. Ahora la firma va en el propio documento y las dos dicen lo mismo.
- **«Abrir» desde el panel contaba como visita del cliente** y pasaba la cotización a «Vista». Ya no cuenta.
- **Leads repetidos como clientes.** Convertir un lead cuyo correo ya era de un cliente creaba un cliente duplicado. Ahora lo enlaza con el existente. `src/negocio-leads.js:203`
- **«30 días» y «Este año» en Facturas** no medían lo mismo que en Inicio y Gastos: eran 31 días y contaban fechas futuras. Ahora usan los mismos tramos. `src/negocio-views.js:68`
- **Orden de las categorías.** Al reordenarlas solo se guardaban dos y quedaban órdenes repetidos. Ahora se guardan todas las que cambian.
- **Borrar un proyecto** dejaba sus páginas apuntando a un proyecto inexistente. Ahora quedan sin proyecto, como sus documentos. `src/negocio-work.js:187`
- **Un documento incompleto rompía la navegación.** La pantalla anterior se quedaba congelada. Ahora el editor completa lo que falte, y cualquier página que falle enseña «No se pudo abrir esto» con un botón para volver. `src/negocio.js:168`

## Pendiente (no se tocó)

- **Los borradores gastan número.** Un documento recibe número en cuanto se guarda la primera vez. Numerar al enviarlo es posible, pero cambia el flujo.
- **Crecimiento.** Cada colección vive en una sola clave de KV y cada guardado la reescribe entera. Con miles de documentos convendrá pasar los documentos a D1 o a una clave por documento. Hoy no es un problema.

## Lo que está bien hecho

- La seguridad del Worker: sesión con HMAC y caducidad, cookie `HttpOnly`, `Secure` y `SameSite=Strict` limitada a `/api/admin`, comprobación de origen, límites de tamaño antes de leer el cuerpo, frenos de ráfagas y contraseñas de enlace con PBKDF2.
- Lo que ve el cliente es una lista cerrada de campos (`publicView`): nada de notas internas ni identificadores. Las imágenes se sirven con una llave por archivo.
- El texto con enlaces nunca usa `innerHTML`, y `safeLink` impide los `javascript:`.
- Los diálogos son modales nativos: el foco se queda dentro y Escape los cierra.
- Las fechas del panel se calculan en hora local, sin el clásico desfase de `toISOString()`.
- Borrar una tarea limpia sus subtareas, sus enlaces y sus horas con cuidado.

## Cómo se probó

En local, con `wrangler dev` y una contraseña generada para la prueba:

- **Servidor**:
  - Conflicto entre dos versiones de una factura.
  - Numeración tras borrar.
  - Firma de una cotización anulada (409), vencida (410) y vigente (200).
  - Edición de lo firmado (bloqueada).
  - Visita propia sin contar.
- **Interfaz**:
  - Pago mayor que el saldo (pide confirmación).
  - Moneda bloqueada con pagos.
  - Cotización firmada sin botón de tipo.
  - Factura cambiada «desde el teléfono» mientras estaba abierta (carga la nueva y avisa).
  - Página rechazada por tamaño sin bloquear las siguientes.
  - Las once secciones del panel abren sin errores.

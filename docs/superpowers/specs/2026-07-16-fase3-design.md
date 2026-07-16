# Fase 3 — Generar documento de Gastos (PDF réplica + Excel 606 + perfil de empresa)

**Fecha:** 2026-07-16 · **Estado:** aprobado por Ari ("ok")

## Decisiones tomadas con Ari (2026-07-16)

- **606 básico:** el Excel sale con lo capturado (RNC, tipo id, NCF, fecha, montos, ITBIS);
  la columna de tipo de bienes/servicios va VACÍA — TCB la completa. Sin campo nuevo en la app.
- **Selector de mes en Gastos:** flechas ‹ › para navegar meses existentes en Drive; lista,
  panel y Generar operan sobre el mes elegido.
- **Destino:** PDF y Excel se SUBEN a la carpeta del mes en Drive Y se abre la hoja de
  compartir de iOS con ambos.
- **No validadas:** aviso "Hay N facturas sin validar" → «Generar solo con las completas» o
  cancelar. **Duplicadas siempre excluidas** (regla previa).
- Enfoque: **pdf-lib + SheetJS vendorizados**, todo en el teléfono (render-canvas y servidor
  descartados).
- OneDrive: fuera de esta fase (otra versión de la app).

## Geometría de la plantilla (extraída del PPTX real, px @96dpi; carta horizontal 1056×816)

- **Portada (layout2):** título "Facturas NCF | {Mes} {Año}" en (214,333) caja 629×150
  (centrado); logo de la empresa en (76,689) 231×78.
- **Páginas de contenido (layout1):** logo (64,53) 225×76; membrete texto 10pt en (329,60)
  caja 435×67, 3 líneas: «{RAZÓN} | RNC: {RNC} |», «{Ubicación}», «Tel: {tel} | Correo:
  {correo}». Tres casillas de factura en x=64/396/727, y=167, caja 264×528; etiqueta
  «RD$ {total}» debajo en y=710 caja 264×17 (centrada).
- **Página con 2 facturas:** casillas centradas en x=213/544 (misma y y tamaño).
- **Factura larga** (diapositiva 9): la MISMA imagen dos veces en columnas contiguas con
  recortes: izquierda ≈ 0–48% superior, derecha ≈ 50–100% inferior. Regla en la app: una
  imagen con proporción alto/ancho > 3 se considera larga y ocupa 2 casillas con ese split
  (etiqueta RD$ bajo la segunda casilla).
- **Pie de página (todas):** «© TCB — Tax Consulting Business» centrado abajo (nota: el
  PPTX no lo trae; decisión previa aprobada de la spec original de la app).
- Conversión a puntos PDF: pt = px × 0.75 (página 792×612 pt). El eje y del PDF crece hacia
  arriba: y_pdf = 612 − (y_px×0.75) − alto_pt.

## Sección 1 — Perfil de empresa (`src/empresa.js` + tarjeta en Ajustes)

- Tarjeta "Empresa (membrete del documento)" en Ajustes, antes de «Otros ajustes»: logo
  (input file → base64, máx ~200 KB reescalado a 460px de ancho), razón social, RNC,
  ubicación, teléfono, correo.
- Persistencia: settings local (`tcb:empresa`) y `_empresa.json` en la carpeta raíz de
  Drive (escrito al cambiar, leído en `postConexion` si lo local está vacío) — cualquier
  instalación conectada a la misma carpeta hereda el membrete.
- `empresaCompleta(e)` (puro): razón social y RNC son lo mínimo para generar; sin eso el
  botón Generar avisa "Configura la Empresa en Ajustes".
- El repo público usa ejemplos genéricos (CLIENTE SRL, RNC 000-0000-00) en placeholder.

## Sección 2 — Selector de mes en Gastos

- `#mes-nombre` gana flechas `‹ ›`. Estado `mesVisto` ('AAAA-MM', default mes del
  dispositivo). ‹ › navegan SOLO entre carpetas de mes existentes en Drive (listado de la
  raíz filtrado por `/^\d{4}-\d{2}_/`, ordenado; el mes actual siempre aparece aunque no
  exista aún). `refrescarGastos()` usa `mesVisto`; el panel de revisión y Generar heredan
  el contexto (`window.__gastosMes` ya lleva mesId).
- Helpers puros con test: `mesesDeCarpetas(nombres, mesActualISO) → ['2025-06', …]`
  (únicos, ordenados, incluye actual), y `nombreCarpetaMes` existente para el display.

## Sección 3 — Excel 606 (`src/f606.js`)

- `filas606(facturas, rncEmpresa, periodo)` (puro, testeable): filtra completas no
  duplicadas; una fila por factura: RNC/Cédula del proveedor, Tipo Id (1 si 9 dígitos RNC,
  2 si 11 cédula), tipo bienes/servicios VACÍO, NCF, NCF modificado vacío, fecha
  comprobante AAAAMM + día, monto facturado (subtotal; si falta, total−itbis o total),
  ITBIS facturado. Encabezado: razón social, RNC, «Formato 606 — {Mes} {Año}», período
  AAAAMM.
- `generarXLSX606(filas, empresa, periodo)` (browser): SheetJS `aoa_to_sheet` →
  `XLSX.write(..., {type:'array'})` → Blob xlsx.

## Sección 4 — PDF réplica (`src/pdfgastos.js`)

- `paginar(facturas)` (puro, testeable): recibe [{archivo, total, ratio}] y devuelve
  páginas de casillas: normales ocupan 1 casilla; largas (ratio>3) 2 casillas contiguas
  (si solo queda 1 en la página, pasa completa a la siguiente); páginas de 3 casillas en
  x=64/396/727; una página con exactamente 2 ocupadas usa x=213/544; con 1, centrada
  (x=396).
- `generarPDF(paginas, empresa, mesTexto, imagenes)` (browser, pdf-lib): portada + páginas
  con membrete/etiquetas/pie según la geometría de arriba; Helvetica y Helvetica-Bold
  (fuentes estándar, soportan tildes y ©); imágenes JPEG incrustadas ajustadas a la casilla
  conservando proporción (centradas); las largas se parten con canvas (dos JPEG: 0–48% y
  50–100% del alto) ANTES de incrustar.
- Las imágenes se descargan de Drive (reutiliza `thumbCache`); progreso visible.

## Sección 5 — Flujo del botón Generar

- Botón `#btn-generar` «Generar documento de Gastos» al final de la lista del mes en
  Gastos. Requiere conexión (para leer imágenes/subir) y empresa mínima.
- Pasos: (1) lee índice del mes elegido; (2) si hay pendientes/incompletas →
  `confirm('Hay N facturas sin validar. ¿Generar solo con las completas?')`; duplicadas
  fuera siempre; 0 completas → toast y aborta; (3) descarga imágenes con progreso en la
  barra (`#lote-bar` reutilizada: «Generando — descargando 3 de 12…»); (4) genera PDF y
  XLSX; (5) sube ambos a la carpeta del mes (`Gastos_{Mes}_{Año}.pdf`,
  `606_{Mes}_{Año}.xlsx`; si ya existen, se reemplazan vía guardado por nombre); (6)
  `navigator.share({files})` con ambos; si share falla/no soportado → toast «Guardados en
  Drive ✓» (ya están a salvo).
- Sin conexión: no corre (aviso «Conecta Drive para generar»); las imágenes viven en Drive.

## Módulos y vendor

| Pieza | Detalle |
|---|---|
| `vendor/pdf-lib/pdf-lib.min.js` | UMD ~600 KB (jsdelivr pdf-lib@1.17.1) |
| `vendor/sheetjs/xlsx.full.min.js` | UMD ~900 KB (jsdelivr xlsx@0.18.5) |
| `src/empresa.js` | **nuevo** — perfil + sync `_empresa.json` |
| `src/f606.js` | **nuevo** — filas606 (puro) + generarXLSX606 |
| `src/pdfgastos.js` | **nuevo** — paginar (puro) + generarPDF |
| `src/naming.js` | `mesesDeCarpetas` (puro) |
| `src/main.js` | selector de mes, tarjeta Empresa, botón/flujo Generar |
| `index.html` / `styles.css` | tarjeta Empresa, flechas de mes, botón Generar |
| `sw.js` | `VERSION='fase3-v1'`; pdf-lib y sheetjs con carga perezosa + runtime cache (patrón vendor grande) |

Ambas librerías se cargan perezosas (script tag al primer uso, como ONNX) — no van al
precache; se añade `vendor/(pdf-lib|sheetjs)` al runtime-cache del SW.

## Errores y casos borde

- Sin empresa configurada → aviso y salto a Ajustes. Sin facturas completas → aborta.
- Falla la descarga de UNA imagen → esa factura sale del PDF con toast «No se pudo leer
  {archivo}; generado sin ella» (el 606 sí la incluye: sus datos están en el índice).
- `navigator.share` con archivos no disponible (Safari viejo/escritorio) → los archivos ya
  quedaron en Drive; toast lo dice.
- Subida del PDF/XLSX con nombre existente: se busca por nombre y se actualiza (PATCH),
  no se duplica.
- Mes sin `_gastos.json` → «Este mes no tiene facturas registradas».

## Pruebas

- Node: `paginar` (3 por página, 2 centradas, 1 centrada, larga en 2 casillas y salto de
  página), `filas606` (tipo id, fecha AAAAMM, montos con respaldo, excluye duplicadas e
  incompletas), `mesesDeCarpetas`, `empresaCompleta`.
- Navegador: generar PDF real con imágenes sintéticas (verificar cabecera %PDF, nº de
  páginas con pdf-lib), XLSX real (cabecera PK zip), flujo del aviso de no validadas.
- Campo (Ari): generar Julio 2026 con sus facturas reales; comparar lado a lado con el PDF
  de Junio 2025 de referencia; abrir el 606 en Excel.

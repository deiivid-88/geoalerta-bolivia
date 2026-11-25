# Fase 1 — Auditoría del proyecto existente (TERRAMINA → GeoAlerta)

Fecha de auditoría: 2026-11-25
Proyecto auditado: `scratch/terramina-bolivia` (commit `f1bb312`)

## 1. Arquitectura encontrada

| Aspecto | Estado |
|---|---|
| Tipo | SPA de prototipo UX/UI, solo frontend |
| Stack | React 18.2, TypeScript 4.9, Vite 2.9, Tailwind 3.2, Leaflet 1.9.4, lucide-react |
| Navegación | Estado `currentPage` en `App.tsx` (sin URLs, el botón "atrás" no funciona, no hay enlaces compartibles) |
| Estado global | `useState` en `App.tsx`, pasado por props a 8 páginas |
| Datos | `src/data/mockData.ts` (8 reportes, 6 observaciones satelitales, 6 registros institucionales, 3 entradas de auditoría) y `src/data/boliviaGeo.ts` (9 departamentos, 23 municipios, 3 áreas protegidas, 3 polígonos mineros y 3 ríos, todos aproximados) |
| Persistencia | Solo el **borrador** del asistente de denuncia en `localStorage`. Todo lo demás vive en memoria y **se pierde al recargar** |
| Backend / BD | **No existe.** No hay llamadas `fetch`, ni API, ni variables de entorno |
| Tests | No existen |
| Lint / formato | No configurados |
| Control de versiones | No existía (se inicializó Git en esta sesión) |

Volumen: ~6.500 líneas de TSX/TS en 23 archivos.

## 2. Funcionalidades existentes

| Módulo | Archivo | Funciona | Solo demostrativo |
|---|---|---|---|
| Inicio / landing ciudadana | `InicioPage.tsx`, `BoliviaOverviewGraphic.tsx` | Navegación, tarjetas | Cifras calculadas sobre mocks |
| Mapa territorial | `MapaTerritorialPage.tsx` | Mapa Leaflet, 7 capas activables, buscador de lugares, filtros por departamento/fuente/fecha, ficha lateral | Todas las capas; filtro de fecha con fecha fija `2026-11-24` |
| Denuncia ciudadana (6 pasos) | `DenunciaWizardPage.tsx`, `LocationPickerMap.tsx` | GPS, selección en mapa, foto (base64), borrador local, modo anónimo/confidencial | El envío solo vive en memoria |
| Seguimiento por código | `SeguimientoPage.tsx` | Búsqueda y línea de tiempo | Sobre datos en memoria |
| Observaciones satelitales | `ObservacionesSatelitalesPage.tsx`, `SatelliteComparator.tsx` | Filtros, comparador antes/después | Las "imágenes" son ilustraciones SVG, no escenas reales |
| Información institucional | `InformacionInstitucionalPage.tsx` | Filtros y fichas | Los registros AJAM/MMM/SERNAP/MMAyA son simulados |
| Panel de análisis | `PanelAnalisisPage.tsx` | KPIs y 4 gráficos (CSS) con filtros | Serie temporal fija Sep–Nov 2026 |
| Panel de administración | `PanelAdminPage.tsx` | Cambiar estado de reportes y de observaciones con historial | Pestaña "usuarios" estática |
| Autenticación | `TechAuthModal.tsx` | — | **Cualquier email/contraseña entra como Administrador** |

## 3. Datos simulados (mockData)

Todo el contenido de negocio es simulado y está marcado como "Demo":
`INITIAL_REPORTS`, `INITIAL_SATELLITE_OBSERVATIONS`, `INITIAL_INSTITUTIONAL_RECORDS`,
`INITIAL_AUDIT_LOG`, `PROTECTED_AREAS_DEMO`, `MINING_RIGHTS_DEMO` y `RIVERS_DEMO`.
Los polígonos departamentales son aproximaciones gruesas, no límites oficiales.

**No existe la entidad "registro minero"** con situación administrativa, tipo de minería,
titular, código de derecho minero ni fuentes documentales, que es el núcleo de GeoAlerta.

## 4. Conexión a base de datos

- Proyecto: ninguna.
- Entorno local: hay **PostgreSQL 17** instalado como servicio Windows (`postgresql-x64-17`,
  puerto 5432, autenticación `scram-sha-256`). **PostGIS no está instalado** (no aparece en
  `share/extension`). No se dispone de credenciales, así que no se ha creado ni modificado
  ninguna base de datos.

## 5. Errores y riesgos detectados

| # | Severidad | Hallazgo |
|---|---|---|
| 1 | Alta | Login falso: cualquier credencial obtiene rol Administrador (`TechAuthModal.tsx`) |
| 2 | Alta | Las denuncias enviadas se pierden al recargar; el código entregado al ciudadano deja de existir |
| 3 | Media | Código de seguimiento `TRM-2026-` + 4 dígitos aleatorios: hay colisiones posibles y no se verifican duplicados |
| 4 | Media | El control de acceso solo oculta páginas en el cliente, sin permisos por acción |
| 5 | Media | Las fotos se guardan como base64 en memoria/`localStorage` (límite ~5 MB, sin validar tipo ni tamaño) |
| 6 | Media | Fecha "hoy" fija (`2026-11-24`) en los filtros del mapa y meses fijos en los gráficos |
| 7 | Baja | Colores fuera de la paleta (sky, indigo, orange, slate, teal y hex sueltos) |
| 8 | Baja | Un único bundle JS de ~446 KB, sin división por página |
| 9 | Baja | Lógica duplicada: el timestamp `now` se repite 3 veces en `App.tsx`, los filtros por departamento y fecha se repiten en mapa y análisis, y el HTML de los marcadores está copiado |
| 10 | Baja | Tiles de `tile.openstreetmap.org` sin política de uso para producción |
| 11 | Info | Dependencias de 2022 con vulnerabilidades conocidas (Vite 2, esbuild y postcss antiguos) |

## 6. Decisiones de evolución

**Se conserva y mejora:**
- El asistente de denuncia (6 pasos, GPS, borrador local, anónimo/confidencial), con estados ampliados a 7.
- La consulta pública de seguimiento por código.
- El mapa Leaflet y sus capas de referencia, al que se añaden los registros mineros con marcadores y polígonos.
- El comparador satelital antes/después.
- Las fichas institucionales, reconvertidas en catálogo de fuentes con estado de integración.
- El panel de análisis y el de administración.
- El historial de cambios, generalizado a todas las entidades.

**Se reemplaza:**
- La navegación por estado, sustituida por un enrutador hash con URLs compartibles (`#/registros/GA-MIN-…`).
- El estado en `App.tsx`, sustituido por una capa de servicios con dos proveedores intercambiables:
  `demo` (localStorage, datos marcados como demostrativos) y `api` (backend REST real).
- El login falso, sustituido por autenticación con 4 roles y permisos por acción.
  En modo `api` la seguridad reside en el backend (bcrypt + JWT).
- La identidad TERRAMINA, sustituida por GeoAlerta con la paleta oficial.

**Se elimina** (justificado):
- `TerraminaLogo.tsx`: la identidad cambia a GeoAlerta.
- La landing ciudadana como página principal: la plataforma pasa a ser de uso institucional.
  El acceso ciudadano se conserva en rutas públicas (`#/denuncia`, `#/seguimiento`).

# GeoAlerta

**Información territorial para actuar a tiempo.**

GeoAlerta es una plataforma de inteligencia territorial para Bolivia. Permite visualizar, analizar, registrar y gestionar información georreferenciada sobre actividades mineras: su ubicación, tipo de actividad, situación administrativa (con respaldo documental) y posibles irregularidades.

Evoluciona el prototipo TERRAMINA. Ver la [auditoría](docs/01-AUDITORIA.md).

| Documento | Contenido |
|---|---|
| [docs/01-AUDITORIA.md](docs/01-AUDITORIA.md) | Estado del proyecto original y decisiones tomadas |
| [docs/02-DISENO.md](docs/02-DISENO.md) | Identidad, navegación y componentes |
| [docs/03-MODELO-DE-DATOS.md](docs/03-MODELO-DE-DATOS.md) | Entidades, reglas y **decisiones de datos pendientes** |
| [docs/04-BASE-DE-DATOS.md](docs/04-BASE-DE-DATOS.md) | Cómo conectar PostgreSQL/PostGIS y qué información se necesita |

## Estructura

```
├─ src/                    Frontend React + TypeScript + Vite + Tailwind + Leaflet
│  ├─ app/                 sesión, almacén de datos, enrutador, notificaciones
│  ├─ components/          kit de interfaz, gráficos, mapa, componentes de registros
│  ├─ domain/              catálogos, permisos, validación, consultas, importación y exportación (lógica pura)
│  ├─ services/            DataProvider: demoProvider (navegador) | httpProvider (API)
│  ├─ pages/               las 10 secciones más denuncia y seguimiento públicos
│  ├─ data/                semilla demostrativa y geografía de referencia
│  └─ types/domain.ts      modelo de dominio
├─ backend/                API FastAPI + PostgreSQL/PostGIS
│  ├─ app/                 routers, esquemas, seguridad, permisos, importadores
│  ├─ db/migrations/       esquema SQL (fuente de verdad)
│  ├─ scripts/             migrar, crear administrador, cargar fuentes, respaldo y restauración
│  └─ tests/
└─ public/brand/           ← colocar aquí el logotipo oficial
```

## Ejecutar

### Modo demostrativo (sin base de datos)

```bash
npm install
npm run dev            # http://127.0.0.1:5173
```

Las cuentas de prueba se muestran en la pantalla de acceso (una por rol). Los datos son ficticios, están marcados como DEMO y se guardan solo en ese navegador.

### Modo base de datos central

Ver [docs/04-BASE-DE-DATOS.md](docs/04-BASE-DE-DATOS.md). En resumen: configurar `backend/.env`, ejecutar `scripts.migrate`, `scripts.create_admin` y `uvicorn`, y crear `.env.local` con `VITE_DATA_MODE=api`.

## Pruebas

```bash
npm test                                   # 35 pruebas: dominio, reglas, permisos y renderizado de todas las páginas por rol
npm run build                              # tsc + build de producción
cd backend && .venv\Scripts\python -m pytest   # unitarias, API e integración (esta última requiere TEST_DATABASE_URL)
```

## Roles

| Rol | Puede |
|---|---|
| Administrador | Todo: usuarios, configuración, eliminar, clasificar |
| Analista SIG | Crear y editar registros y coordenadas, importar y exportar, registrar y revisar observaciones, alertas, informes. **No** clasifica ni ve datos de denunciantes |
| Revisor institucional | Revisar denuncias (con datos de contacto), clasificar con respaldo, verificación documental, derivar alertas, bitácora |
| Consulta institucional | Solo lectura de mapas, registros y estadísticas, y descarga de informes |

La matriz completa está en *Administración → Matriz de permisos*. Es idéntica en el frontend y en el backend, y una prueba lo verifica.

## Despliegue (producción)

1. **Frontend:** `npm run build` genera `dist/`, que se sirve como estático (Nginx o IIS). Las rutas usan `#`, así que no requiere reescrituras.
2. **Backend:**
   ```
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
   ```
   Se ejecuta como servicio detrás de un proxy inverso con HTTPS, que publique `/api/` en el mismo dominio que el frontend.
3. **Configuración del backend:**
   - `CORS_ORIGINS` con el dominio real.
   - `JWT_SECRET` y `CONTACT_ENCRYPTION_KEY` únicos. **Si se pierde la clave de cifrado, los contactos guardados dejan de poder leerse:** respáldela aparte.
   - `STORAGE_DIR` fuera del directorio web, incluido en los respaldos.
4. **Mapa base:** `VITE_TILE_URL` debe apuntar a un proveedor con licencia o a un servidor de teselas institucional. Los servidores públicos de OpenStreetMap no admiten uso intensivo.
5. **Respaldos:** programar `backend/scripts/backup.ps1` (Programador de tareas de Windows o cron) y probar `restore.ps1` periódicamente.

## Limitaciones conocidas

- Sin logotipo oficial todavía.
- Ninguna integración institucional está activa: todas figuran como «integración pendiente».
- Los límites departamentales, las áreas protegidas y los ríos son polígonos aproximados de referencia, no cartografía oficial.
- El comparador satelital usa ilustraciones esquemáticas, no imágenes reales. La integración con imágenes (Sentinel Hub, Google Earth Engine u otro) queda pendiente de definir.
- La prueba de integración con PostGIS está escrita, pero no se ha ejecutado porque no hay una base disponible.

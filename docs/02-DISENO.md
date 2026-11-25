# Fase 2 — Diseño

## Identidad

| Token | HEX | Uso en la interfaz |
|---|---|---|
| `navy-900` Azul profundo | `#17364D` | Barra lateral, encabezados, botones primarios |
| `teal-700` Turquesa | `#087F8C` | Enlaces, foco, botones de acción, capas hídricas |
| `gold-500` Oro | `#D5A329` | Indicador de sección activa, prioridades, «presuntamente irregular» |
| `coral-600` Coral | `#C94C4C` | Alertas, riesgos, «ilegal verificada» |
| `ivory-100` Marfil | `#F5F1E8` | Fondo general |

- Las escalas (`50` a `950`) son tintes de esos cinco colores. `ink` es un neutro derivado del azul y se usa para el texto.
- En [`tailwind.config.cjs`](../tailwind.config.cjs) los nombres de color por defecto de Tailwind (`red`, `green`, `sky`…) se redirigen a la paleta, así que ningún componente puede salirse de la identidad.
- **Colores de datos en mapas y gráficos:** `#0A93A1`, `#C9951C`, `#C94C4C`, `#3F6E93` y gris `#8C9BA8`. Son tintes de la paleta validados para daltonismo (ΔE ≥ 10,9). Como el azul y el oro tienen poco contraste o saturación, todos los gráficos llevan leyenda, etiqueta y vista de tabla.

### Logotipo

El logotipo oficial **no se recibió en esta sesión**. [`BrandLogo`](../src/components/BrandLogo.tsx) carga `public/brand/geoalerta-logo.svg` (o `.png`) y su versión inversa. Mientras no existan, muestra solo el texto «GeoAlerta», sin ningún símbolo inventado. Las instrucciones están en `public/brand/README.md`.

## Navegación

Barra lateral fija en escritorio y menú desplegable en tablet y celular. Las 10 secciones se muestran según el rol:

1. Inicio / Dashboard
2. Mapa territorial
3. Registros mineros
4. Denuncias ciudadanas
5. Observaciones satelitales
6. Información institucional
7. Análisis territorial
8. Alertas
9. Informes
10. Administración

Las rutas públicas, sin sesión, son `#/denuncia` y `#/seguimiento/:código`.

Todas las URL se pueden compartir; por ejemplo, `#/registros/GA-MIN-000012` o `#/mapa?sel=record:GA-MIN-000012`.

## Componentes

| Componente | Archivo |
|---|---|
| Kit de interfaz: botones, tarjetas, tabla ordenable y paginada, modal, campos, pestañas | [`src/components/ui.tsx`](../src/components/ui.tsx) |
| Gráficos SVG sin dependencias: barras, barras apiladas, anillo y líneas con tooltip, leyenda y vista de tabla | [`src/components/charts.tsx`](../src/components/charts.tsx) |
| Mapa Leaflet | [`src/components/GeoMap.tsx`](../src/components/GeoMap.tsx) |

En el mapa, cada tipo de elemento tiene una **forma distinta** para no depender solo del color:

- registro: círculo
- denuncia: cuadrado
- observación: rombo (discontinuo si es automatizada)
- alerta: triángulo

## Principios

- **Neutralidad:** nada se marca como ilegal sin una determinación oficial. La ausencia en una base de datos se muestra como «sin determinar» y lo explica.
- **Trazabilidad:** toda clasificación muestra su documento, institución, fecha de consulta, autor e historial.
- **Datos demostrativos visibles:** hay una insignia «DEMO» por registro, un aviso en el dashboard y una marca en los informes.

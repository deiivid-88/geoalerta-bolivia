import type {
  AdminStatus,
  AlertPriority,
  AlertStatus,
  AlertType,
  AuditAction,
  ConfidenceLevel,
  MiningType,
  ObservationOrigin,
  ObservedWhenPreset,
  ReportCategory,
  ReportStatus,
  ReviewState,
  Role,
  SatelliteObservation,
  SatelliteObservationType,
  SourceAvailability,
  VerificationState
} from '../types/domain';

/**
 * Colores de datos (mapas y gráficos): tintes de la paleta GeoAlerta validados para
 * separación en daltonismo (ΔE ≥ 10.9). Siempre se acompañan de etiqueta y leyenda.
 */
export const DATA_COLORS = {
  teal: '#0A93A1',
  gold: '#C9951C',
  coral: '#C94C4C',
  navy: '#3F6E93',
  neutral: '#8C9BA8',
  navyDeep: '#17364D'
} as const;

interface StatusMeta {
  label: string;
  short: string;
  description: string;
  color: string;
  badge: string;
}

export const ADMIN_STATUS: Record<AdminStatus, StatusMeta> = {
  legal: {
    label: 'Legal / Autorizada',
    short: 'Legal',
    description: 'Existe documentación oficial que respalda su situación.',
    color: DATA_COLORS.teal,
    badge: 'bg-teal-50 text-teal-800 border-teal-300'
  },
  ilegal_verificada: {
    label: 'Ilegal verificada',
    short: 'Ilegal verif.',
    description: 'Existe una determinación o registro oficial que confirma la irregularidad.',
    color: DATA_COLORS.coral,
    badge: 'bg-coral-50 text-coral-800 border-coral-300'
  },
  presuntamente_irregular: {
    label: 'Presuntamente irregular',
    short: 'Presunta irreg.',
    description: 'Existen indicios o inconsistencias que requieren investigación.',
    color: DATA_COLORS.gold,
    badge: 'bg-gold-50 text-gold-800 border-gold-400'
  },
  en_proceso: {
    label: 'En proceso',
    short: 'En proceso',
    description: 'Trámite administrativo pendiente o en evaluación.',
    color: DATA_COLORS.navy,
    badge: 'bg-navy-50 text-navy-800 border-navy-300'
  },
  sin_determinar: {
    label: 'Sin determinar',
    short: 'Sin determinar',
    description: 'No existe información suficiente para establecer su situación.',
    color: DATA_COLORS.neutral,
    badge: 'bg-ink-50 text-ink-700 border-ink-300 border-dashed'
  }
};

export const ADMIN_STATUS_ORDER: AdminStatus[] = [
  'legal',
  'en_proceso',
  'presuntamente_irregular',
  'ilegal_verificada',
  'sin_determinar'
];

export const MINING_TYPE: Record<MiningType, { label: string; short: string }> = {
  aurifera: { label: 'Minería aurífera', short: 'Aurífera' },
  aluvial: { label: 'Minería aluvial', short: 'Aluvial' },
  subterranea: { label: 'Minería subterránea', short: 'Subterránea' },
  cielo_abierto: { label: 'Minería a cielo abierto', short: 'Cielo abierto' },
  aridos: { label: 'Extracción de áridos', short: 'Áridos' },
  otro: { label: 'Otro tipo de actividad minera', short: 'Otro' },
  sin_clasificacion: { label: 'Sin clasificación', short: 'Sin clasif.' }
};
export const MINING_TYPE_ORDER = Object.keys(MINING_TYPE) as MiningType[];

export const VERIFICATION_STATE: Record<VerificationState, { label: string; badge: string }> = {
  no_verificado: { label: 'No verificado', badge: 'bg-ink-50 text-ink-600 border-ink-300 border-dashed' },
  en_verificacion: { label: 'En verificación', badge: 'bg-navy-50 text-navy-700 border-navy-300' },
  verificado_documental: { label: 'Verificado documentalmente', badge: 'bg-teal-50 text-teal-800 border-teal-300' },
  verificado_campo: { label: 'Verificado en campo', badge: 'bg-teal-100 text-teal-900 border-teal-400' }
};

export const ROLE: Record<Role, { label: string; description: string }> = {
  administrador: {
    label: 'Administrador',
    description: 'Gestión de usuarios, registros, permisos y configuración general.'
  },
  analista_sig: {
    label: 'Analista SIG',
    description: 'Mapas, análisis territorial, observaciones satelitales e informes.'
  },
  revisor_institucional: {
    label: 'Revisor institucional',
    description: 'Revisión de denuncias, verificación documental, estados y derivación de alertas.'
  },
  consulta_institucional: {
    label: 'Consulta institucional',
    description: 'Visualización de información autorizada, mapas y descarga de informes.'
  }
};

export const REPORT_CATEGORY: Record<
  ReportCategory,
  { label: string; short: string; description: string; badge: string }
> = {
  actividad_minera: {
    label: 'Posible actividad minera',
    short: 'Actividad minera',
    description: 'Maquinaria, excavaciones, dragas, balsas o campamentos nuevos',
    badge: 'bg-gold-100 text-gold-800 border-gold-400'
  },
  contaminacion_agua: {
    label: 'Contaminación del agua',
    short: 'Agua / río',
    description: 'Cambio de color en ríos, lagunas, acequias o agua de consumo',
    badge: 'bg-teal-50 text-teal-800 border-teal-300'
  },
  cambios_territorio: {
    label: 'Cambios en el territorio',
    short: 'Cambio de suelo',
    description: 'Desmonte, apertura de caminos o movimiento inusual de tierra',
    badge: 'bg-navy-50 text-navy-800 border-navy-300'
  },
  afectacion_comunidades: {
    label: 'Afectación a comunidades',
    short: 'Comunidad',
    description: 'Daños a sembradíos, ganado, caminos comunales o viviendas',
    badge: 'bg-coral-50 text-coral-800 border-coral-300'
  },
  otra_ambiental: {
    label: 'Otra situación ambiental',
    short: 'Otra',
    description: 'Ruidos constantes, residuos o cualquier hecho ambiental relevante',
    badge: 'bg-ink-50 text-ink-700 border-ink-300'
  }
};

export const REPORT_STATUS: Record<
  ReportStatus,
  { label: string; order: number; explanation: string; badge: string }
> = {
  recibido: {
    label: 'Recibida',
    order: 1,
    explanation: 'La denuncia ingresó a la plataforma y cuenta con código de seguimiento.',
    badge: 'bg-ink-50 text-ink-700 border-ink-300'
  },
  pendiente_revision: {
    label: 'Pendiente de revisión',
    order: 2,
    explanation: 'Está en fila para la revisión inicial de ubicación y contenido.',
    badge: 'bg-gold-50 text-gold-800 border-gold-300 border-dashed'
  },
  en_analisis: {
    label: 'En análisis',
    order: 3,
    explanation: 'El equipo técnico contrasta la ubicación con imágenes satelitales y registros.',
    badge: 'bg-navy-50 text-navy-800 border-navy-300'
  },
  info_requerida: {
    label: 'Requiere información adicional',
    order: 4,
    explanation: 'Se necesita algún detalle adicional para ubicar mejor la observación.',
    badge: 'bg-gold-100 text-gold-800 border-gold-400'
  },
  derivado_institucion: {
    label: 'Derivada a institución',
    order: 5,
    explanation: 'Se remitió una ficha técnica a la entidad pública competente.',
    badge: 'bg-teal-50 text-teal-800 border-teal-300'
  },
  en_seguimiento: {
    label: 'En seguimiento',
    order: 6,
    explanation: 'La institución receptora realiza seguimiento en el marco de sus atribuciones.',
    badge: 'bg-teal-100 text-teal-900 border-teal-400'
  },
  cerrado: {
    label: 'Cerrada',
    order: 7,
    explanation: 'El ciclo de seguimiento concluyó y su historial permanece documentado.',
    badge: 'bg-ink-100 text-ink-700 border-ink-300'
  }
};
export const REPORT_STATUS_ORDER = (Object.keys(REPORT_STATUS) as ReportStatus[]).sort(
  (a, b) => REPORT_STATUS[a].order - REPORT_STATUS[b].order
);

export const WHEN_PRESET: Record<ObservedWhenPreset, string> = {
  hoy: 'Hoy',
  esta_semana: 'Esta semana',
  hace_mas_tiempo: 'Hace más tiempo',
  no_seguro: 'No estoy seguro'
};

export const SENSOR: Record<SatelliteObservation['sensor'], string> = {
  sentinel1: 'Sentinel-1 (Radar SAR)',
  sentinel2: 'Sentinel-2 (Óptico)',
  landsat: 'Landsat 8/9 (Óptico)',
  planet: 'PlanetScope (Óptico)',
  otro: 'Otro sensor'
};

export const OBSERVATION_TYPE: Record<SatelliteObservationType, string> = {
  remocion_vegetacion: 'Remoción de cobertura vegetal',
  alteracion_cauce: 'Alteración de cauce',
  sedimentos: 'Sedimentos en cuerpo de agua',
  posible_asentamiento: 'Posible asentamiento / campamento',
  apertura_camino: 'Apertura de caminos',
  acopio_relaves: 'Acopio / relaves',
  otro: 'Otro cambio territorial'
};

export const OBSERVATION_ORIGIN: Record<ObservationOrigin, { label: string; badge: string; description: string }> = {
  automatizada: {
    label: 'Detección automatizada',
    badge: 'bg-navy-50 text-navy-800 border-navy-300 border-dashed',
    description: 'Generada por un algoritmo de detección de cambios. No constituye verificación.'
  },
  interpretacion_manual: {
    label: 'Interpretación de analista',
    badge: 'bg-teal-50 text-teal-800 border-teal-300',
    description: 'Registrada por un analista SIG a partir de la interpretación visual.'
  }
};

export const REVIEW_STATE: Record<ReviewState, { label: string; badge: string }> = {
  pendiente_revision: { label: 'Pendiente de revisión', badge: 'bg-ink-50 text-ink-700 border-ink-300 border-dashed' },
  en_interpretacion: { label: 'En interpretación técnica', badge: 'bg-navy-50 text-navy-800 border-navy-300' },
  coincidencia_territorial: { label: 'Coincidencia territorial', badge: 'bg-gold-100 text-gold-800 border-gold-400' },
  confirmada_tecnicamente: { label: 'Cambio confirmado técnicamente', badge: 'bg-teal-50 text-teal-800 border-teal-300' },
  variacion_estacional: { label: 'Variación natural / estacional', badge: 'bg-ink-100 text-ink-600 border-ink-300' },
  descartada: { label: 'Descartada', badge: 'bg-ink-100 text-ink-500 border-ink-200' }
};

export const CONFIDENCE: Record<ConfidenceLevel, { label: string; badge: string }> = {
  alta: { label: 'Confianza alta', badge: 'bg-coral-50 text-coral-800 border-coral-300' },
  media: { label: 'Confianza media', badge: 'bg-gold-50 text-gold-800 border-gold-300' },
  baja: { label: 'Confianza baja', badge: 'bg-ink-50 text-ink-600 border-ink-300' }
};

export const DOC_VERIFICATION_RESULT = {
  coincide_con_registro: 'Coincide con registro documental',
  sin_respaldo_documental: 'Sin respaldo documental localizado',
  no_concluyente: 'No concluyente'
} as const;

export const SOURCE_AVAILABILITY: Record<SourceAvailability, { label: string; badge: string }> = {
  integracion_pendiente: { label: 'Integración pendiente', badge: 'bg-gold-50 text-gold-800 border-gold-300 border-dashed' },
  carga_manual: { label: 'Carga manual de archivos', badge: 'bg-navy-50 text-navy-800 border-navy-300' },
  api_disponible: { label: 'Servicio conectado', badge: 'bg-teal-50 text-teal-800 border-teal-300' },
  no_disponible: { label: 'No disponible', badge: 'bg-ink-100 text-ink-600 border-ink-300' }
};

export const ALERT_TYPE: Record<AlertType, string> = {
  observacion_satelital: 'Observación satelital',
  denuncia_ciudadana: 'Denuncia ciudadana',
  area_protegida: 'Proximidad a área protegida',
  inconsistencia_documental: 'Inconsistencia documental',
  cuerpo_de_agua: 'Afectación a cuerpo de agua',
  otro: 'Otro'
};

export const ALERT_PRIORITY: Record<AlertPriority, { label: string; badge: string; color: string }> = {
  alta: { label: 'Prioridad alta', badge: 'bg-coral-600 text-white border-coral-700', color: DATA_COLORS.coral },
  media: { label: 'Prioridad media', badge: 'bg-gold-100 text-gold-900 border-gold-400', color: DATA_COLORS.gold },
  baja: { label: 'Prioridad baja', badge: 'bg-ink-100 text-ink-700 border-ink-300', color: DATA_COLORS.neutral }
};

export const ALERT_STATUS: Record<AlertStatus, { label: string; badge: string }> = {
  activa: { label: 'Activa', badge: 'bg-coral-50 text-coral-800 border-coral-300' },
  en_atencion: { label: 'En atención', badge: 'bg-navy-50 text-navy-800 border-navy-300' },
  derivada: { label: 'Derivada', badge: 'bg-teal-50 text-teal-800 border-teal-300' },
  cerrada: { label: 'Cerrada', badge: 'bg-ink-100 text-ink-600 border-ink-300' }
};

export const AUDIT_ACTION: Record<AuditAction, string> = {
  crear: 'Creación',
  actualizar: 'Actualización',
  clasificar: 'Clasificación administrativa',
  cambiar_estado: 'Cambio de estado',
  vincular: 'Vinculación',
  adjuntar: 'Adjunto de evidencia',
  eliminar: 'Eliminación',
  importar: 'Importación',
  exportar: 'Exportación',
  iniciar_sesion: 'Inicio de sesión',
  derivar: 'Derivación'
};

export const INSTITUTIONS_FOR_DERIVATION = [
  'Autoridad Jurisdiccional Administrativa Minera (AJAM)',
  'Ministerio de Minería y Metalurgia',
  'Ministerio de Medio Ambiente y Agua',
  'SERNAP',
  'SERGEOMIN',
  'Gobierno Autónomo Departamental',
  'Gobierno Autónomo Municipal'
];

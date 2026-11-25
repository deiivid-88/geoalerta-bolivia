// Datos originales del prototipo TERRAMINA, conservados sin cambios. `src/data/seed.ts` los migra al modelo GeoAlerta.
import {
  AuditLogEntry,
  CitizenReport,
  InstitutionalRecord,
  SatelliteObservation
} from './terraminaTypes';

export const INITIAL_REPORTS: CitizenReport[] = [
  {
    id: 'REP-001',
    trackingCode: 'TRM-2026-0418',
    category: 'contaminacion_agua',
    department: 'La Paz',
    municipality: 'Tipuani',
    community: 'Chima',
    locationDescription: 'Orilla sur del río Tipuani, a unos 2 km aguas abajo de Chima',
    lat: -15.565,
    lng: -67.985,
    observedWhenPreset: 'esta_semana',
    observedDate: '2026-11-18',
    createdAt: '2026-11-19',
    description:
      'El agua del río cambió de color a un tono marrón muy turbio desde hace cuatro días y se escuchan motores cerca de la playa del río.',
    hasPhoto: true,
    confidentiality: 'anonimo',
    status: 'derivado_institucion',
    publicNote:
      'Reporte verificado en mapa junto con observación satelital Sentinel-2. Se remitió ficha informativa a autoridad competente para consulta técnica.',
    assignedInstitution: 'AJAM / MMAyA (Demo)',
    relatedSatelliteId: 'SAT-S2-2026-089',
    relatedInstitutionalId: 'INST-AJAM-01',
    hasCoincidence: true
  },
  {
    id: 'REP-002',
    trackingCode: 'TRM-2026-0392',
    category: 'actividad_minera',
    department: 'Beni',
    municipality: 'Riberalta',
    community: 'Tumichucua',
    locationDescription: 'Sector ribereño cerca del meandro norte del río Beni',
    lat: -11.14,
    lng: -66.15,
    observedWhenPreset: 'hace_mas_tiempo',
    observedDate: '2026-11-05',
    createdAt: '2026-11-08',
    description:
      'Observamos balsas estacionadas en la curva del río desde comienzos de mes. Queremos saber si cuentan con autorización ambiental.',
    hasPhoto: false,
    confidentiality: 'confidencial',
    status: 'en_revision',
    publicNote:
      'El equipo técnico está contrastando la ubicación aproximada con imágenes de radar Sentinel-1 y registros públicos.',
    relatedSatelliteId: 'SAT-S1-2026-041',
    hasCoincidence: true
  },
  {
    id: 'REP-003',
    trackingCode: 'TRM-2026-0511',
    category: 'cambios_territorio',
    department: 'Santa Cruz',
    municipality: 'San Ignacio de Velasco',
    community: 'Santa Ana de Velasco',
    locationDescription: 'Camino vecinal hacia la quebrada oeste, zona de monte bajo',
    lat: -16.44,
    lng: -60.86,
    observedWhenPreset: 'hoy',
    observedDate: '2026-11-23',
    createdAt: '2026-11-23',
    description:
      'Se abrió una brecha nueva con maquinaria pesada y hay movimiento de tierra en una zona donde antes había cobertura boscosa.',
    hasPhoto: true,
    confidentiality: 'anonimo',
    status: 'recibido',
    publicNote:
      'Su reporte fue recibido correctamente. Se encuentra en cola para revisión inicial de ubicación y cruce satelital.',
    hasCoincidence: false
  },
  {
    id: 'REP-004',
    trackingCode: 'TRM-2026-0340',
    category: 'afectacion_comunidades',
    department: 'Oruro',
    municipality: 'Huanuni',
    community: 'Cataricagua',
    locationDescription: 'Sector pampa baja colindante con canal de riego comunal',
    lat: -18.31,
    lng: -66.81,
    observedWhenPreset: 'hace_mas_tiempo',
    observedDate: '2026-10-22',
    createdAt: '2026-10-25',
    description:
      'Acumulación de sedimentos cerca de las acequias que usamos para los cultivos y pastoreo de la comunidad.',
    hasPhoto: true,
    confidentiality: 'confidencial',
    status: 'seguimiento_institucional',
    publicNote:
      'Registro en seguimiento conjunto con instancia técnica departamental. Se adjuntó registro histórico referencial de la zona.',
    assignedInstitution: 'Ministerio de Minería / Gobernación (Demo)',
    relatedInstitutionalId: 'INST-AJAM-02',
    hasCoincidence: true
  },
  {
    id: 'REP-005',
    trackingCode: 'TRM-2026-0477',
    category: 'otra_ambiental',
    department: 'La Paz',
    municipality: 'Apolo',
    community: 'Azariamas',
    locationDescription: 'Zona de amortiguación cercana al río Tuichi',
    lat: -14.58,
    lng: -68.45,
    observedWhenPreset: 'esta_semana',
    observedDate: '2026-11-16',
    createdAt: '2026-11-17',
    description:
      'Ingresaron camiones con combustible por el sendero comunal hacia el río; no conocemos si existe permiso o actividad registrada.',
    hasPhoto: false,
    confidentiality: 'anonimo',
    status: 'info_requerida',
    publicNote:
      'Para ubicar mejor el tramo señalado, si desea puede compartir una referencia más cercana al cruce del camino o esperar la próxima pasada satelital.',
    relatedSatelliteId: 'SAT-S2-2026-094',
    relatedInstitutionalId: 'INST-SERNAP-01',
    hasCoincidence: true
  },
  {
    id: 'REP-006',
    trackingCode: 'TRM-2026-0219',
    category: 'contaminacion_agua',
    department: 'Potosí',
    municipality: 'Uyuni',
    community: 'Pulacayo',
    locationDescription: 'Quebrada seca al este del antiguo campamento',
    lat: -20.39,
    lng: -66.69,
    observedWhenPreset: 'hace_mas_tiempo',
    observedDate: '2026-09-14',
    createdAt: '2026-09-15',
    description:
      'Escurrimiento de agua con coloración amarillenta tras las primeras lluvias de septiembre.',
    hasPhoto: true,
    confidentiality: 'anonimo',
    status: 'cerrado',
    publicNote:
      'Caso documentado y cerrado en etapa informativa: se verificó pasivo ambiental histórico ya inventariado en registros públicos.',
    assignedInstitution: 'Ministerio de Minería y Metalurgia (Demo)',
    relatedInstitutionalId: 'INST-MMM-01',
    hasCoincidence: false
  },
  {
    id: 'REP-007',
    trackingCode: 'TRM-2026-0495',
    category: 'actividad_minera',
    department: 'Pando',
    municipality: 'Puerto Rico',
    community: 'Conquista',
    locationDescription: 'Margen izquierda del río Madre de Dios',
    lat: -11.28,
    lng: -67.32,
    observedWhenPreset: 'esta_semana',
    observedDate: '2026-11-20',
    createdAt: '2026-11-21',
    description:
      'Movimiento de plataformas sobre el río y tala puntual en la barranca.',
    hasPhoto: false,
    confidentiality: 'anonimo',
    status: 'en_revision',
    publicNote:
      'Observación en revisión preliminar con imágenes radar Sentinel-1 por cobertura de nubes en la zona amazónica.',
    relatedSatelliteId: 'SAT-S1-2026-047',
    hasCoincidence: true
  }
];

export const INITIAL_SATELLITE_OBSERVATIONS: SatelliteObservation[] = [
  {
    id: 'SAT-S2-2026-089',
    sensor: 'Sentinel-2 (Óptico)',
    sensorType: 'sentinel2',
    acquisitionDate: '2026-11-18',
    comparisonWindow: '12 Ago 2026 – 18 Nov 2026',
    department: 'La Paz',
    municipality: 'Tipuani',
    zoneName: 'Meandro Sur Río Tipuani (Demo)',
    lat: -15.555,
    lng: -67.97,
    approxAreaHa: 14.6,
    confidenceLabel: 'Alta prioridad de revisión',
    validationState: 'coincidencia_territorial',
    changeDescription:
      'Variación espectral en ribera fluvial con incremento de suelo desnudo y pluma de sedimentos en suspensión respecto al periodo seco previo. Requiere interpretación técnica.',
    relatedReportIds: ['REP-001'],
    relatedInstitutionalId: 'INST-AJAM-01',
    beforeScene: 'river_meander'
  },
  {
    id: 'SAT-S1-2026-041',
    sensor: 'Sentinel-1 (Radar SAR)',
    sensorType: 'sentinel1',
    acquisitionDate: '2026-11-15',
    comparisonWindow: '04 Sep 2026 – 15 Nov 2026',
    department: 'Beni',
    municipality: 'Riberalta',
    zoneName: 'Curva Norte Río Beni (Demo)',
    lat: -11.12,
    lng: -66.13,
    approxAreaHa: 8.2,
    confidenceLabel: 'Prioridad media',
    validationState: 'en_analisis',
    changeDescription:
      'Anomalía de retrodispersión SAR (polarización VV/VH) sobre lámina de agua y playa fluvial bajo nubosidad persistente. Coincide geográficamente con reporte ciudadano.',
    relatedReportIds: ['REP-002'],
    beforeScene: 'wetland_sediment'
  },
  {
    id: 'SAT-S2-2026-094',
    sensor: 'Sentinel-2 (Óptico)',
    sensorType: 'sentinel2',
    acquisitionDate: '2026-11-14',
    comparisonWindow: '20 Jul 2026 – 14 Nov 2026',
    department: 'La Paz',
    municipality: 'Apolo',
    zoneName: 'Sector Subandino Río Tuichi (Demo)',
    lat: -14.56,
    lng: -68.43,
    approxAreaHa: 6.4,
    confidenceLabel: 'Alta prioridad de revisión',
    validationState: 'coincidencia_territorial',
    changeDescription:
      'Pérdida localizada de cobertura vegetal (descenso de índice NDVI) próxima a límite referencial de área protegida. Pendiente de verificación en terreno.',
    relatedReportIds: ['REP-005'],
    relatedInstitutionalId: 'INST-SERNAP-01',
    beforeScene: 'forest_clearing'
  },
  {
    id: 'SAT-S1-2026-047',
    sensor: 'Sentinel-1 (Radar SAR)',
    sensorType: 'sentinel1',
    acquisitionDate: '2026-11-19',
    comparisonWindow: '10 Oct 2026 – 19 Nov 2026',
    department: 'Pando',
    municipality: 'Puerto Rico',
    zoneName: 'Tramo Medio Madre de Dios (Demo)',
    lat: -11.26,
    lng: -67.3,
    approxAreaHa: 11.3,
    confidenceLabel: 'Prioridad media',
    validationState: 'pendiente_verificacion',
    changeDescription:
      'Cambios de rugosidad superficial en terraza aluvial y presencia de reflectores metálicos en cauce detectados por radar SAR.',
    relatedReportIds: ['REP-007'],
    beforeScene: 'river_meander'
  },
  {
    id: 'SAT-S2-2026-071',
    sensor: 'Sentinel-2 (Óptico)',
    sensorType: 'sentinel2',
    acquisitionDate: '2026-10-30',
    comparisonWindow: '01 Jun 2026 – 30 Oct 2026',
    department: 'Santa Cruz',
    municipality: 'San Ramón',
    zoneName: 'Microcuenca Chiquitana Oeste (Demo)',
    lat: -16.6,
    lng: -62.51,
    approxAreaHa: 19.5,
    confidenceLabel: 'Observación preliminar',
    validationState: 'en_analisis',
    changeDescription:
      'Apertura lineal y remoción superficial observada dentro o colindante a polígono referencial de registro minero.',
    relatedReportIds: [],
    relatedInstitutionalId: 'INST-AJAM-03',
    beforeScene: 'forest_clearing'
  },
  {
    id: 'SAT-S1-2026-033',
    sensor: 'Sentinel-1 (Radar SAR)',
    sensorType: 'sentinel1',
    acquisitionDate: '2026-10-28',
    comparisonWindow: '15 May 2026 – 28 Oct 2026',
    department: 'Oruro',
    municipality: 'Huanuni',
    zoneName: 'Planicie Altiplánica Sur (Demo)',
    lat: -18.3,
    lng: -66.83,
    approxAreaHa: 22.1,
    confidenceLabel: 'Prioridad media',
    validationState: 'verificado_campo',
    changeDescription:
      'Modificación geométrica en áreas de acopio y humedad superficial en entorno de actividad minera registrada.',
    relatedReportIds: ['REP-004'],
    relatedInstitutionalId: 'INST-AJAM-02',
    beforeScene: 'highland_tailings'
  }
];

export const INITIAL_INSTITUTIONAL_RECORDS: InstitutionalRecord[] = [
  {
    id: 'INST-AJAM-01',
    institution: 'AJAM',
    recordType: 'Registro de Derechos Mineros (Demostrativo)',
    title: 'Cuadrícula Referencial Río Kaka / Tipuani',
    department: 'La Paz',
    municipality: 'Tipuani / Guanay',
    lat: -15.51,
    lng: -67.92,
    updatedAt: '2026-10-15',
    sourceUrl: 'https://www.autoridadminera.gob.bo',
    sourceLabel: 'Portal referencial AJAM (Datos simulados)',
    availabilityState: 'Datos demostrativos públicos',
    summary:
      'Registro ilustrativo de cuadrícula minera referencial para demostrar el cruce espacial con reportes ciudadanos y observaciones Sentinel-2.',
    codeReference: 'DEMO-AJAM-LP-104'
  },
  {
    id: 'INST-AJAM-02',
    institution: 'AJAM',
    recordType: 'Derecho Preconstituido (Demostrativo)',
    title: 'Área Minera Referencial Huanuni Norte',
    department: 'Oruro',
    municipality: 'Huanuni',
    lat: -18.29,
    lng: -66.84,
    updatedAt: '2026-09-30',
    sourceUrl: 'https://www.autoridadminera.gob.bo',
    sourceLabel: 'Catastro Minero Referencial AJAM (Demo)',
    availabilityState: 'Datos demostrativos públicos',
    summary:
      'Polígono referencial utilizado en el prototipo para contextualizar observaciones en zonas de minería tradicional del altiplano.',
    codeReference: 'DEMO-AJAM-OR-219'
  },
  {
    id: 'INST-AJAM-03',
    institution: 'AJAM',
    recordType: 'Área de Prospección (Demostrativo)',
    title: 'Concesión Referencial Escudo Chiquitano',
    department: 'Santa Cruz',
    municipality: 'San Ramón',
    lat: -16.61,
    lng: -62.5,
    updatedAt: '2026-10-02',
    sourceUrl: 'https://www.autoridadminera.gob.bo',
    sourceLabel: 'Portal referencial AJAM (Datos simulados)',
    availabilityState: 'Consulta parcial simulada',
    summary:
      'Ejemplo de registro territorial demostrativo para contrastar aperturas de suelo en tierras bajas.',
    codeReference: 'DEMO-AJAM-SC-087'
  },
  {
    id: 'INST-MMM-01',
    institution: 'Ministerio de Minería y Metalurgia',
    recordType: 'Inventario de Pasivos y Gestión Ambiental (Demostrativo)',
    title: 'Ficha Referencial Cuenca Alta Pulacayo – Uyuni',
    department: 'Potosí',
    municipality: 'Uyuni',
    lat: -20.39,
    lng: -66.69,
    updatedAt: '2026-08-20',
    sourceUrl: 'https://www.mineria.gob.bo',
    sourceLabel: 'Ministerio de Minería y Metalurgia (Referencial)',
    availabilityState: 'Enlace referencial',
    summary:
      'Documento demostrativo de contexto sobre pasivos ambientales mineros y monitoreo de escorrentías estacionales.',
    codeReference: 'DEMO-MMM-PT-012'
  },
  {
    id: 'INST-SERNAP-01',
    institution: 'SERNAP',
    recordType: 'Límite y Zonificación de Área Protegida (Demostrativo)',
    title: 'Zona de Amortiguación Parque Nacional Madidi',
    department: 'La Paz',
    municipality: 'Apolo',
    lat: -14.55,
    lng: -68.42,
    updatedAt: '2026-11-01',
    sourceUrl: 'https://sernap.gob.bo',
    sourceLabel: 'SERNAP – Sistema Nacional de Áreas Protegidas (Demo)',
    availabilityState: 'Datos demostrativos públicos',
    summary:
      'Capa geográfica referencial que permite identificar si una observación satelital o denuncia ciudadana se encuentra cerca o dentro de un área protegida.',
    codeReference: 'DEMO-SERNAP-AP-001'
  },
  {
    id: 'INST-MMAYA-01',
    institution: 'MMAyA / ABT',
    recordType: 'Monitoreo Hídrico y Cobertura Boscosa (Demostrativo)',
    title: 'Alerta Temprana de Cobertura Cuenca Amazónica Sur',
    department: 'Beni',
    municipality: 'Riberalta',
    lat: -11.1,
    lng: -66.12,
    updatedAt: '2026-11-10',
    sourceUrl: 'https://www.mmaya.gob.bo',
    sourceLabel: 'MMAyA / ABT (Referencia demostrativa)',
    availabilityState: 'Consulta parcial simulada',
    summary:
      'Registro ilustrativo sobre cobertura boscosa y cuerpos de agua para apoyar la revisión técnica interinstitucional.',
    codeReference: 'DEMO-MMAYA-BN-031'
  }
];

export const INITIAL_AUDIT_LOG: AuditLogEntry[] = [
  {
    id: 'LOG-001',
    timestamp: '2026-11-20 10:15',
    userName: 'Lic. Valeria Quispe',
    userRole: 'Analista SIG',
    targetType: 'Reporte ciudadano',
    targetId: 'TRM-2026-0418',
    previousState: 'En revisión',
    newState: 'Derivado a una institución',
    notes: 'Coincidencia espacial detectada con SAT-S2-2026-089 y polígono referencial DEMO-AJAM-LP-104.'
  },
  {
    id: 'LOG-002',
    timestamp: '2026-11-18 16:40',
    userName: 'Ing. Carlos Mamani',
    userRole: 'Revisor Institucional',
    targetType: 'Reporte ciudadano',
    targetId: 'TRM-2026-0477',
    previousState: 'En revisión',
    newState: 'Información complementaria requerida',
    notes: 'Se solicita referencia más precisa del cruce en el camino comunal sin exponer datos personales.'
  },
  {
    id: 'LOG-003',
    timestamp: '2026-11-15 09:20',
    userName: 'Dra. Sofía Mendoza',
    userRole: 'Administrador',
    targetType: 'Observación satelital',
    targetId: 'SAT-S2-2026-094',
    previousState: 'En análisis',
    newState: 'Coincidencia territorial',
    notes: 'Proximidad a zona de amortiguación referencial DEMO-SERNAP-AP-001.'
  }
];

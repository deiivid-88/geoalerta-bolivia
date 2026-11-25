import type {
  AlertStatus,
  AuditEntry,
  CitizenReport,
  ClassificationBasis,
  DocumentalVerification,
  Evidence,
  EvidenceEntity,
  ImportResult,
  InstitutionalSource,
  MiningRecord,
  MiningRecordInput,
  MiningRecordQuery,
  NewReportInput,
  Page,
  PublicReportView,
  ReportStatus,
  ReviewState,
  SatelliteObservation,
  Session,
  SourceDocument,
  TerritorialAlert,
  User
} from '../types/domain';

export type DataMode = 'demo' | 'api';

/** Error de servicio con código HTTP y mensaje apto para el usuario. */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number = 0,
    public readonly fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export type MiningRecordPatch = Partial<Omit<MiningRecordInput, 'classification'>>;

export interface ImportOptions {
  format: 'csv' | 'geojson' | 'xlsx' | 'shapefile';
  sourceLabel: string;
}

/**
 * Contrato único de acceso a datos. Las páginas solo conocen esta interfaz;
 * cambiar de modo demo a base de datos real no requiere tocar la interfaz de usuario.
 */
export interface DataProvider {
  readonly mode: DataMode;

  auth: {
    login(email: string, password: string): Promise<Session>;
    logout(): Promise<void>;
    restore(): Promise<Session | null>;
  };

  miningRecords: {
    query(q: MiningRecordQuery): Promise<Page<MiningRecord>>;
    all(): Promise<MiningRecord[]>;
    get(id: string): Promise<MiningRecord>;
    create(input: MiningRecordInput): Promise<MiningRecord>;
    update(id: string, patch: MiningRecordPatch, expectedVersion: number): Promise<MiningRecord>;
    classify(
      id: string,
      basis: Omit<ClassificationBasis, 'determinedBy' | 'determinedAt'>,
      expectedVersion: number
    ): Promise<MiningRecord>;
    remove(id: string, reason: string): Promise<void>;
    importFile(file: File, options: ImportOptions): Promise<ImportResult>;
  };

  evidences: {
    upload(entityType: EvidenceEntity, entityId: string, file: File, meta: Pick<Evidence, 'title' | 'docType'>): Promise<Evidence>;
    remove(evidence: Evidence): Promise<void>;
    /** Devuelve una URL local (blob/data) para ver o descargar el archivo con la sesión actual. */
    objectUrl(url: string): Promise<string>;
  };

  reports: {
    all(): Promise<CitizenReport[]>;
    /** Público: crea la denuncia y devuelve solo el código de seguimiento. */
    submitPublic(input: NewReportInput): Promise<{ trackingCode: string }>;
    /** Público: vista reducida sin datos personales. */
    track(trackingCode: string): Promise<PublicReportView | null>;
    updateStatus(id: string, change: { status: ReportStatus; publicNote: string; assignedInstitution?: string; internalNote: string }): Promise<CitizenReport>;
    link(id: string, links: { relatedSatelliteId?: string | null; relatedMiningRecordId?: string | null }): Promise<CitizenReport>;
  };

  satellites: {
    all(): Promise<SatelliteObservation[]>;
    create(input: Omit<SatelliteObservation, 'id' | 'createdAt' | 'createdBy' | 'evidences' | 'dataOrigin' | 'documentalVerification'>): Promise<SatelliteObservation>;
    review(id: string, state: ReviewState, note: string): Promise<SatelliteObservation>;
    verifyDocumental(id: string, verification: Omit<DocumentalVerification, 'verifiedBy' | 'verifiedAt'>): Promise<SatelliteObservation>;
    link(id: string, links: { relatedMiningRecordIds?: string[]; relatedReportIds?: string[] }): Promise<SatelliteObservation>;
  };

  alerts: {
    all(): Promise<TerritorialAlert[]>;
    create(input: Omit<TerritorialAlert, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'origin'>): Promise<TerritorialAlert>;
    updateStatus(id: string, status: AlertStatus, note: string, derivedTo?: string): Promise<TerritorialAlert>;
  };

  sources: {
    all(): Promise<InstitutionalSource[]>;
    documents(): Promise<SourceDocument[]>;
    update(id: string, patch: Partial<InstitutionalSource>): Promise<InstitutionalSource>;
  };

  users: {
    all(): Promise<User[]>;
    create(input: Omit<User, 'id' | 'createdAt' | 'lastLoginAt'> & { password: string }): Promise<User>;
    update(id: string, patch: Partial<Pick<User, 'name' | 'role' | 'institution' | 'active'>> & { password?: string }): Promise<User>;
  };

  audit: {
    list(filter?: { entityType?: string; entityId?: string; limit?: number }): Promise<AuditEntry[]>;
    /** Registra eventos del cliente (p. ej. exportaciones). En modo API el backend valida la sesión. */
    logClientEvent(entry: Pick<AuditEntry, 'action' | 'entityType' | 'entityId' | 'summary'>): Promise<void>;
  };
}

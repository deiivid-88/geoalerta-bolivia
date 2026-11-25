import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  CitizenReport,
  InstitutionalSource,
  MiningRecord,
  SatelliteObservation,
  SourceDocument,
  TerritorialAlert
} from '../types/domain';
import { getProvider, ServiceError, type DataProvider } from '../services';
import { useSession } from './session';
import { useToast } from './toast';

export interface Collections {
  miningRecords: MiningRecord[];
  reports: CitizenReport[];
  satellites: SatelliteObservation[];
  alerts: TerritorialAlert[];
  sources: InstitutionalSource[];
  sourceDocuments: SourceDocument[];
}
export type CollectionKey = keyof Collections;

const EMPTY: Collections = { miningRecords: [], reports: [], satellites: [], alerts: [], sources: [], sourceDocuments: [] };

interface DataCtx extends Collections {
  loading: boolean;
  error: string | null;
  provider: DataProvider;
  reload(keys?: CollectionKey[]): Promise<void>;
  /** Ejecuta una mutación, notifica el resultado y recarga las colecciones afectadas. */
  mutate<T>(fn: (p: DataProvider) => Promise<T>, opts: { success?: string; reload?: CollectionKey[] }): Promise<T | undefined>;
}

const Ctx = createContext<DataCtx | null>(null);

const LOADERS: Record<CollectionKey, (p: DataProvider) => Promise<unknown>> = {
  miningRecords: (p) => p.miningRecords.all(),
  reports: (p) => p.reports.all(),
  satellites: (p) => p.satellites.all(),
  alerts: (p) => p.alerts.all(),
  sources: (p) => p.sources.all(),
  sourceDocuments: (p) => p.sources.documents()
};

export function DataProviderRoot({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const toast = useToast();
  const provider = getProvider();
  const [data, setData] = useState<Collections>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (keys: CollectionKey[] = Object.keys(LOADERS) as CollectionKey[]) => {
      try {
        const results = await Promise.all(keys.map((k) => LOADERS[k](provider)));
        setData((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k, i) => [k, results[i]])) }));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar datos.');
      }
    },
    [provider]
  );

  useEffect(() => {
    if (!session) {
      setData(EMPTY);
      return;
    }
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [session, reload]);

  const mutate = useCallback(
    async <T,>(fn: (p: DataProvider) => Promise<T>, opts: { success?: string; reload?: CollectionKey[] }) => {
      try {
        const result = await fn(provider);
        if (opts.success) toast('success', opts.success);
        if (opts.reload?.length) await reload(opts.reload);
        return result;
      } catch (e) {
        if (e instanceof ServiceError && e.fieldErrors) throw e; // el formulario muestra los errores por campo
        toast('error', e instanceof Error ? e.message : 'Ocurrió un error inesperado.');
        return undefined;
      }
    },
    [provider, reload, toast]
  );

  const value = useMemo<DataCtx>(() => ({ ...data, loading, error, provider, reload, mutate }), [data, loading, error, provider, reload, mutate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData fuera de DataProviderRoot');
  return ctx;
}

/** Fecha de referencia para series temporales: la más reciente de los datos (o hoy). */
export function useReferenceDate(): Date {
  const { reports, satellites, miningRecords } = useData();
  return useMemo(() => {
    const dates = [
      ...reports.map((r) => r.createdAt),
      ...satellites.map((s) => s.acquisitionDate),
      ...miningRecords.map((m) => m.registeredAt)
    ].filter(Boolean);
    if (!dates.length) return new Date();
    const max = dates.reduce((a, b) => (a > b ? a : b));
    return new Date(`${max.slice(0, 10)}T12:00:00Z`);
  }, [reports, satellites, miningRecords]);
}

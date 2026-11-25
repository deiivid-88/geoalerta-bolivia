/**
 * Proveedor API: comunica con el backend GeoAlerta (FastAPI + PostgreSQL/PostGIS).
 * - Nunca contiene credenciales de base de datos: solo habla HTTP con la API.
 * - El token JWT se guarda en sessionStorage (se borra al cerrar la pestaña).
 * - El backend aplica permisos, validación, auditoría y control de versiones.
 */
import type { MiningRecord, Page, Session } from '../types/domain';
import { ServiceError, type DataProvider } from './types';

const SESSION_KEY = 'geoalerta.api.session';
const TIMEOUT_MS = 20000;

const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Convierte claves recursivamente; no toca el interior de geometrías GeoJSON. */
function convertKeys(value: unknown, fn: (k: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => convertKeys(v, fn));
  if (value && typeof value === 'object' && !(value instanceof Blob)) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.type === 'string' && 'coordinates' in obj) return obj;
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [fn(k), convertKeys(v, fn)]));
  }
  return value;
}
export const camelize = <T,>(v: unknown) => convertKeys(v, toCamel) as T;
export const snakify = (v: unknown) => convertKeys(v, toSnake);

export function createHttpProvider(baseUrl: string, onUnauthorized?: () => void): DataProvider {
  let session: Session | null = null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    session = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    session = null;
  }

  async function request<T>(method: string, path: string, opts: { body?: unknown; form?: FormData; query?: Record<string, unknown>; auth?: boolean } = {}): Promise<T> {
    const url = new URL(baseUrl.replace(/\/$/, '') + path, window.location.origin);
    Object.entries(opts.query ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(toSnake(k), String(v));
    });
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.auth !== false && session?.token) headers.Authorization = `Bearer ${session.token}`;
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(snakify(opts.body));
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url.toString(), { method, headers, body, signal: ctrl.signal });
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      throw new ServiceError(
        aborted
          ? 'El servidor no respondió a tiempo. Intente nuevamente.'
          : 'No se pudo conectar con el servidor GeoAlerta. Verifique la conexión o el estado del servicio.',
        0
      );
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 204) return undefined as T;
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 && opts.auth !== false) {
        session = null;
        sessionStorage.removeItem(SESSION_KEY);
        onUnauthorized?.();
      }
      const detail = payload?.detail;
      const message = typeof detail === 'string' ? detail : detail?.message ?? `Error del servidor (${res.status}).`;
      const fieldErrors = Array.isArray(detail)
        ? Object.fromEntries(detail.map((d: { loc?: string[]; msg: string }) => [toCamel(String(d.loc?.slice(-1)[0] ?? 'general')), d.msg]))
        : detail?.field_errors;
      throw new ServiceError(Array.isArray(detail) ? 'Revise los campos marcados.' : message, res.status, fieldErrors);
    }
    return camelize<T>(payload);
  }

  const get = <T,>(path: string, query?: Record<string, unknown>) => request<T>('GET', path, { query });
  const post = <T,>(path: string, body?: unknown) => request<T>('POST', path, { body });
  const patch = <T,>(path: string, body?: unknown) => request<T>('PATCH', path, { body });

  return {
    mode: 'api',

    auth: {
      async login(email, password) {
        const r = await request<{ accessToken: string; expiresAt: string; user: Session['user'] }>('POST', '/auth/login', { body: { email, password }, auth: false });
        session = { user: r.user, token: r.accessToken, expiresAt: r.expiresAt };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
      },
      async logout() {
        try {
          if (session) await post('/auth/logout');
        } finally {
          session = null;
          sessionStorage.removeItem(SESSION_KEY);
        }
      },
      async restore() {
        if (!session) return null;
        if (new Date(session.expiresAt).getTime() < Date.now()) {
          sessionStorage.removeItem(SESSION_KEY);
          session = null;
          return null;
        }
        try {
          const user = await get<Session['user']>('/auth/me');
          session = { ...session, user };
          return session;
        } catch {
          return null;
        }
      }
    },

    miningRecords: {
      query: (q) => get<Page<MiningRecord>>('/mining-records', q as Record<string, unknown>),
      async all() {
        const out: MiningRecord[] = [];
        for (let page = 1; page < 200; page++) {
          const res = await get<Page<MiningRecord>>('/mining-records', { page, pageSize: 500 });
          out.push(...res.items);
          if (out.length >= res.total || res.items.length === 0) break;
        }
        return out;
      },
      get: (id) => get(`/mining-records/${encodeURIComponent(id)}`),
      create: (input) => post('/mining-records', input),
      update: (id, p, expectedVersion) => patch(`/mining-records/${encodeURIComponent(id)}`, { ...p, expectedVersion }),
      classify: (id, basis, expectedVersion) => post(`/mining-records/${encodeURIComponent(id)}/classification`, { ...basis, expectedVersion }),
      remove: (id, reason) => request('DELETE', `/mining-records/${encodeURIComponent(id)}`, { query: { reason } }),
      importFile(file, options) {
        const form = new FormData();
        form.append('file', file);
        form.append('format', options.format);
        form.append('source_label', options.sourceLabel);
        return request('POST', '/mining-records/import', { form });
      }
    },

    evidences: {
      upload(entityType, entityId, file, meta) {
        const form = new FormData();
        form.append('file', file);
        form.append('entity_type', entityType);
        form.append('entity_id', entityId);
        form.append('title', meta.title);
        form.append('doc_type', meta.docType);
        return request('POST', '/evidences', { form });
      },
      remove: (e) => request('DELETE', `/evidences/${encodeURIComponent(e.id)}`),
      async objectUrl(url) {
        if (url.startsWith('data:') || url.startsWith('blob:')) return url;
        const abs = new URL(url, new URL(baseUrl, window.location.origin)).toString();
        const res = await fetch(abs, { headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {} });
        if (!res.ok) throw new ServiceError(res.status === 403 ? 'Sin permiso para ver este archivo.' : 'No se pudo obtener el archivo.', res.status);
        return URL.createObjectURL(await res.blob());
      }
    },

    reports: {
      all: () => get('/reports', { pageSize: 5000 }),
      submitPublic: (input) => request('POST', '/public/reports', { body: input, auth: false }),
      async track(code) {
        try {
          return await request('GET', `/public/reports/${encodeURIComponent(code.trim())}`, { auth: false });
        } catch (e) {
          if (e instanceof ServiceError && e.status === 404) return null;
          throw e;
        }
      },
      updateStatus: (id, change) => patch(`/reports/${encodeURIComponent(id)}/status`, change),
      link: (id, links) => patch(`/reports/${encodeURIComponent(id)}/links`, links)
    },

    satellites: {
      all: () => get('/satellite-observations', { pageSize: 5000 }),
      create: (input) => post('/satellite-observations', input),
      review: (id, state, note) => post(`/satellite-observations/${encodeURIComponent(id)}/review`, { reviewState: state, note }),
      verifyDocumental: (id, v) => post(`/satellite-observations/${encodeURIComponent(id)}/documental-verification`, v),
      link: (id, links) => patch(`/satellite-observations/${encodeURIComponent(id)}/links`, links)
    },

    alerts: {
      all: () => get('/alerts', { pageSize: 5000 }),
      create: (input) => post('/alerts', input),
      updateStatus: (id, status, note, derivedTo) => post(`/alerts/${encodeURIComponent(id)}/status`, { status, note, derivedTo })
    },

    sources: {
      all: () => get('/sources'),
      documents: () => get('/source-documents'),
      update: (id, p) => patch(`/sources/${encodeURIComponent(id)}`, p)
    },

    users: {
      all: () => get('/users'),
      create: (input) => post('/users', input),
      update: (id, p) => patch(`/users/${encodeURIComponent(id)}`, p)
    },

    audit: {
      list: (filter) => get('/audit', filter as Record<string, unknown>),
      logClientEvent: (entry) => post('/audit/client-events', entry)
    }
  };
}

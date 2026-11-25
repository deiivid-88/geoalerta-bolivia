import type { Role } from '../types/domain';

/**
 * Matriz de permisos. Es la misma que aplica el backend (`backend/app/core/permissions.py`).
 * En el frontend solo decide qué se muestra; la autorización real ocurre en la API.
 */
export type Permission =
  | 'dashboard.view'
  | 'map.view'
  | 'records.view'
  | 'records.create'
  | 'records.edit'
  | 'records.classify'
  | 'records.delete'
  | 'records.import'
  | 'records.export'
  | 'evidence.upload'
  | 'reports.view'
  | 'reports.review'
  | 'reports.view_sensitive'
  | 'satellite.view'
  | 'satellite.create'
  | 'satellite.review'
  | 'satellite.verify_documental'
  | 'sources.view'
  | 'sources.manage'
  | 'analysis.view'
  | 'alerts.view'
  | 'alerts.manage'
  | 'alerts.derive'
  | 'informes.generate'
  | 'audit.view'
  | 'admin.users'
  | 'admin.settings';

const BASE_READ: Permission[] = [
  'dashboard.view',
  'map.view',
  'records.view',
  'reports.view',
  'satellite.view',
  'sources.view',
  'analysis.view',
  'alerts.view',
  'informes.generate'
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  administrador: new Set<Permission>([
    ...BASE_READ,
    'records.create',
    'records.edit',
    'records.classify',
    'records.delete',
    'records.import',
    'records.export',
    'evidence.upload',
    'reports.review',
    'reports.view_sensitive',
    'satellite.create',
    'satellite.review',
    'satellite.verify_documental',
    'sources.manage',
    'alerts.manage',
    'alerts.derive',
    'audit.view',
    'admin.users',
    'admin.settings'
  ]),
  analista_sig: new Set<Permission>([
    ...BASE_READ,
    'records.create',
    'records.edit',
    'records.import',
    'records.export',
    'evidence.upload',
    'satellite.create',
    'satellite.review',
    'alerts.manage'
  ]),
  revisor_institucional: new Set<Permission>([
    ...BASE_READ,
    'records.edit',
    'records.classify',
    'records.export',
    'evidence.upload',
    'reports.review',
    'reports.view_sensitive',
    'satellite.verify_documental',
    'alerts.manage',
    'alerts.derive',
    'audit.view'
  ]),
  consulta_institucional: new Set<Permission>(BASE_READ)
};

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

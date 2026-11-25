import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Megaphone,
  Menu,
  Mountain,
  Satellite,
  Settings,
  Siren,
  X
} from 'lucide-react';
import { useSession } from '../app/session';
import { useData } from '../app/data';
import type { Permission } from '../domain/permissions';
import { ROLE } from '../domain/catalogs';
import { DATA_MODE } from '../services';
import { BrandLogo } from './BrandLogo';
import { cx } from './ui';

export interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  permission: Permission;
  badge?: number;
}

export const AppShell: React.FC<{ currentPath: string; children: React.ReactNode }> = ({ currentPath, children }) => {
  const { session, logout, can } = useSession();
  const { alerts, reports, error } = useData();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [currentPath]);

  const activeAlerts = alerts.filter((a) => a.status === 'activa').length;
  const pendingReports = reports.filter((r) => r.status === 'recibido' || r.status === 'pendiente_revision').length;

  const items: NavItem[] = [
    { path: '/', label: 'Inicio / Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, permission: 'dashboard.view' },
    { path: '/mapa', label: 'Mapa territorial', icon: <MapIcon className="w-4 h-4" />, permission: 'map.view' },
    { path: '/registros', label: 'Registros mineros', icon: <Mountain className="w-4 h-4" />, permission: 'records.view' },
    { path: '/denuncias', label: 'Denuncias ciudadanas', icon: <Megaphone className="w-4 h-4" />, permission: 'reports.view', badge: pendingReports },
    { path: '/satelital', label: 'Observaciones satelitales', icon: <Satellite className="w-4 h-4" />, permission: 'satellite.view' },
    { path: '/institucional', label: 'Información institucional', icon: <Building2 className="w-4 h-4" />, permission: 'sources.view' },
    { path: '/analisis', label: 'Análisis territorial', icon: <BarChart3 className="w-4 h-4" />, permission: 'analysis.view' },
    { path: '/alertas', label: 'Alertas', icon: <Siren className="w-4 h-4" />, permission: 'alerts.view', badge: activeAlerts },
    { path: '/informes', label: 'Informes', icon: <FileText className="w-4 h-4" />, permission: 'informes.generate' },
    { path: '/admin', label: 'Administración', icon: <Settings className="w-4 h-4" />, permission: 'audit.view' }
  ];
  const visible = items.filter((i) => can(i.permission) || (i.path === '/admin' && can('admin.users')));
  const isActive = (p: string) => (p === '/' ? currentPath === '/' : currentPath === p || currentPath.startsWith(`${p}/`));

  const nav = (
    <nav aria-label="Secciones" className="flex-1 overflow-y-auto py-3">
      <ul className="space-y-0.5 px-2">
        {visible.map((i) => (
          <li key={i.path}>
            <a
              href={`#${i.path}`}
              aria-current={isActive(i.path) ? 'page' : undefined}
              className={cx(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                isActive(i.path) ? 'bg-white/10 text-white shadow-[inset_3px_0_0_#D5A329]' : 'text-navy-100 hover:bg-white/5 hover:text-white'
              )}
            >
              {i.icon}
              <span className="flex-1">{i.label}</span>
              {!!i.badge && (
                <span className={cx('min-w-[20px] text-center rounded px-1 text-[10px] font-bold', i.path === '/alertas' ? 'bg-coral-600 text-white' : 'bg-gold-500 text-navy-950')}>{i.badge}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );

  const userBlock = session && (
    <div className="border-t border-white/10 p-3 text-xs">
      <div className="text-white font-semibold truncate">{session.user.name}</div>
      <div className="text-navy-200 truncate">{ROLE[session.user.role].label}</div>
      <div className="text-navy-300 truncate">{session.user.institution}</div>
      <button type="button" onClick={logout} className="mt-2 inline-flex items-center gap-1.5 text-navy-100 hover:text-white">
        <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-ivory-100 text-ink-900 lg:pl-64">
      {/* Barra lateral (escritorio) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-navy-900 z-40">
        <div className="px-4 py-4 border-b border-white/10">
          <BrandLogo variant="inverse" className="h-10" showSlogan />
        </div>
        {nav}
        {userBlock}
      </aside>

      {/* Barra lateral (móvil / tablet) */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-[1600] flex">
          <div className="w-72 max-w-[85%] bg-navy-900 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <BrandLogo variant="inverse" className="h-9" />
              <button type="button" onClick={() => setDrawer(false)} aria-label="Cerrar menú" className="text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            {nav}
            {userBlock}
          </div>
          <button type="button" aria-label="Cerrar menú" className="flex-1 bg-navy-950/50" onClick={() => setDrawer(false)} />
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-ink-200">
        <div className="flex items-center gap-3 px-3 sm:px-5 h-14">
          <button type="button" onClick={() => setDrawer(true)} className="lg:hidden p-1.5 rounded text-navy-900 hover:bg-ink-100" aria-label="Abrir menú">
            <Menu className="w-5 h-5" />
          </button>
          <div className="lg:hidden">
            <BrandLogo className="h-8" />
          </div>
          <div className="hidden lg:block text-xs text-ink-500">Plataforma de inteligencia territorial minera · Bolivia</div>
          <div className="ml-auto flex items-center gap-2">
            {DATA_MODE === 'demo' ? (
              <span className="text-[11px] font-bold px-2 py-1 rounded border border-dashed border-gold-400 bg-gold-50 text-gold-900" title="Datos demostrativos almacenados en este navegador. Sin conexión a base de datos.">
                MODO DEMOSTRATIVO
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2 py-1 rounded border border-teal-300 bg-teal-50 text-teal-800">BASE DE DATOS CENTRAL</span>
            )}
            {activeAlerts > 0 && can('alerts.view') && (
              <a href="#/alertas" className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-coral-600 text-white">
                <Siren className="w-3.5 h-3.5" /> {activeAlerts} alertas activas
              </a>
            )}
          </div>
        </div>
        {error && <div className="bg-coral-50 border-t border-coral-200 text-coral-800 text-xs px-5 py-1.5">{error}</div>}
      </header>

      <main className="px-3 sm:px-5 py-5 max-w-[1600px] mx-auto">{children}</main>
    </div>
  );
};

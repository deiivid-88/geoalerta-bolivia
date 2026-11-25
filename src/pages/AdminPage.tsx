import React, { useEffect, useMemo, useState } from 'react';
import { Check, Database, Download, Plus, RefreshCw, X } from 'lucide-react';
import type { AuditEntry, Role, User } from '../types/domain';
import { useData } from '../app/data';
import { useSession } from '../app/session';
import { AuditTimeline } from '../components/records';
import { Badge, Button, Card, DataTable, DL, Field, Input, Modal, Notice, PageHeader, Select, Tabs, type Column } from '../components/ui';
import { AUDIT_ACTION, ROLE } from '../domain/catalogs';
import { ROLE_PERMISSIONS, type Permission } from '../domain/permissions';
import { downloadText } from '../domain/interchange';
import { formatDateTime, todayISO } from '../domain/util';
import { API_BASE_URL, DATA_MODE } from '../services';
import { resetDemoData } from '../services/demoProvider';

type Tab = 'usuarios' | 'permisos' | 'bitacora' | 'sistema';

export const AdminPage: React.FC = () => {
  const { can } = useSession();
  const tabs = [
    can('admin.users') && { id: 'usuarios' as Tab, label: 'Usuarios y roles' },
    { id: 'permisos' as Tab, label: 'Matriz de permisos' },
    can('audit.view') && { id: 'bitacora' as Tab, label: 'Bitácora de auditoría' },
    can('admin.settings') && { id: 'sistema' as Tab, label: 'Sistema y base de datos' }
  ].filter(Boolean) as { id: Tab; label: string }[];
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? 'permisos');

  return (
    <div className="space-y-3">
      <PageHeader title="Administración" description="Gestión de usuarios, permisos, trazabilidad y configuración de la plataforma." />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'usuarios' && <UsersTab />}
      {tab === 'permisos' && <PermissionsTab />}
      {tab === 'bitacora' && <AuditTab />}
      {tab === 'sistema' && <SystemTab />}
    </div>
  );
};

const UsersTab: React.FC = () => {
  const { provider, mutate } = useData();
  const { session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const load = () => provider.users.all().then(setUsers).catch(() => setUsers([]));
  useEffect(() => {
    load();
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<User>[] = [
    { key: 'n', header: 'Nombre', render: (u) => <div><div className="font-semibold text-navy-900">{u.name}</div><div className="text-[11px] text-ink-500">{u.email}</div></div>, sortValue: (u) => u.name },
    { key: 'r', header: 'Rol', render: (u) => <Badge className="bg-navy-50 text-navy-800 border-navy-200">{ROLE[u.role].label}</Badge>, sortValue: (u) => u.role },
    { key: 'i', header: 'Institución', render: (u) => <span className="text-xs">{u.institution}</span>, sortValue: (u) => u.institution, hideOnMobile: true },
    { key: 'a', header: 'Estado', render: (u) => (u.active ? <Badge className="bg-teal-50 text-teal-800 border-teal-300">Activo</Badge> : <Badge className="bg-ink-100 text-ink-600 border-ink-300">Desactivado</Badge>), sortValue: (u) => (u.active ? 0 : 1) },
    { key: 'l', header: 'Último acceso', render: (u) => <span className="text-xs">{formatDateTime(u.lastLoginAt)}</span>, sortValue: (u) => u.lastLoginAt ?? '', hideOnMobile: true }
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Nuevo usuario</Button>
      </div>
      <DataTable rows={users} columns={columns} rowKey={(u) => u.id} onRowClick={(u) => setEditing(u)} />
      {editing && (
        <UserModal
          user={editing === 'new' ? undefined : editing}
          isSelf={editing !== 'new' && editing.id === session?.user.id}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            const ok = await mutate((p) => (editing === 'new' ? p.users.create(data as Parameters<typeof p.users.create>[0]) : p.users.update(editing.id, data)), { success: 'Usuario guardado.' });
            if (ok) {
              setEditing(null);
              load();
            }
          }}
        />
      )}
    </div>
  );
};

const UserModal: React.FC<{ user?: User; isSelf: boolean; onClose: () => void; onSave: (d: Partial<User> & { password?: string }) => void }> = ({ user, isSelf, onClose, onSave }) => {
  const [f, setF] = useState({ name: user?.name ?? '', email: user?.email ?? '', role: user?.role ?? ('consulta_institucional' as Role), institution: user?.institution ?? '', active: user?.active ?? true, password: '' });
  const pwOk = user ? !f.password || f.password.length >= 12 : f.password.length >= 12;
  return (
    <Modal
      open
      onClose={onClose}
      title={user ? `Editar usuario` : 'Nuevo usuario'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!f.name.trim() || !f.email.trim() || !pwOk} onClick={() => onSave(user ? { name: f.name, role: f.role, institution: f.institution, active: f.active, ...(f.password ? { password: f.password } : {}) } : f)}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre completo" required>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Correo institucional" required>{(id) => <Input id={id} type="email" value={f.email} disabled={!!user} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Rol" hint={ROLE[f.role].description}>
          {(id) => (
            <Select id={id} value={f.role} disabled={isSelf} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Institución">{(id) => <Input id={id} value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} />}</Field>
        <Field label={user ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña inicial'} required={!user} error={!pwOk && f.password ? 'Mínimo 12 caracteres.' : undefined} hint="Mínimo 12 caracteres. Comunicar por un canal seguro.">
          {(id) => <Input id={id} type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}
        </Field>
        {user && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-teal-700 w-4 h-4" checked={f.active} disabled={isSelf} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Cuenta activa
          </label>
        )}
        {isSelf && <Notice>No puede cambiar su propio rol ni desactivar su propia cuenta.</Notice>}
      </div>
    </Modal>
  );
};

const PERMISSION_GROUPS: { label: string; items: [Permission, string][] }[] = [
  { label: 'Consulta', items: [['dashboard.view', 'Ver dashboard'], ['map.view', 'Consultar mapas'], ['records.view', 'Ver registros mineros'], ['reports.view', 'Ver denuncias'], ['satellite.view', 'Ver observaciones'], ['sources.view', 'Ver fuentes institucionales'], ['analysis.view', 'Análisis territorial'], ['alerts.view', 'Ver alertas'], ['informes.generate', 'Generar / descargar informes']] },
  { label: 'Registros mineros', items: [['records.create', 'Crear registros'], ['records.edit', 'Editar datos y coordenadas'], ['records.classify', 'Modificar clasificación administrativa'], ['records.delete', 'Eliminar registros'], ['records.import', 'Importar datos'], ['records.export', 'Exportar datos'], ['evidence.upload', 'Adjuntar documentación']] },
  { label: 'Denuncias y satélite', items: [['reports.review', 'Revisar y cambiar estado de denuncias'], ['reports.view_sensitive', 'Ver datos de contacto de denunciantes'], ['satellite.create', 'Registrar observaciones'], ['satellite.review', 'Revisión técnica de observaciones'], ['satellite.verify_documental', 'Verificación documental']] },
  { label: 'Alertas y administración', items: [['alerts.manage', 'Crear / gestionar alertas'], ['alerts.derive', 'Derivar alertas a instituciones'], ['sources.manage', 'Gestionar fuentes'], ['audit.view', 'Ver bitácora completa'], ['admin.users', 'Gestionar usuarios'], ['admin.settings', 'Configuración general']] }
];

const PermissionsTab: React.FC = () => {
  const roles = Object.keys(ROLE) as Role[];
  return (
    <Card title="Control de acceso por roles" subtitle="La misma matriz se aplica en el backend; el frontend solo oculta lo que el rol no puede usar." bodyClassName="p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-ivory-50">
          <tr>
            <th scope="col" className="text-left px-3 py-2 text-[11px] uppercase tracking-wide text-ink-600">Permiso</th>
            {roles.map((r) => <th key={r} scope="col" className="px-3 py-2 text-[11px] uppercase tracking-wide text-ink-600 text-center">{ROLE[r].label}</th>)}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_GROUPS.map((g) => (
            <React.Fragment key={g.label}>
              <tr className="bg-navy-50">
                <td colSpan={roles.length + 1} className="px-3 py-1.5 text-xs font-bold text-navy-900">{g.label}</td>
              </tr>
              {g.items.map(([p, label]) => (
                <tr key={p} className="border-b border-ink-100">
                  <td className="px-3 py-1.5 text-xs">{label}</td>
                  {roles.map((r) => (
                    <td key={r} className="text-center">
                      {ROLE_PERMISSIONS[r].has(p) ? <Check className="w-4 h-4 text-teal-700 inline" aria-label="Permitido" /> : <X className="w-4 h-4 text-ink-300 inline" aria-label="No permitido" />}
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

const AuditTab: React.FC = () => {
  const { provider } = useData();
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [entityType, setEntityType] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'tabla' | 'linea'>('tabla');
  const load = () => provider.audit.list({ entityType: entityType || undefined, limit: 1000 }).then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
  }, [provider, entityType]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => items.filter((a) => !q || `${a.entityId} ${a.userName} ${a.summary}`.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const columns: Column<AuditEntry>[] = [
    { key: 't', header: 'Fecha', render: (a) => <span className="text-xs whitespace-nowrap">{formatDateTime(a.timestamp)}</span>, sortValue: (a) => a.timestamp },
    { key: 'u', header: 'Usuario', render: (a) => <div className="text-xs"><div className="font-semibold">{a.userName}</div><div className="text-ink-500">{a.userRole in ROLE ? ROLE[a.userRole as Role].label : a.userRole}</div></div>, sortValue: (a) => a.userName },
    { key: 'a', header: 'Acción', render: (a) => <span className="text-xs">{AUDIT_ACTION[a.action]}</span>, sortValue: (a) => a.action },
    { key: 'e', header: 'Elemento', render: (a) => <span className="font-mono text-[11px]">{a.entityId}</span>, sortValue: (a) => a.entityId },
    { key: 's', header: 'Detalle', render: (a) => <div className="text-xs max-w-md">{a.summary}{a.changes?.map((c, i) => <div key={i} className="text-ink-500">{c.field}: {c.from} → {c.to}</div>)}</div> }
  ];
  const exportCsv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = ['fecha,usuario,rol,accion,entidad,id,detalle,cambios', ...rows.map((a) => [a.timestamp, a.userName, a.userRole, a.action, a.entityType, a.entityId, a.summary, (a.changes ?? []).map((c) => `${c.field}: ${c.from} -> ${c.to}`).join(' | ')].map((v) => esc(String(v))).join(','))].join('\r\n');
    downloadText(`geoalerta_bitacora_${todayISO()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Tipo de elemento" value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-52">
          <option value="">Todos los elementos</option>
          <option value="registro_minero">Registros mineros</option>
          <option value="denuncia">Denuncias</option>
          <option value="observacion">Observaciones</option>
          <option value="alerta">Alertas</option>
          <option value="usuario">Usuarios</option>
          <option value="fuente">Fuentes</option>
          <option value="sesion">Sesiones</option>
        </Select>
        <Input aria-label="Buscar en bitácora" placeholder="Buscar por ID, usuario o detalle" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Button icon={<RefreshCw className="w-4 h-4" />} onClick={load}>Actualizar</Button>
        <Button icon={<Download className="w-4 h-4" />} onClick={exportCsv}>Exportar CSV</Button>
        <Button variant="ghost" onClick={() => setView((v) => (v === 'tabla' ? 'linea' : 'tabla'))}>{view === 'tabla' ? 'Ver línea de tiempo' : 'Ver tabla'}</Button>
      </div>
      {view === 'tabla' ? <DataTable rows={rows} columns={columns} rowKey={(a) => a.id} initialSort={{ key: 't', order: 'desc' }} /> : <Card><AuditTimeline items={rows.slice(0, 200)} /></Card>}
    </div>
  );
};

const SystemTab: React.FC = () => {
  const { miningRecords, reports, satellites, alerts } = useData();
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card title={<span className="flex items-center gap-2"><Database className="w-4 h-4 text-teal-700" /> Conexión de datos</span>}>
        <DL
          cols={1}
          items={[
            ['Modo', DATA_MODE === 'demo' ? 'Demostrativo (almacenamiento local del navegador)' : 'API · base de datos central'],
            ['Endpoint de API', DATA_MODE === 'api' ? API_BASE_URL : 'No configurado (VITE_DATA_MODE=demo)'],
            ['Registros cargados', `${miningRecords.length} registros · ${reports.length} denuncias · ${satellites.length} observaciones · ${alerts.length} alertas`]
          ]}
        />
        {DATA_MODE === 'demo' && (
          <Notice tone="warning" className="mt-3">
            La plataforma no está conectada a la base de datos central. Para activarla, configure el backend (PostgreSQL + PostGIS) y defina
            <code className="mx-1">VITE_DATA_MODE=api</code>. Ver <code>docs/04-BASE-DE-DATOS.md</code>.
          </Notice>
        )}
      </Card>
      {DATA_MODE === 'demo' && (
        <Card title="Datos demostrativos">
          <p className="text-sm text-ink-700 mb-3">Restablece el conjunto de ejemplo y elimina los cambios hechos en este navegador (registros, adjuntos, bitácora).</p>
          <Button
            variant="danger"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => {
              if (window.confirm('¿Restablecer todos los datos demostrativos? Se perderán los cambios locales y se cerrará la sesión.')) {
                resetDemoData();
                window.location.reload();
              }
            }}
          >
            Restablecer datos demo
          </Button>
        </Card>
      )}
    </div>
  );
};

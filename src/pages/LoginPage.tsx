import React, { useState } from 'react';
import { Lock, Megaphone, Search, ShieldCheck } from 'lucide-react';
import { useSession } from '../app/session';
import { BrandLogo } from '../components/BrandLogo';
import { Button, Field, Input, Notice } from '../components/ui';
import { DATA_MODE } from '../services';
import { DEMO_PASSWORD, SEED_USERS } from '../data/seed';
import { ROLE } from '../domain/catalogs';

const PRESENTATION_ACCOUNTS = [
  { id: 'USR-ADMIN-01', role: 'administrador' as const, email: 'admin@geoalerta.bo' },
  { id: 'USR-ANALISTA-01', role: 'analista_sig' as const, email: 'analista@geoalerta.bo' },
  { id: 'USR-REVISOR-01', role: 'revisor_institucional' as const, email: 'revisor@geoalerta.bo' },
  { id: 'USR-CONSULTA-01', role: 'consulta_institucional' as const, email: 'consulta@geoalerta.bo' },
];

const PRESENTATION_PASSWORD = 'GeoAlerta-admin-2026';

export const LoginPage: React.FC = () => {
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  const quickUsers =
    DATA_MODE === 'demo'
      ? SEED_USERS.filter((u) => u.active).map((u) => ({
          id: u.id,
          role: u.role,
          email: u.email,
          pass: DEMO_PASSWORD,
        }))
      : PRESENTATION_ACCOUNTS.map((u) => ({
          ...u,
          pass: PRESENTATION_PASSWORD,
        }));

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-ivory-100">
      <section className="hidden lg:flex flex-col justify-between bg-navy-900 text-white p-10 relative overflow-hidden">
        <BrandLogo variant="inverse" className="h-14" showSlogan />
        <div className="max-w-md space-y-4 relative">
          <h1 className="text-3xl font-extrabold leading-tight">Información territorial para actuar a tiempo.</h1>
          <p className="text-navy-100 text-sm leading-relaxed">
            Plataforma de inteligencia territorial para visualizar, analizar, registrar y gestionar información georreferenciada sobre
            actividades mineras en Bolivia.
          </p>
          <ul className="text-sm text-navy-100 space-y-2">
            <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" /> Acceso restringido a personal institucional autorizado.</li>
            <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" /> Toda clasificación administrativa conserva su fuente documental.</li>
            <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" /> Cada modificación queda registrada en la bitácora de auditoría.</li>
          </ul>
        </div>
        <p className="text-[11px] text-navy-300">La ausencia de un registro en una base de datos no implica ilegalidad.</p>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="w-full max-w-sm mx-auto space-y-6">
          <div className="lg:hidden">
            <BrandLogo className="h-12" showSlogan />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-navy-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-teal-700" /> Acceso institucional
            </h2>
            <p className="text-sm text-ink-600 mt-1">Ingrese con su cuenta asignada por el administrador.</p>
          </div>

          <form onSubmit={submit} className="space-y-3" noValidate>
            <Field label="Correo institucional" required>
              {(id) => <Input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />}
            </Field>
            <Field label="Contraseña" required>
              {(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
            </Field>
            {error && <Notice tone="danger">{error}</Notice>}
            <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!email || !password}>
              Ingresar
            </Button>
          </form>

          <div className="rounded-md border border-dashed border-gold-400 bg-gold-50 p-3 text-xs text-gold-900 space-y-2">
            <p>
              <strong>Acceso rápido de presentación.</strong>{' '}
              {DATA_MODE === 'demo'
                ? 'Modo demostrativo local.'
                : 'Conectado a base de datos central.'}{' '}
              Contraseña de todas las cuentas:{' '}
              <code className="bg-white px-1 rounded">
                {DATA_MODE === 'demo' ? DEMO_PASSWORD : PRESENTATION_PASSWORD}
              </code>
            </p>
            <div className="grid gap-1">
              {quickUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setEmail(u.email);
                    setPassword(u.pass);
                  }}
                  className="text-left rounded px-2 py-1 bg-white/70 hover:bg-white border border-gold-200"
                >
                  <strong>{ROLE[u.role].label}</strong> · {u.email}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-ink-200 pt-4 space-y-2">
            <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Acceso ciudadano (sin cuenta)</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <a href="#/denuncia" className="inline-flex items-center justify-center gap-1.5 rounded-md border border-ink-300 bg-white px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-ivory-50">
                <Megaphone className="w-4 h-4" /> Realizar denuncia
              </a>
              <a href="#/seguimiento" className="inline-flex items-center justify-center gap-1.5 rounded-md border border-ink-300 bg-white px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-ivory-50">
                <Search className="w-4 h-4" /> Consultar seguimiento
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

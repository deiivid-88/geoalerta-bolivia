import { lazy, Suspense, useEffect } from 'react';
import { SessionProvider, useSession } from './app/session';
import { DataProviderRoot } from './app/data';
import { ToastProvider } from './app/toast';
import { navigate, useRoute } from './app/router';
import { AppShell } from './components/AppShell';
import { BrandLogo } from './components/BrandLogo';
import { Card, EmptyState, Spinner } from './components/ui';
import type { Permission } from './domain/permissions';

// División de código por página: el mapa y los gráficos solo se descargan cuando se usan.
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const MapaPage = lazy(() => import('./pages/MapaPage').then((m) => ({ default: m.MapaPage })));
const RegistrosPage = lazy(() => import('./pages/RegistrosPage').then((m) => ({ default: m.RegistrosPage })));
const RegistroDetailPage = lazy(() => import('./pages/RegistroDetailPage').then((m) => ({ default: m.RegistroDetailPage })));
const DenunciasPage = lazy(() => import('./pages/DenunciasPage').then((m) => ({ default: m.DenunciasPage })));
const SatelitalPage = lazy(() => import('./pages/SatelitalPage').then((m) => ({ default: m.SatelitalPage })));
const InstitucionalPage = lazy(() => import('./pages/InstitucionalPage').then((m) => ({ default: m.InstitucionalPage })));
const AnalisisPage = lazy(() => import('./pages/AnalisisPage').then((m) => ({ default: m.AnalisisPage })));
const AlertasPage = lazy(() => import('./pages/AlertasPage').then((m) => ({ default: m.AlertasPage })));
const InformesPage = lazy(() => import('./pages/InformesPage').then((m) => ({ default: m.InformesPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const DenunciaWizardPage = lazy(() => import('./pages/DenunciaWizardPage').then((m) => ({ default: m.DenunciaWizardPage })));
const SeguimientoPage = lazy(() => import('./pages/SeguimientoPage').then((m) => ({ default: m.SeguimientoPage })));

/** Páginas públicas (ciudadanía), sin sesión. */
function PublicLayout({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  return (
    <div className="min-h-screen bg-ivory-100">
      <header className="bg-white border-b border-ink-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <a href="#/denuncia" aria-label="GeoAlerta" className="shrink-0">
            <BrandLogo className="h-9" />
          </a>
          <nav className="flex gap-3 sm:gap-4 text-xs sm:text-sm font-semibold text-navy-800 min-w-0">
            <a href="#/denuncia" className="hover:underline">Denunciar</a>
            <a href="#/seguimiento" className="hover:underline">Seguimiento</a>
            <a href="#/" className="hover:underline whitespace-nowrap">
              {session ? 'Plataforma' : <><span className="sm:hidden">Acceso</span><span className="hidden sm:inline">Acceso institucional</span></>}
            </a>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

function Forbidden() {
  return (
    <Card>
      <EmptyState title="Su rol no tiene acceso a esta sección.">Si necesita acceso, solicítelo al administrador de la plataforma.</EmptyState>
    </Card>
  );
}

function Routes() {
  const route = useRoute();
  const { session, ready, can } = useSession();
  const [section, id] = route.segments;

  // Rutas públicas
  if (section === 'denuncia') {
    return (
      <PublicLayout>
        <DenunciaWizardPage onGoToTracking={(code) => navigate(`/seguimiento/${code}`)} onExit={() => navigate(session ? '/' : '/denuncia')} />
      </PublicLayout>
    );
  }
  if (section === 'seguimiento') {
    return (
      <PublicLayout>
        <SeguimientoPage initialCode={id} />
      </PublicLayout>
    );
  }

  if (!ready) return <Spinner label="Verificando sesión…" />;
  if (!session) return <LoginPage />;

  const guard = (perm: Permission, el: React.ReactNode) => (can(perm) ? el : <Forbidden />);
  let page: React.ReactNode;
  switch (section ?? '') {
    case '':
      page = guard('dashboard.view', <DashboardPage />);
      break;
    case 'mapa':
      page = guard('map.view', <MapaPage key={route.query.toString()} />);
      break;
    case 'registros':
      page = guard('records.view', id ? <RegistroDetailPage id={id} /> : <RegistrosPage />);
      break;
    case 'denuncias':
      page = guard('reports.view', <DenunciasPage id={id} />);
      break;
    case 'satelital':
      page = guard('satellite.view', <SatelitalPage id={id} />);
      break;
    case 'institucional':
      page = guard('sources.view', <InstitucionalPage />);
      break;
    case 'analisis':
      page = guard('analysis.view', <AnalisisPage />);
      break;
    case 'alertas':
      page = guard('alerts.view', <AlertasPage />);
      break;
    case 'informes':
      page = guard('informes.generate', <InformesPage />);
      break;
    case 'admin':
      page = can('audit.view') || can('admin.users') ? <AdminPage /> : <Forbidden />;
      break;
    default:
      page = (
        <Card>
          <EmptyState title="Página no encontrada.">
            <a href="#/" className="text-teal-800 underline">Ir al inicio</a>
          </EmptyState>
        </Card>
      );
  }
  return (
    <AppShell currentPath={route.path}>
      <Suspense fallback={<Spinner />}>{page}</Suspense>
    </AppShell>
  );
}

export function App() {
  useEffect(() => {
    document.title = 'GeoAlerta · Información territorial para actuar a tiempo';
  }, []);
  return (
    <ToastProvider>
      <SessionProvider>
        <DataProviderRoot>
          <Suspense fallback={<Spinner />}>
            <Routes />
          </Suspense>
        </DataProviderRoot>
      </SessionProvider>
    </ToastProvider>
  );
}

export default App;

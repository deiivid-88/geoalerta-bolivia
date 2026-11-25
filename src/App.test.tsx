import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { App } from './App';
import { DEMO_PASSWORD } from './data/seed';

beforeAll(() => {
  // jsdom no implementa ResizeObserver ni el canvas que usa Leaflet.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = '#/';
});

async function loginAs(email: string) {
  render(<App />);
  fireEvent.change(await screen.findByLabelText(/Correo institucional/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: DEMO_PASSWORD } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('aplicación', () => {
  it('sin sesión muestra el acceso institucional y enlaces ciudadanos', async () => {
    render(<App />);
    expect(await screen.findByText('Acceso institucional')).toBeInTheDocument();
    expect(screen.getByText('Realizar denuncia')).toBeInTheDocument();
  });

  it('el administrador ve el dashboard con indicadores y las 10 secciones', async () => {
    await loginAs('admin@demo.geoalerta.bo');
    expect(await screen.findByText('Centro de monitoreo territorial', {}, { timeout: 5000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Registros mineros').length).toBeGreaterThan(0));
    const nav = screen.getAllByRole('navigation', { name: 'Secciones' })[0];
    expect(nav.querySelectorAll('a')).toHaveLength(10);
  });

  it('la consulta institucional no ve Administración', async () => {
    await loginAs('consulta@demo.geoalerta.bo');
    await screen.findByText('Centro de monitoreo territorial', {}, { timeout: 5000 });
    const nav = screen.getAllByRole('navigation', { name: 'Secciones' })[0];
    expect(nav.textContent).not.toContain('Administración');
    window.location.hash = '#/admin';
    expect(await screen.findByText(/no tiene acceso/i)).toBeInTheDocument();
  });

  it('las páginas principales renderizan sin errores', async () => {
    await loginAs('admin@demo.geoalerta.bo');
    await screen.findByText('Centro de monitoreo territorial', {}, { timeout: 5000 });
    const pages: [string, RegExp][] = [
      ['#/registros', /Inventario georreferenciado/],
      ['#/registros/GA-MIN-000001', /Situación administrativa/],
      ['#/denuncias', /Reportes de la ciudadanía/],
      ['#/satelital', /Historial de cambios territoriales/],
      ['#/institucional', /Ninguna conexión institucional está activa/],
      ['#/analisis', /Priorización para verificación/],
      ['#/alertas', /Una alerta señala prioridad/],
      ['#/informes', /Informe de situación territorial/],
      ['#/admin', /Gestión de usuarios, permisos/]
    ];
    for (const [hash, text] of pages) {
      window.location.hash = hash;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect((await screen.findAllByText(text, {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    }
  });

  it('el formulario ciudadano es público', async () => {
    window.location.hash = '#/denuncia';
    render(<App />);
    expect(await screen.findByText(/Realizar una denuncia o reporte ciudadano/)).toBeInTheDocument();
  });
});

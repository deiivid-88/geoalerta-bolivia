import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Search, ShieldCheck } from 'lucide-react';
import type { PublicReportView } from '../types/domain';
import { getProvider } from '../services';
import { REPORT_CATEGORY, REPORT_STATUS, REPORT_STATUS_ORDER } from '../domain/catalogs';
import { formatDate } from '../domain/util';
import { Button, Input, Notice } from '../components/ui';

/** Consulta pública: solo muestra estado y nota pública. Nunca datos del denunciante. */
export const SeguimientoPage: React.FC<{ initialCode?: string }> = ({ initialCode = '' }) => {
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<PublicReportView | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = async (value: string) => {
    const c = value.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    setError('');
    try {
      setResult(await getProvider().reports.track(c));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialCode) search(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const currentOrder = result ? REPORT_STATUS[result.status].order : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Seguimiento de denuncia</h1>
        <p className="text-sm text-ink-600">Ingrese el código que recibió al enviar su denuncia (formato GA-DEN-AAAA-NNNNNN).</p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search(code);
        }}
      >
        <Input aria-label="Código de seguimiento" value={code} onChange={(e) => setCode(e.target.value)} placeholder="GA-DEN-2026-000418" className="font-mono uppercase" />
        <Button type="submit" variant="primary" icon={<Search className="w-4 h-4" />} loading={busy}>
          Consultar
        </Button>
      </form>
      {error && <Notice tone="danger">{error}</Notice>}
      {result === null && <Notice tone="warning">No encontramos una denuncia con ese código. Verifique que esté escrito correctamente.</Notice>}

      {result && (
        <section className="bg-white rounded-lg border border-ink-200 shadow-card p-5 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono font-bold text-navy-900">{result.trackingCode}</span>
            <span className="text-xs text-ink-500">Recibida el {formatDate(result.createdAt)} · actualizada el {formatDate(result.updatedAt)}</span>
          </div>
          <p className="text-sm text-ink-700">
            {REPORT_CATEGORY[result.category].label} · {result.municipality}, {result.department}
          </p>
          <div className="rounded-md bg-teal-50 border border-teal-200 p-3">
            <div className="text-xs font-bold text-teal-900 uppercase tracking-wide">Estado actual: {REPORT_STATUS[result.status].label}</div>
            <p className="text-sm text-ink-800 mt-1">{result.publicNote}</p>
            {result.assignedInstitution && <p className="text-xs text-ink-600 mt-1">Institución: {result.assignedInstitution}</p>}
          </div>
          <ol className="space-y-2">
            {REPORT_STATUS_ORDER.map((s) => {
              const info = REPORT_STATUS[s];
              const done = info.order <= currentOrder;
              const current = s === result.status;
              return (
                <li key={s} className="flex gap-3">
                  {done ? <CheckCircle2 className={`w-5 h-5 shrink-0 ${current ? 'text-teal-700' : 'text-teal-500'}`} /> : <Circle className="w-5 h-5 shrink-0 text-ink-300" />}
                  <div>
                    <div className={`text-sm ${current ? 'font-bold text-navy-900' : done ? 'text-ink-800' : 'text-ink-400'}`}>{info.label}</div>
                    {current && <p className="text-xs text-ink-600">{info.explanation}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="text-[11px] text-ink-500 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" /> Esta consulta no muestra datos personales. Una denuncia es información ciudadana sujeta a verificación y no
            constituye, por sí misma, una determinación sobre la legalidad de una actividad.
          </p>
        </section>
      )}
    </div>
  );
};

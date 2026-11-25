import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Info, Loader2, X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ───────────────────────── Botones ─────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-navy-900 text-white hover:bg-navy-800 border-navy-900',
  accent: 'bg-teal-700 text-white hover:bg-teal-800 border-teal-700',
  secondary: 'bg-white text-navy-900 hover:bg-ivory-50 border-ink-300',
  ghost: 'bg-transparent text-navy-800 hover:bg-navy-50 border-transparent',
  danger: 'bg-coral-600 text-white hover:bg-coral-700 border-coral-600'
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: React.ReactNode; loading?: boolean }
> = ({ variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ...rest }) => (
  <button
    type="button"
    {...rest}
    disabled={disabled || loading}
    className={cx(
      'inline-flex items-center justify-center gap-1.5 rounded-md border font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600',
      size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
      BTN[variant],
      className
    )}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
    {children}
  </button>
);

// ───────────────────────── Contenedores ─────────────────────────

export const Card: React.FC<{ title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string; bodyClassName?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  actions,
  className,
  bodyClassName,
  children
}) => (
  <section className={cx('bg-white rounded-lg border border-ink-200 shadow-card', className)}>
    {(title || actions) && (
      <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3.5 pb-3 border-b border-ink-100">
        <div className="min-w-0">
          {title && <h2 className="text-sm font-bold text-navy-900 leading-tight">{title}</h2>}
          {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </header>
    )}
    <div className={cx('p-4', bodyClassName)}>{children}</div>
  </section>
);

export const PageHeader: React.FC<{ title: string; description?: React.ReactNode; actions?: React.ReactNode; breadcrumb?: React.ReactNode }> = ({ title, description, actions, breadcrumb }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
    <div className="min-w-0">
      {breadcrumb && <div className="text-xs text-ink-500 mb-1">{breadcrumb}</div>}
      <h1 className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight">{title}</h1>
      {description && <p className="text-sm text-ink-600 mt-0.5 max-w-3xl">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);

export const Badge: React.FC<{ className?: string; children: React.ReactNode; title?: string; dot?: string }> = ({ className, children, title, dot }) => (
  <span title={title} className={cx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-semibold whitespace-nowrap', className ?? 'bg-ink-50 text-ink-700 border-ink-200')}>
    {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} aria-hidden />}
    {children}
  </span>
);

export const DemoBadge: React.FC<{ show?: boolean }> = ({ show = true }) =>
  show ? (
    <Badge className="bg-gold-50 text-gold-800 border-gold-300 border-dashed" title="Dato demostrativo: no corresponde a información oficial">
      DEMO
    </Badge>
  ) : null;

export const Notice: React.FC<{ tone?: 'info' | 'warning' | 'danger'; children: React.ReactNode; className?: string }> = ({ tone = 'info', children, className }) => (
  <div
    className={cx(
      'flex gap-2 rounded-md border px-3 py-2.5 text-xs leading-relaxed',
      tone === 'info' && 'bg-navy-50 border-navy-200 text-navy-900',
      tone === 'warning' && 'bg-gold-50 border-gold-300 text-gold-900',
      tone === 'danger' && 'bg-coral-50 border-coral-300 text-coral-900',
      className
    )}
  >
    <Info className="w-4 h-4 shrink-0 mt-px" />
    <div>{children}</div>
  </div>
);

export const EmptyState: React.FC<{ title: string; children?: React.ReactNode; icon?: React.ReactNode }> = ({ title, children, icon }) => (
  <div className="text-center py-10 px-4">
    {icon && <div className="mx-auto mb-2 text-ink-400 flex justify-center">{icon}</div>}
    <p className="text-sm font-semibold text-ink-700">{title}</p>
    {children && <div className="text-xs text-ink-500 mt-1">{children}</div>}
  </div>
);

export const Spinner: React.FC<{ label?: string }> = ({ label = 'Cargando…' }) => (
  <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-500">
    <Loader2 className="w-5 h-5 animate-spin text-teal-700" /> {label}
  </div>
);

export const KpiCard: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: string; onClick?: () => void; icon?: React.ReactNode }> = ({
  label,
  value,
  hint,
  accent,
  onClick,
  icon
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cx(
        'text-left bg-white rounded-lg border border-ink-200 shadow-card px-3.5 py-3 relative overflow-hidden w-full',
        onClick && 'hover:border-teal-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600'
      )}
    >
      {accent && <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} aria-hidden />}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 leading-tight">{label}</span>
        {icon && <span className="text-ink-400">{icon}</span>}
      </div>
      <div className="text-2xl font-extrabold text-navy-900 mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-ink-500 mt-0.5">{hint}</div>}
    </Tag>
  );
};

// ───────────────────────── Formularios ─────────────────────────

export const Field: React.FC<{ label: string; error?: string; hint?: string; required?: boolean; className?: string; children: (id: string) => React.ReactNode }> = ({
  label,
  error,
  hint,
  required,
  className,
  children
}) => {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-semibold text-ink-700 mb-1">
        {label}
        {required && <span className="text-coral-600"> *</span>}
      </label>
      {children(id)}
      {error ? <p className="text-[11px] text-coral-700 mt-1" role="alert">{error}</p> : hint ? <p className="text-[11px] text-ink-500 mt-1">{hint}</p> : null}
    </div>
  );
};

const inputBase =
  'w-full rounded-md border border-ink-300 bg-white px-2.5 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-teal-600/40 focus:border-teal-600 disabled:bg-ink-50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...rest }, ref) => (
  <input ref={ref} {...rest} className={cx(inputBase, className)} />
));
Input.displayName = 'Input';

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...rest }) => (
  <select {...rest} className={cx(inputBase, 'pr-8', className)}>
    {children}
  </select>
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...rest }) => (
  <textarea {...rest} className={cx(inputBase, 'min-h-[80px]', className)} />
);

// ───────────────────────── Modal ─────────────────────────

export const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; subtitle?: string; size?: 'md' | 'lg' | 'xl'; footer?: React.ReactNode; children: React.ReactNode }> = ({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  footer,
  children
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1500] flex items-start sm:items-center justify-center p-2 sm:p-6 bg-navy-950/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'bg-white rounded-lg shadow-pop w-full max-h-[94vh] flex flex-col outline-none',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-3xl',
          size === 'xl' && 'max-w-5xl'
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-ink-200">
          <div>
            <h2 className="text-base font-bold text-navy-900">{title}</h2>
            {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-1 rounded text-ink-500 hover:bg-ink-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-ink-200 flex flex-wrap justify-end gap-2 bg-ivory-50 rounded-b-lg">{footer}</div>}
      </div>
    </div>
  );
};

// ───────────────────────── Tabs ─────────────────────────

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-ink-200 overflow-x-auto overflow-y-hidden">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px',
            value === t.id ? 'border-teal-700 text-navy-900' : 'border-transparent text-ink-500 hover:text-navy-800'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── Tabla de datos ─────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | undefined;
  className?: string;
  hideOnMobile?: boolean;
}

export function Pagination({ page, pageSize, total, onPage, onPageSize }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize?: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-ink-200 text-xs text-ink-600">
      <span>
        {from}–{to} de <strong className="text-ink-800">{total}</strong>
      </span>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <select aria-label="Filas por página" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="border border-ink-300 rounded px-1.5 py-1 bg-white">
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / pág.
              </option>
            ))}
          </select>
        )}
        <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)} className="p-1 rounded border border-ink-300 disabled:opacity-40 bg-white">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <button type="button" aria-label="Página siguiente" disabled={page >= pages} onClick={() => onPage(page + 1)} className="p-1 rounded border border-ink-300 disabled:opacity-40 bg-white">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/** Tabla ordenable y paginada en cliente. Para paginación en servidor usar `ServerTable` vía props controladas. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  initialSort,
  pageSize: initialPageSize = 25,
  empty = 'Sin resultados para los filtros seleccionados.',
  selectedKey,
  controlled
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  initialSort?: { key: string; order: 'asc' | 'desc' };
  pageSize?: number;
  empty?: string;
  selectedKey?: string;
  controlled?: {
    sort: { key: string; order: 'asc' | 'desc' };
    onSort: (s: { key: string; order: 'asc' | 'desc' }) => void;
    page: number;
    pageSize: number;
    total: number;
    onPage: (p: number) => void;
    onPageSize: (n: number) => void;
  };
}) {
  const [sortState, setSortState] = useState(initialSort ?? { key: '', order: 'asc' as const });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const sort = controlled?.sort ?? sortState;

  useEffect(() => setPage(1), [rows.length]);

  const sorted = useMemo(() => {
    if (controlled) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av === bv) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'es', { numeric: true })) * dir;
    });
  }, [rows, columns, sort, controlled]);

  const visible = controlled ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: string) => {
    const next = { key, order: sort.key === key && sort.order === 'asc' ? ('desc' as const) : ('asc' as const) };
    if (controlled) controlled.onSort(next);
    else setSortState(next);
  };

  return (
    <div className="bg-white rounded-lg border border-ink-200 shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ivory-50 border-b border-ink-200">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cx('px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-600 whitespace-nowrap', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                  {c.sortValue || controlled ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-navy-900" aria-label={`Ordenar por ${c.header}`}>
                      {c.header}
                      {sort.key === c.key ? sort.order === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" /> : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={empty} />
                </td>
              </tr>
            )}
            {visible.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onRowClick(row)) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cx(onRowClick && 'cursor-pointer hover:bg-teal-50/50 focus:bg-teal-50 focus:outline-none', selectedKey === key && 'bg-teal-50')}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cx('px-3 py-2 align-top', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {controlled ? (
        <Pagination page={controlled.page} pageSize={controlled.pageSize} total={controlled.total} onPage={controlled.onPage} onPageSize={controlled.onPageSize} />
      ) : (
        <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={(n) => (setPageSize(n), setPage(1))} />
      )}
    </div>
  );
}

export const DL: React.FC<{ items: [React.ReactNode, React.ReactNode][]; cols?: 1 | 2 }> = ({ items, cols = 2 }) => (
  <dl className={cx('grid gap-x-4 gap-y-2.5 text-sm', cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
    {items.map(([k, v], i) => (
      <div key={i} className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{k}</dt>
        <dd className="text-ink-900 break-words">{v === undefined || v === null || v === '' ? <span className="text-ink-400">—</span> : v}</dd>
      </div>
    ))}
  </dl>
);

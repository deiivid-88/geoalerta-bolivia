import React, { useState } from 'react';

/**
 * Muestra el logotipo OFICIAL de GeoAlerta desde /public/brand/.
 * Si el archivo todavía no se ha colocado, muestra solo el nombre en texto:
 * no se genera ni se sustituye por ningún símbolo inventado.
 */
const CANDIDATES = {
  light: ['/brand/geoalerta-logo.svg', '/brand/geoalerta-logo.png'],
  inverse: ['/brand/geoalerta-logo-inverse.svg', '/brand/geoalerta-logo-inverse.png', '/brand/geoalerta-logo.svg', '/brand/geoalerta-logo.png']
};

export const BrandLogo: React.FC<{ variant?: 'light' | 'inverse'; className?: string; showSlogan?: boolean }> = ({ variant = 'light', className = 'h-9', showSlogan }) => {
  const list = CANDIDATES[variant];
  const [idx, setIdx] = useState(0);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  if (idx < list.length) {
    return <img src={base + list[idx]} alt="GeoAlerta" className={`${className} w-auto object-contain`} onError={() => setIdx((i) => i + 1)} />;
  }
  return (
    <span className="inline-flex flex-col leading-none" aria-label="GeoAlerta">
      <span className={`font-extrabold tracking-tight text-lg ${variant === 'inverse' ? 'text-white' : 'text-navy-900'}`}>GeoAlerta</span>
      {showSlogan && <span className={`text-[10px] mt-1 ${variant === 'inverse' ? 'text-navy-200' : 'text-ink-500'}`}>Información territorial para actuar a tiempo.</span>}
    </span>
  );
};

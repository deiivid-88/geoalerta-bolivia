import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  Droplets,
  Hammer,
  HelpCircle,
  Lock,
  MapPin,
  Mountain,
  Navigation,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Users
} from 'lucide-react';
import { LocationPickerMap } from '../components/LocationPickerMap';
import { BOLIVIA_CENTER, DEPARTMENTS } from '../data/boliviaGeo';
import type {
  ConfidentialityMode,
  MiningType,
  ObservedWhenPreset,
  ReportCategory,
  ReportDraft
} from '../types/domain';
import { MINING_TYPE, MINING_TYPE_ORDER, REPORT_CATEGORY as CATEGORY_INFO, WHEN_PRESET as WHEN_PRESET_LABELS } from '../domain/catalogs';
import { getProvider } from '../services';
import { compressImage } from '../services/files';

const DRAFT_STORAGE_KEY = 'geoalerta_report_draft_v2';
const MAX_PHOTOS = 3;

const EMPTY_DRAFT: ReportDraft = {
  step: 1,
  category: '',
  observedMiningType: '',
  department: '',
  municipality: '',
  community: '',
  locationDescription: '',
  lat: BOLIVIA_CENTER[0],
  lng: BOLIVIA_CENTER[1],
  hasPinnedLocation: false,
  observedWhenPreset: '',
  observedDate: '',
  description: '',
  photos: [],
  confidentiality: 'anonimo',
  contactInfo: ''
};

interface DenunciaWizardPageProps {
  onGoToTracking: (trackingCode: string) => void;
  onExit: () => void;
}

export const DenunciaWizardPage: React.FC<DenunciaWizardPageProps> = ({ onGoToTracking, onExit }) => {
  const [draft, setDraft] = useState<ReportDraft>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        return { ...EMPTY_DRAFT, ...JSON.parse(saved) };
      }
    } catch {
      // Ignorar errores de almacenamiento
    }
    return EMPTY_DRAFT;
  });

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [geoStatus, setGeoStatus] = useState<string>('');
  const [submittedReport, setSubmittedReport] = useState<{ trackingCode: string; confidentiality: ConfidentialityMode } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Guardado automático local para conexiones lentas o cortes
  useEffect(() => {
    if (submittedReport) return;
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignorar si excede cuota
    }
  }, [draft, submittedReport]);

  const selectedDept = DEPARTMENTS.find((d) => d.name === draft.department);
  const availableMunicipalities = selectedDept ? selectedDept.municipalities : [];
  const selectedMunicipality = availableMunicipalities.find(
    (m) => m.name === draft.municipality
  );
  const availableCommunities = selectedMunicipality
    ? selectedMunicipality.communities
    : [];

  const categoryCards: { id: ReportCategory; icon: React.ReactNode }[] = [
    { id: 'actividad_minera', icon: <Hammer className="w-7 h-7" /> },
    { id: 'contaminacion_agua', icon: <Droplets className="w-7 h-7" /> },
    { id: 'cambios_territorio', icon: <Mountain className="w-7 h-7" /> },
    { id: 'afectacion_comunidades', icon: <Users className="w-7 h-7" /> },
    { id: 'otra_ambiental', icon: <HelpCircle className="w-7 h-7" /> }
  ];

  const quickPhrases = [
    'El agua del río cambió de color o está turbia.',
    'Se observan maquinarias, dragas o balsas trabajando.',
    'Hubo desmonte o apertura de camino reciente.',
    'Se escuchan motores constantes cerca de la comunidad.'
  ];

  const handleUseMyLocation = () => {
    setErrorMsg('');
    if (!navigator.geolocation) {
      setGeoStatus(
        'Tu navegador o celular no permite ubicación automática. Puedes elegir el departamento abajo o tocar el mapa.'
      );
      return;
    }
    setGeoStatus('Buscando tu ubicación aproximada...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lng = Math.round(pos.coords.longitude * 10000) / 10000;
        const inBolivia = lat >= -23 && lat <= -9.5 && lng >= -70 && lng <= -57;
        if (!inBolivia) {
          setGeoStatus(
            'Tu ubicación actual está fuera de Bolivia. Selecciona un departamento o marca un punto dentro del mapa de Bolivia.'
          );
          return;
        }
        setDraft((prev) => ({
          ...prev,
          lat,
          lng,
          hasPinnedLocation: true
        }));
        setGeoStatus(`Ubicación registrada (${lat}, ${lng}).`);
      },
      () => {
        setGeoStatus(
          'No pudimos obtener tu ubicación GPS. No hay problema: elige tu departamento abajo o toca el mapa.'
        );
      },
      { timeout: 7000 }
    );
  };

  const handleDepartmentChange = (deptName: string) => {
    const dept = DEPARTMENTS.find((d) => d.name === deptName);
    setDraft((prev) => ({
      ...prev,
      department: deptName,
      municipality: '',
      community: '',
      lat: dept ? dept.center[0] : BOLIVIA_CENTER[0],
      lng: dept ? dept.center[1] : BOLIVIA_CENTER[1],
      hasPinnedLocation: Boolean(dept)
    }));
  };

  const handleMunicipalityChange = (munName: string) => {
    const mun = availableMunicipalities.find((m) => m.name === munName);
    setDraft((prev) => ({
      ...prev,
      municipality: munName,
      community: '',
      lat: mun ? mun.lat : prev.lat,
      lng: mun ? mun.lng : prev.lng,
      hasPinnedLocation: Boolean(mun) || prev.hasPinnedLocation
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    if (draft.photos.length + files.length > MAX_PHOTOS) {
      setErrorMsg(`Puedes adjuntar hasta ${MAX_PHOTOS} fotografías.`);
      return;
    }
    if (files.some((f) => !f.type.startsWith('image/'))) {
      setErrorMsg('Solo se aceptan imágenes (JPG, PNG o WebP).');
      return;
    }
    if (files.some((f) => f.size > 15 * 1024 * 1024)) {
      setErrorMsg('Alguna imagen pesa más de 15 MB. Por favor elige una foto más liviana.');
      return;
    }
    setErrorMsg('');
    try {
      // Se reduce el tamaño y se eliminan metadatos (incluida la ubicación GPS de la cámara).
      const compressed = await Promise.all(files.map(async (f) => ({ fileName: f.name, dataUrl: await compressImage(f, 1280, 0.7) })));
      setDraft((prev) => ({ ...prev, photos: [...prev.photos, ...compressed].slice(0, MAX_PHOTOS) }));
    } catch {
      setErrorMsg('No pudimos procesar la imagen. Intenta con otra fotografía.');
    }
  };

  const validateCurrentStep = (): boolean => {
    setErrorMsg('');
    if (draft.step === 1 && !draft.category) {
      setErrorMsg('Por favor toca una de las opciones para indicarnos qué deseas reportar.');
      return false;
    }
    if (draft.step === 2) {
      if (!draft.department && !draft.hasPinnedLocation && !draft.locationDescription.trim()) {
        setErrorMsg(
          'Por favor indica al menos el departamento, marca un punto en el mapa o escribe una referencia sencilla del lugar.'
        );
        return false;
      }
    }
    if (draft.step === 3 && !draft.observedWhenPreset && !draft.observedDate) {
      setErrorMsg('Por favor selecciona cuándo observaste esta situación.');
      return false;
    }
    if (draft.step === 4 && draft.description.trim().length < 8) {
      setErrorMsg(
        'Cuéntanos un poco más (al menos unas palabras) sobre lo que viste para que podamos revisarlo.'
      );
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setDraft((prev) => ({ ...prev, step: Math.min(6, prev.step + 1) }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setErrorMsg('');
    setDraft((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetDraft = () => {
    setErrorMsg('');
    setGeoStatus('');
    setDraft(EMPTY_DRAFT);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignorar
    }
  };

  const handleSubmitFinal = async () => {
    const today = new Date().toISOString().slice(0, 10);
    setErrorMsg('');
    setSubmitting(true);
    try {
      const { trackingCode } = await getProvider().reports.submitPublic({
        category: (draft.category || 'otra_ambiental') as ReportCategory,
        observedMiningType: draft.category === 'actividad_minera' && draft.observedMiningType ? (draft.observedMiningType as MiningType) : undefined,
        department: draft.department || 'Por precisar',
        municipality: draft.municipality || 'No especificado',
        community: draft.community || 'No especificada',
        locationDescription: draft.locationDescription.trim() || 'Ubicación señalada en el mapa',
        lat: draft.lat,
        lng: draft.lng,
        observedWhenPreset: (draft.observedWhenPreset || 'no_seguro') as ObservedWhenPreset,
        observedDate: draft.observedDate || today,
        description: draft.description.trim(),
        photos: draft.photos,
        confidentiality: draft.confidentiality,
        contactInfo: draft.confidentiality === 'confidencial' ? draft.contactInfo.trim() : undefined
      });
      setSubmittedReport({ trackingCode, confidentiality: draft.confidentiality });
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Ignorar
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrorMsg(
        (err instanceof Error ? err.message : 'No se pudo enviar la denuncia.') +
          ' Tu borrador sigue guardado en este dispositivo; puedes intentarlo de nuevo más tarde.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Pantalla de confirmación tras enviar
  if (submittedReport) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white rounded-3xl border border-forest-200 shadow-lg p-6 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-forest-900">
              ¡Gracias por cuidar tu territorio!
            </h1>
            <p className="text-base text-earth-700">
              Tu reporte fue registrado de manera segura. Nuestro equipo revisará la ubicación y la
              información disponible.
            </p>
          </div>

          <div className="bg-forest-50 border-2 border-forest-300 rounded-2xl p-5 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-forest-800">
              Tu código único de seguimiento
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-2xl sm:text-3xl font-black tracking-wider text-forest-950 font-mono">
                {submittedReport.trackingCode}
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(submittedReport.trackingCode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-forest-300 text-forest-900 text-xs font-bold hover:bg-forest-100"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedCode ? '¡Copiado!' : 'Copiar código'}
              </button>
            </div>
            <p className="text-xs text-earth-600 pt-1">
              Anota o toma una foto de este código para consultar avances más adelante.
            </p>
          </div>

          <div className="bg-earth-50 rounded-xl p-4 text-left text-sm text-earth-700 space-y-1.5 border border-earth-200">
            <p className="font-bold text-forest-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-forest-700" />
              Protección de privacidad y neutralidad
            </p>
            <p>
              Tu reporte se muestra en el sistema de forma general como{' '}
              <strong>&ldquo;Reporte recibido – pendiente de verificación&rdquo;</strong>.{' '}
              {submittedReport.confidentiality === 'anonimo'
                ? 'No se recopiló ningún dato personal.'
                : 'Tu dato de contacto se mantiene confidencial y nunca es visible al público.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => onGoToTracking(submittedReport.trackingCode)}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-forest-900 hover:bg-forest-800 text-white font-bold text-base"
            >
              <ClipboardCheck className="w-5 h-5" />
              Consultar estado ahora
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmittedReport(null);
                setDraft(EMPTY_DRAFT);
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-earth-100 hover:bg-earth-200 text-earth-900 font-bold text-base"
            >
              Hacer otro reporte
            </button>
          </div>

          <button
            type="button"
            onClick={onExit}
            className="text-sm font-semibold text-forest-800 hover:underline"
          >
            Volver a la página de inicio
          </button>
        </div>
      </div>
    );
  }

  const progressPct = Math.round((draft.step / 6) * 100);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Cabecera amigable + privacidad */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest-100 text-forest-900 text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            Reporte seguro · Opción anónima disponible
          </span>
          <div className="flex items-center gap-3 text-xs text-earth-600">
            <span className="inline-flex items-center gap-1 text-forest-800 font-medium">
              <Save className="w-3.5 h-3.5" />
              Borrador guardado automáticamente
            </span>
            <button
              type="button"
              onClick={handleResetDraft}
              className="inline-flex items-center gap-1 text-earth-600 hover:text-ochre-700 underline"
            >
              <RotateCcw className="w-3 h-3" /> Reiniciar
            </button>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-forest-950">
          Realizar una denuncia o reporte ciudadano
        </h1>
        <p className="text-sm sm:text-base text-earth-700">
          No necesitas saber términos técnicos. Avanza paso a paso; solo te pedimos la información
          básica para ubicar el lugar.
        </p>

        {/* Barra de progreso */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-bold text-forest-900">
            <span>Paso {draft.step} de 6</span>
            <span>{progressPct}% completado</span>
          </div>
          <div className="w-full h-3 bg-earth-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-forest-700 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tarjeta principal del paso */}
      <div className="bg-white rounded-3xl border border-earth-200 shadow-md p-5 sm:p-8 space-y-6">
        {errorMsg && (
          <div
            role="alert"
            className="flex items-start gap-3 p-4 rounded-xl bg-ochre-50 border border-ochre-400 text-ochre-700 text-sm font-semibold"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* PASO 1 */}
        {draft.step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-forest-900">
                1. ¿Qué deseas reportar?
              </h2>
              <p className="text-sm text-earth-600 mt-1">
                Toca la opción que mejor describa lo que observaste.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {categoryCards.map(({ id, icon }) => {
                const info = CATEGORY_INFO[id];
                const selected = draft.category === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setDraft((prev) => ({ ...prev, category: id }));
                    }}
                    className={`flex items-start gap-4 p-4 sm:p-5 rounded-2xl border-2 text-left transition-all ${
                      selected
                        ? 'border-forest-700 bg-forest-50 shadow-sm'
                        : 'border-earth-200 bg-white hover:border-forest-300 hover:bg-earth-50'
                    }`}
                  >
                    <div
                      className={`p-3 rounded-xl shrink-0 ${
                        selected
                          ? 'bg-forest-800 text-white'
                          : 'bg-earth-100 text-forest-800'
                      }`}
                    >
                      {icon}
                    </div>
                    <div>
                      <div className="font-bold text-base sm:text-lg text-forest-950">
                        {info.label}
                      </div>
                      <div className="text-xs sm:text-sm text-earth-600 mt-0.5 leading-snug">
                        {info.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {draft.step === 1 && draft.category === 'actividad_minera' && (
          <div className="rounded-xl border border-earth-200 bg-earth-50 p-4 space-y-2">
            <label htmlFor="observed-mining-type" className="block text-sm font-bold text-forest-900">
              ¿Qué tipo de actividad minera observaste? <span className="font-normal text-earth-600">(opcional)</span>
            </label>
            <select
              id="observed-mining-type"
              value={draft.observedMiningType}
              onChange={(e) => setDraft((prev) => ({ ...prev, observedMiningType: e.target.value as MiningType | '' }))}
              className="w-full px-3 py-2.5 rounded-xl border border-earth-300 text-sm bg-white"
            >
              <option value="">No estoy seguro</option>
              {MINING_TYPE_ORDER.filter((t) => t !== 'sin_clasificacion').map((t) => (
                <option key={t} value={t}>
                  {MINING_TYPE[t].label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* PASO 2 */}
        {draft.step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-forest-900">
                2. ¿Dónde ocurre?
              </h2>
              <p className="text-sm text-earth-600 mt-1">
                Puedes usar tu ubicación, elegir tu departamento o tocar el mapa.
              </p>
            </div>

            {/* Botón GPS del dispositivo */}
            <div className="bg-forest-50 border border-forest-200 rounded-2xl p-4 space-y-2">
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-bold text-sm"
              >
                <Navigation className="w-4 h-4" />
                Usar la ubicación de mi celular o equipo
              </button>
              {geoStatus && <p className="text-xs text-forest-900 font-medium">{geoStatus}</p>}
            </div>

            {/* Selectores Departamento / Municipio / Comunidad */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-sm font-bold text-earth-800 mb-1.5">
                  Departamento
                </label>
                <select
                  value={draft.department}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl border border-earth-300 bg-white text-sm font-medium"
                >
                  <option value="">Selecciona...</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.code} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-earth-800 mb-1.5">
                  Municipio
                </label>
                <select
                  value={draft.municipality}
                  onChange={(e) => handleMunicipalityChange(e.target.value)}
                  disabled={!draft.department}
                  className="w-full px-3.5 py-3 rounded-xl border border-earth-300 bg-white text-sm font-medium disabled:bg-earth-100"
                >
                  <option value="">Selecciona...</option>
                  {availableMunicipalities.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                  {draft.department && <option value="Otro municipio">Otro municipio</option>}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-earth-800 mb-1.5">
                  Comunidad o localidad
                </label>
                {availableCommunities.length > 0 ? (
                  <select
                    value={draft.community}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, community: e.target.value }))
                    }
                    className="w-full px-3.5 py-3 rounded-xl border border-earth-300 bg-white text-sm font-medium"
                  >
                    <option value="">Opcional...</option>
                    {availableCommunities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="Otra comunidad">Otra comunidad</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={draft.community}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, community: e.target.value }))
                    }
                    placeholder="Nombre de la comunidad"
                    className="w-full px-3.5 py-3 rounded-xl border border-earth-300 text-sm"
                  />
                )}
              </div>
            </div>

            {/* Descripción sencilla del lugar */}
            <div>
              <label className="block text-sm font-bold text-earth-800 mb-1.5">
                Describe el lugar con palabras sencillas (opcional)
              </label>
              <input
                type="text"
                value={draft.locationDescription}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, locationDescription: e.target.value }))
                }
                placeholder="Ej. Cerca del río, pasando el puente viejo hacia la quebrada"
                className="w-full px-4 py-3 rounded-xl border border-earth-300 text-sm sm:text-base"
              />
            </div>

            {/* Mapa para marcar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-earth-800 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-ochre-600" />
                  Señalar punto aproximado en el mapa
                </span>
                {draft.hasPinnedLocation && (
                  <span className="text-xs font-semibold text-forest-800 bg-forest-100 px-2.5 py-1 rounded-full">
                    Punto marcado: {draft.lat.toFixed(3)}, {draft.lng.toFixed(3)}
                  </span>
                )}
              </div>
              <LocationPickerMap
                lat={draft.lat}
                lng={draft.lng}
                hasPin={draft.hasPinnedLocation}
                onPickLocation={(lat, lng) =>
                  setDraft((prev) => ({
                    ...prev,
                    lat,
                    lng,
                    hasPinnedLocation: true
                  }))
                }
              />
            </div>
          </div>
        )}

        {/* PASO 3 */}
        {draft.step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-forest-900">
                3. ¿Cuándo observaste esta situación?
              </h2>
              <p className="text-sm text-earth-600 mt-1">
                No pasa nada si no recuerdas el día exacto.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {(Object.keys(WHEN_PRESET_LABELS) as ObservedWhenPreset[]).map((preset) => {
                const selected = draft.observedWhenPreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setDraft((prev) => ({ ...prev, observedWhenPreset: preset }));
                    }}
                    className={`flex items-center gap-3.5 p-5 rounded-2xl border-2 text-left font-bold text-base sm:text-lg transition-all ${
                      selected
                        ? 'border-forest-700 bg-forest-50 text-forest-950'
                        : 'border-earth-200 bg-white text-earth-800 hover:border-forest-300'
                    }`}
                  >
                    <Clock
                      className={`w-6 h-6 shrink-0 ${
                        selected ? 'text-forest-700' : 'text-earth-500'
                      }`}
                    />
                    <span>{WHEN_PRESET_LABELS[preset]}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <label className="block text-sm font-bold text-earth-800 mb-1.5">
                Si recuerdas la fecha aproximada, puedes elegirla aquí (opcional):
              </label>
              <input
                type="date"
                value={draft.observedDate}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, observedDate: e.target.value }))
                }
                className="w-full sm:w-64 px-4 py-3 rounded-xl border border-earth-300 text-base"
              />
            </div>
          </div>
        )}

        {/* PASO 4 */}
        {draft.step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-forest-900">
                4. Cuéntanos qué ocurrió
              </h2>
              <p className="text-sm sm:text-base text-earth-700 mt-1">
                Describe con tus propias palabras lo que observaste.{' '}
                <strong>No necesitas utilizar palabras técnicas.</strong>
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-earth-500">
                Frases de ayuda rápida (toca una para agregarla si te sirve):
              </p>
              <div className="flex flex-wrap gap-2">
                {quickPhrases.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        description: prev.description
                          ? `${prev.description.trim()} ${phrase}`
                          : phrase
                      }))
                    }
                    className="text-xs sm:text-sm px-3 py-1.5 rounded-full bg-earth-100 hover:bg-forest-100 text-earth-800 hover:text-forest-900 font-medium border border-earth-200 transition-colors"
                  >
                    + {phrase}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={5}
              value={draft.description}
              onChange={(e) => {
                setErrorMsg('');
                setDraft((prev) => ({ ...prev, description: e.target.value }));
              }}
              placeholder="Ejemplo: Desde hace tres días el agua de la quebrada baja muy turbia y vimos movimiento de tierra cerca de la playa del río..."
              className="w-full p-4 rounded-2xl border-2 border-earth-300 focus:border-forest-600 text-base leading-relaxed"
            />
          </div>
        )}

        {/* PASO 5 */}
        {draft.step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-forest-900">
                5. ¿Tienes alguna fotografía o evidencia?
              </h2>
              <p className="text-sm text-earth-600 mt-1">
                Este paso es <strong>totalmente opcional</strong>. Si no tienes foto o tu señal de
                internet es lenta, puedes continuar sin adjuntar nada.
              </p>
            </div>

            <label className={`flex flex-col items-center justify-center border-2 border-dashed border-forest-300 bg-forest-50/70 hover:bg-forest-50 rounded-2xl p-8 transition-colors text-center ${draft.photos.length >= MAX_PHOTOS ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <Camera className="w-10 h-10 text-forest-700 mb-2" />
              <span className="font-bold text-base text-forest-900">
                Tocar aquí para elegir o tomar fotos
              </span>
              <span className="text-xs text-earth-600 mt-1">
                Hasta {MAX_PHOTOS} imágenes. Se reducen automáticamente y se eliminan los datos de ubicación de la cámara.
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={draft.photos.length >= MAX_PHOTOS}
                onChange={handlePhotoUpload}
                className="sr-only"
              />
            </label>

            {draft.photos.length > 0 && (
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {draft.photos.map((ph, idx) => (
                  <li key={idx} className="bg-earth-50 border border-earth-200 rounded-2xl p-3 flex flex-col items-center gap-2">
                    <img src={ph.dataUrl} alt={`Vista previa de fotografía ${idx + 1}`} className="w-full h-28 object-cover rounded-xl border border-earth-300" />
                    <p className="text-xs text-earth-600 truncate w-full text-center">{ph.fileName}</p>
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, photos: prev.photos.filter((_, j) => j !== idx) }))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-earth-300 text-xs font-bold text-earth-700 hover:bg-earth-100"
                    >
                      <Trash2 className="w-4 h-4" /> Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* PASO 6 */}
        {draft.step === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-forest-900">
                6. Revisa y envía tu reporte
              </h2>
              <p className="text-sm text-earth-600 mt-1">
                Verifica que la información esté correcta antes de enviarla.
              </p>
            </div>

            {/* Resumen sencillo */}
            <div className="bg-earth-50 rounded-2xl border border-earth-200 p-5 space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-bold uppercase text-earth-500">Situación</span>
                  <p className="font-bold text-forest-900">
                    {draft.category ? CATEGORY_INFO[draft.category].label : 'No especificado'}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase text-earth-500">Ubicación</span>
                  <p className="font-bold text-forest-900">
                    {[draft.department, draft.municipality, draft.community]
                      .filter(Boolean)
                      .join(' · ') || 'Punto marcado en mapa'}
                  </p>
                  {draft.locationDescription && (
                    <p className="text-xs text-earth-600">{draft.locationDescription}</p>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold uppercase text-earth-500">Cuándo ocurrió</span>
                  <p className="font-semibold text-earth-800">
                    {draft.observedWhenPreset
                      ? WHEN_PRESET_LABELS[draft.observedWhenPreset]
                      : 'No indicado'}
                    {draft.observedDate ? ` (${draft.observedDate})` : ''}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase text-earth-500">Fotografía</span>
                  <p className="font-semibold text-earth-800">
                    {draft.photos.length ? `${draft.photos.length} imagen(es) adjunta(s)` : 'Sin fotografía adjunta'}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-earth-200">
                <span className="text-xs font-bold uppercase text-earth-500">Descripción</span>
                <p className="text-earth-800 mt-0.5">{draft.description}</p>
              </div>
            </div>

            {/* Privacidad: Anónimo vs Confidencial */}
            <div className="bg-forest-50 border border-forest-200 rounded-2xl p-5 space-y-3">
              <p className="font-bold text-forest-900 text-sm sm:text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-forest-700" />
                ¿Cómo deseas enviar tu reporte?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    {
                      id: 'anonimo',
                      title: 'Reporte 100% anónimo',
                      desc: 'No guardamos tu nombre ni número. Solo usas tu código para consultar el estado.'
                    },
                    {
                      id: 'confidencial',
                      title: 'Reporte confidencial',
                      desc: 'Puedes dejar un teléfono o correo opcional solo para aclaraciones; nunca se publica.'
                    }
                  ] as { id: ConfidentialityMode; title: string; desc: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, confidentiality: opt.id }))
                    }
                    className={`p-4 rounded-xl border-2 text-left transition-colors ${
                      draft.confidentiality === opt.id
                        ? 'border-forest-700 bg-white'
                        : 'border-transparent bg-white/60 hover:bg-white'
                    }`}
                  >
                    <div className="font-bold text-sm text-forest-950">{opt.title}</div>
                    <div className="text-xs text-earth-600 mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>

              {draft.confidentiality === 'confidencial' && (
                <div className="pt-1">
                  <label className="block text-xs font-bold text-forest-900 mb-1">
                    Teléfono o correo opcional (uso reservado):
                  </label>
                  <input
                    type="text"
                    value={draft.contactInfo}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, contactInfo: e.target.value }))
                    }
                    placeholder="Ej. 7XXXXXXX o correo@ejemplo.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-forest-300 bg-white text-sm"
                  />
                </div>
              )}

              <p className="text-xs text-earth-600">
                <strong>Limitación de reportes anónimos:</strong> si necesitamos precisar la
                ubicación exacta, dejaremos un aviso en tu pantalla de seguimiento para que lo veas
                con tu código, ya que no tendremos cómo llamarte.
              </p>
            </div>
          </div>
        )}

        {/* Botones de navegación del asistente */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-earth-200">
          {draft.step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl border border-earth-300 bg-white hover:bg-earth-100 text-earth-800 font-bold text-base"
            >
              <ArrowLeft className="w-5 h-5" />
              Atrás
            </button>
          ) : (
            <div />
          )}

          {draft.step < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-forest-900 hover:bg-forest-800 text-white font-bold text-base shadow-sm"
            >
              {draft.step === 5 && !draft.photos.length ? 'Continuar sin foto' : 'Siguiente'}
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitFinal}
              disabled={submitting}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-ochre-500 hover:bg-ochre-400 text-forest-950 font-extrabold text-lg shadow-md disabled:opacity-60"
            >
              <Send className="w-5 h-5" />
              {submitting ? 'Enviando…' : 'Enviar mi reporte'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

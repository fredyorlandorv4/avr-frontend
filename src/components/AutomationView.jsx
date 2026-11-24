import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Loader2, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AutomationExceptions from './AutomationExceptions.jsx';

const DAYS = [
  { key: 'statement', label: 'Día de Envío de Estados de Cuenta' },
  { key: 'collection', label: 'Día de Cobro' },
  { key: 'reminder', label: 'Día de Recordatorio' },
];

export default function AutomationView() {
  const { authToken, logout } = useAuth();
  const [days, setDays] = useState({ statement: '', collection: '', reminder: '' });
  const [enabled, setEnabled] = useState({});
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [showExceptions, setShowExceptions] = useState(false);

  const changeDay = useCallback((key, value) => {
    if (value !== '' && (!/^\d{1,2}$/.test(value) || Number(value) < 1 || Number(value) > 31)) return;
    setDays((current) => ({ ...current, [key]: value }));
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch('/api/v1/cobros/automation', { token: authToken, onUnauthorized: logout })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudieron cargar las empresas activas.');
        const data = await response.json();
        const projects = data.companies;
        if (!Array.isArray(projects)) throw new Error('No se pudieron cargar las empresas activas.');
        if (active) {
          setCompanies(projects);
          setDays(Object.fromEntries(DAYS.map(({ key }) => [key, data[`${key}_day`] ?? ''])));
          setEnabled(Object.fromEntries(projects.map((project) => [project.id, Boolean(project.automation_enabled)])));
          setLoaded(true);
          setError('');
        }
      })
      .catch((requestError) => {
        if (active && requestError.message !== 'Unauthorized') setError(requestError.message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authToken, logout, attempt]);

  const reload = () => {
    setLoading(true);
    setLoaded(false);
    setError('');
    setNotice('');
    setAttempt((current) => current + 1);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const body = {
        ...Object.fromEntries(DAYS.map(({ key }) => [`${key}_day`, days[key] === '' ? null : Number(days[key])])),
        companies: companies.map((company) => ({ id: company.id, enabled: Boolean(enabled[company.id]) })),
      };
      const response = await apiFetch('/api/v1/cobros/automation', { method: 'PUT', token: authToken, onUnauthorized: logout, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'No se pudo guardar la automatización.');
      setNotice('Configuración guardada. Se revisará todos los días a las 8:00 a. m., hora de Guatemala.');
    } catch (requestError) {
      if (requestError.message !== 'Unauthorized') setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#053E68]">Automatización</h2>
          <p className="mt-1 text-sm text-slate-500">{showExceptions ? "Clientes de la cartera SAP." : "Define los días y revisa las empresas disponibles."}</p>
        </div>
        <div className="flex items-center gap-3"><button type="button" role="switch" aria-checked={showExceptions} onClick={() => setShowExceptions((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium"><span>Excepciones</span><span className={`relative h-6 w-11 rounded-full transition-colors ${showExceptions ? "bg-[#0B5A8E]" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${showExceptions ? "translate-x-5" : "translate-x-0.5"}`} /></span></button>{!showExceptions && <><button type="button" onClick={reload} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
        <button type="button" onClick={save} disabled={loading || saving || !loaded} className="rounded-lg bg-[#053E68] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar cambios'}</button></>}</div>
      </div>

      <div key={showExceptions ? "exceptions" : "settings"} className="animate-automation-slide">{showExceptions ? <AutomationExceptions /> : <div className="space-y-6">
      <p role="note" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600">
        Revisión diaria a las 8:00 a. m., hora de Guatemala. Si el mes tiene menos días que el configurado, se usará el último día del mes. Los estados de cuenta se envían a todos los clientes de Edificios; cobros y recordatorios, a quienes corresponda en cada cartera.
      </p>
      {notice && <p role="status" className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="automation-days">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-[#0B5A8E]" />
          <h3 id="automation-days" className="font-semibold text-[#053E68]">Días de envío</h3>
        </div>
        <p className="mt-1 text-sm text-slate-500">Selecciona un día del mes entre 1 y 31. Deja el campo vacío para desactivar ese tipo de envío.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {DAYS.map(({ key, label }) => (
            <label key={key} className="block text-sm font-medium text-slate-700">
              {label}
              <input type="number" min="1" max="31" step="1" inputMode="numeric" placeholder="1–31" disabled={loading || saving}
                value={days[key]} onChange={(event) => changeDay(key, event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0B5A8E] focus:ring-2 focus:ring-[#0B5A8E]/15" />
            </label>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="automation-companies">
        <div className="border-b border-slate-100 px-6 py-5">
          <h3 id="automation-companies" className="font-semibold text-[#053E68]">Empresas activas</h3>
          <p className="mt-1 text-sm text-slate-500">Configuraciones activas de mensajería por empresa y proyecto.</p>
        </div>
        {loading ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-[#053E68]" aria-label="Cargando empresas" /></div> :
          loaded && (companies.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>{['Empresa', 'Proyecto', 'Instancia', 'Automatización'].map((label) => <th key={label} scope="col" className="px-6 py-3 font-semibold">{label}</th>)}</tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800">{company.company_name || '—'}</td>
                      <td className="px-6 py-4 text-slate-600">{company.project_name || '—'}</td>
                      <td className="px-6 py-4 text-slate-600">{company.evolution_instance || '—'}</td>
                      <td className="px-6 py-4">
                        <button type="button" role="switch" aria-checked={Boolean(enabled[company.id])}
                          disabled={saving}
                          aria-label={`Automatización de ${company.company_name}, ${company.project_name}`}
                          onClick={() => setEnabled((current) => ({ ...current, [company.id]: !current[company.id] }))}
                          className={`relative h-7 w-12 !p-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B5A8E] ${enabled[company.id] ? 'bg-[#0B5A8E]' : 'bg-slate-300'}`}>
                          <span className="absolute top-0.5 h-6 w-6 rounded-full shadow-sm transition-[left]" style={{ left: enabled[company.id] ? 'calc(100% - 26px)' : '2px', backgroundColor: '#fff' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="p-10 text-center text-sm text-slate-500">No hay empresas activas en la configuración de mensajería.</p>)}
      </section>
      </div>}</div>
      <style>{`@keyframes automation-slide { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: translateX(0); } } @media (prefers-reduced-motion: no-preference) { .animate-automation-slide { animation: automation-slide 220ms ease-out; } }`}</style>
    </div>
  );
}

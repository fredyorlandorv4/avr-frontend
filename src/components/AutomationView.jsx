import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Loader2, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

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
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const changeDay = useCallback((key, value) => {
    if (value !== '' && (!/^\d{1,2}$/.test(value) || Number(value) < 1 || Number(value) > 31)) return;
    setDays((current) => ({ ...current, [key]: value }));
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch('/api/v1/cobros/reminders/projects', { token: authToken, onUnauthorized: logout })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudieron cargar las empresas activas.');
        const data = await response.json();
        const projects = Array.isArray(data) ? data : data?.items || data?.results || data?.data || [];
        if (!Array.isArray(projects)) throw new Error('No se pudieron cargar las empresas activas.');
        if (active) {
          setCompanies(projects.filter((project) => project.active === true || project.active === 1));
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
    setError('');
    setAttempt((current) => current + 1);
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#053E68]">Automatización</h2>
          <p className="mt-1 text-sm text-slate-500">Define los días y revisa las empresas disponibles.</p>
        </div>
        <button type="button" onClick={reload} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      <p role="note" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600">
        Vista preliminar: los valores y switches no se guardan ni activan envíos automáticos.
      </p>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="automation-days">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-[#0B5A8E]" />
          <h3 id="automation-days" className="font-semibold text-[#053E68]">Días de envío</h3>
        </div>
        <p className="mt-1 text-sm text-slate-500">Selecciona un día del mes entre 1 y 31.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {DAYS.map(({ key, label }) => (
            <label key={key} className="block text-sm font-medium text-slate-700">
              {label}
              <input type="number" min="1" max="31" step="1" inputMode="numeric" placeholder="1–31"
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
        {error && <p role="alert" className="m-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-[#053E68]" aria-label="Cargando empresas" /></div> :
          !error && (companies.length ? (
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
    </div>
  );
}

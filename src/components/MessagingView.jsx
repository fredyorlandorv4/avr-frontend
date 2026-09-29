import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const initialForm = { company_name: '', project_name: '', evolution_instance: '', active: true, image: null };
const listFrom = value => Array.isArray(value) ? value : (value?.items || value?.results || value?.data || []);
const valueOf = (object, keys, fallback = '—') => keys.map(key => object?.[key]).find(value => value !== undefined && value !== null && value !== '') ?? fallback;
const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

async function backendError(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  return typeof payload.detail === 'string' ? payload.detail : (typeof payload.message === 'string' ? payload.message : fallback);
}

function ImagePreview({ imageUrl }) {
  const { authToken, logout } = useAuth();
  const [source, setSource] = useState('');
  useEffect(() => {
    let objectUrl;
    let active = true;
    if (!imageUrl) { setSource(''); return undefined; }
    apiFetch(imageUrl, { token: authToken, onUnauthorized: logout }).then(async response => {
      if (!response.ok) return;
      objectUrl = URL.createObjectURL(await response.blob());
      if (active) setSource(objectUrl);
    }).catch(() => { if (active) setSource(''); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [imageUrl, authToken, logout]);
  return source ? <img src={source} alt="Vista previa de imagen bancaria" className="h-12 w-16 rounded border object-cover" /> : <span className="text-gray-400">—</span>;
}

export default function MessagingView() {
  const { authToken, logout } = useAuth();
  const [settings, setSettings] = useState({});
  const [projects, setProjects] = useState([]);
  const [runs, setRuns] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedRuns, setExpandedRuns] = useState(new Set());
  const [deliveries, setDeliveries] = useState({});
  const fileInput = useRef(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [settingsResponse, projectsResponse, runsResponse] = await Promise.all([
        apiFetch('/api/v1/cobros/reminders/settings', { token: authToken, onUnauthorized: logout }),
        apiFetch('/api/v1/cobros/reminders/projects', { token: authToken, onUnauthorized: logout }),
        apiFetch('/api/v1/cobros/reminders/runs', { token: authToken, onUnauthorized: logout }),
      ]);
      if (!settingsResponse.ok) throw new Error(await backendError(settingsResponse, 'No se pudo cargar la configuración.'));
      if (!projectsResponse.ok) throw new Error(await backendError(projectsResponse, 'No se pudieron cargar las configuraciones.'));
      if (!runsResponse.ok) throw new Error(await backendError(runsResponse, 'No se pudo cargar el historial.'));
      const [settingsData, projectsData, runsData] = await Promise.all([settingsResponse.json(), projectsResponse.json(), runsResponse.json()]);
      setSettings(settingsData);
      setProjects(listFrom(projectsData));
      setRuns(listFrom(runsData));
    } catch (requestError) {
      if (requestError.message !== 'Unauthorized') setError(requestError.message);
    } finally { if (!quiet) setLoading(false); }
  }, [authToken, logout]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!runs.some(run => String(valueOf(run, ['status', 'estado'], '')).toLowerCase() === 'running')) return undefined;
    const interval = window.setInterval(() => load(true), 5000);
    return () => window.clearInterval(interval);
  }, [runs, load]);

  const updateEnabled = async enabled => {
    const previous = Boolean(settings.enabled);
    setSettings(current => ({ ...current, enabled }));
    setSaving(true); setError('');
    try {
      const response = await apiFetch('/api/v1/cobros/reminders/settings', { method: 'PATCH', token: authToken, onUnauthorized: logout, body: { enabled } });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        if (response.status === 409) {
          const missing = details.detail?.missing_configuration || details.missing_configuration || [];
          throw new Error(`No se pueden activar los recordatorios: falta configurar ${Array.isArray(missing) && missing.length ? missing.join(', ') : 'proyectos requeridos'}.`);
        }
        throw new Error(typeof details.detail === 'string' ? details.detail : 'No se pudo actualizar la automatización.');
      }
      await load(true);
    } catch (requestError) {
      setSettings(current => ({ ...current, enabled: previous }));
      if (requestError.message !== 'Unauthorized') setError(requestError.message);
    } finally { setSaving(false); }
  };

  const saveProject = async event => {
    event.preventDefault();
    if (!form.image) { setError('La imagen es obligatoria.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(form.image.type) || form.image.size > 5 * 1024 * 1024) { setError('La imagen debe ser JPEG, PNG o WEBP y pesar como máximo 5 MB.'); return; }
    setSaving(true); setError('');
    try {
      const body = new FormData();
      body.append('company_name', form.company_name); body.append('project_name', form.project_name); body.append('evolution_instance', form.evolution_instance); body.append('active', String(form.active)); body.append('image', form.image);
      const response = await apiFetch('/api/v1/cobros/reminders/projects', { method: 'POST', token: authToken, onUnauthorized: logout, body });
      if (!response.ok) throw new Error(await backendError(response, 'No se pudo guardar la configuración.'));
      setForm(initialForm); if (fileInput.current) fileInput.current.value = '';
      await load(true);
    } catch (requestError) { if (requestError.message !== 'Unauthorized') setError(requestError.message); } finally { setSaving(false); }
  };

  const updateProject = async (project, method, body) => {
    setError('');
    try {
      const response = await apiFetch(`/api/v1/cobros/reminders/projects/${project.id}`, { method, token: authToken, onUnauthorized: logout, body });
      if (!response.ok) throw new Error(await backendError(response, method === 'DELETE' ? 'No se pudo eliminar la configuración.' : 'No se pudo actualizar la configuración.'));
      await load(true);
    } catch (requestError) { if (requestError.message !== 'Unauthorized') setError(requestError.message); }
  };

  const toggleRun = async run => {
    const runId = String(valueOf(run, ['id', 'run_id'], ''));
    if (expandedRuns.has(runId)) { setExpandedRuns(current => { const next = new Set(current); next.delete(runId); return next; }); return; }
    setExpandedRuns(current => new Set(current).add(runId));
    if (deliveries[runId]) return;
    try {
      const response = await apiFetch(`/api/v1/cobros/reminders/runs/${runId}/deliveries?limit=200&offset=0`, { token: authToken, onUnauthorized: logout });
      if (!response.ok) throw new Error(await backendError(response, 'No se pudieron cargar las entregas.'));
      const data = await response.json();
      setDeliveries(current => ({ ...current, [runId]: listFrom(data) }));
    } catch (requestError) { if (requestError.message !== 'Unauthorized') setError(requestError.message); }
  };

  return <div className="max-w-[1500px] mx-auto space-y-6">
    <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-[#053E68]">Mensajería</h2><p className="text-sm text-gray-500">Automatización y monitoreo de recordatorios de Carmen.</p></div><button type="button" onClick={() => load()} disabled={loading} className="px-4 py-2 border rounded-lg text-sm disabled:opacity-60"><RefreshCw className={`inline w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Actualizar</button></div>
    {error && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</p>}
    <section className="bg-white p-6 border rounded-xl"><h3 className="font-bold text-[#053E68]">Control de automatización</h3><div className="mt-4 flex justify-between items-center gap-4"><p>Activar recordatorios de Carmen<br /><span className="text-sm text-gray-500">{settings.daily_hour || '—'} ({settings.timezone || '—'})</span></p><input aria-label="Activar recordatorios de Carmen" type="checkbox" checked={Boolean(settings.enabled)} disabled={saving || loading} onChange={event => updateEnabled(event.target.checked)} className="h-5 w-5 accent-[#053E68]" /></div><p className="mt-4 text-sm"><b>Último resultado:</b> {typeof settings.last_run === 'string' ? settings.last_run : settings.last_run ? JSON.stringify(settings.last_run) : 'Aún no hay ejecuciones.'}</p></section>
    <section className="bg-white p-6 border rounded-xl"><h3 className="font-bold text-[#053E68]">Configuración manual por empresa y proyecto</h3><form onSubmit={saveProject} className="grid md:grid-cols-5 gap-3 mt-4"><input required placeholder="Empresa SAP" value={form.company_name} onChange={event => setForm(current => ({ ...current, company_name: event.target.value }))} className="border rounded-lg p-2" /><input required placeholder="Proyecto SAP" value={form.project_name} onChange={event => setForm(current => ({ ...current, project_name: event.target.value }))} className="border rounded-lg p-2" /><input required placeholder="Instancia Evolution" value={form.evolution_instance} onChange={event => setForm(current => ({ ...current, evolution_instance: event.target.value }))} className="border rounded-lg p-2" /><input ref={fileInput} required type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setForm(current => ({ ...current, image: event.target.files?.[0] || null }))} className="text-sm" /><button disabled={saving} className="bg-[#053E68] text-white rounded-lg p-2 disabled:opacity-60">Guardar</button></form><label className="mt-3 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} />Activo</label><div className="overflow-x-auto mt-5"><table className="w-full text-sm"><thead><tr className="text-left border-b">{['Empresa + proyecto', 'Instancia', 'Archivo', 'Estado', 'Vista previa', 'Acciones'].map(header => <th key={header} className="p-3">{header}</th>)}</tr></thead><tbody>{projects.map(project => <tr key={project.id} className="border-b"><td className="p-3">{valueOf(project, ['company_name'])}<br />{valueOf(project, ['project_name'])}</td><td className="p-3">{valueOf(project, ['evolution_instance'])}</td><td className="p-3">{valueOf(project, ['image_filename', 'file_name'], 'Imagen')}</td><td className="p-3">{project.active ? 'Activo' : 'Inactivo'}</td><td className="p-3"><ImagePreview imageUrl={valueOf(project, ['image_url'], '')} /></td><td className="p-3 whitespace-nowrap"><button type="button" onClick={() => updateProject(project, 'PATCH', { active: !project.active })} className="text-[#053E68] mr-3">{project.active ? 'Desactivar' : 'Activar'}</button><button type="button" aria-label="Eliminar configuración" onClick={() => updateProject(project, 'DELETE')} className="text-red-600"><Trash2 className="w-4" /></button></td></tr>)}</tbody></table></div></section>
    <section className="bg-white p-6 border rounded-xl"><h3 className="font-bold text-[#053E68]">Historial de ejecuciones</h3><div className="overflow-x-auto mt-4"><table className="w-full text-sm"><thead><tr className="border-b text-left">{['', 'Fecha consultada', 'Vencimiento objetivo', 'Candidatos', 'Aceptados', 'Fallidos', 'Estado', 'Error general'].map(header => <th key={header} className="p-3">{header}</th>)}</tr></thead><tbody>{runs.map(run => { const runId = String(valueOf(run, ['id', 'run_id'], '')); return <Fragment key={runId}><tr className="border-b"><td className="p-3"><button type="button" aria-label="Ver entregas" onClick={() => toggleRun(run)}>{expandedRuns.has(runId) ? <ChevronDown /> : <ChevronRight />}</button></td><td className="p-3">{valueOf(run, ['queried_at', 'created_at'])}</td><td className="p-3">{valueOf(run, ['target_due_date'])}</td><td className="p-3">{valueOf(run, ['candidates'], 0)}</td><td className="p-3">{valueOf(run, ['accepted'], 0)}</td><td className="p-3">{valueOf(run, ['failed'], 0)}</td><td className="p-3">{valueOf(run, ['status'])}</td><td className="p-3">{valueOf(run, ['error'])}</td></tr>{expandedRuns.has(runId) && <tr><td colSpan="8" className="p-4 bg-gray-50"><table className="w-full text-xs"><thead><tr>{['Cliente', 'Teléfono', 'Empresa + proyecto', 'Instancia', 'Total', 'Lotes', 'Estado', 'Mensaje', 'Error'].map(header => <th key={header} className="p-2 text-left">{header}</th>)}</tr></thead><tbody>{(deliveries[runId] || []).map((delivery, index) => <tr key={delivery.id || index}><td className="p-2">{valueOf(delivery, ['client_name', 'cliente'])}</td><td className="p-2">{valueOf(delivery, ['phone', 'telefono'])}</td><td className="p-2">{valueOf(delivery, ['company_name'])}<br />{valueOf(delivery, ['project_name'])}</td><td className="p-2">{valueOf(delivery, ['evolution_instance'])}</td><td className="p-2">{money.format(Number(valueOf(delivery, ['total'], 0)) || 0)}</td><td className="p-2">{Array.isArray(delivery.lots) ? delivery.lots.join(', ') : valueOf(delivery, ['lotes'])}</td><td className="p-2">{valueOf(delivery, ['status'])}</td><td className="p-2">{valueOf(delivery, ['message', 'generated_message'])}</td><td className="p-2">{valueOf(delivery, ['error'])}</td></tr>)}</tbody></table></td></tr>}</Fragment>; })}</tbody></table></div><p className="text-xs text-gray-500 mt-3">“Aceptado” significa aceptado por Evolution, no confirmación de lectura del cliente.</p></section>
  </div>;
}

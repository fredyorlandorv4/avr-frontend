import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, ChevronDown, ChevronRight, FileImage, RefreshCw, Trash2 } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const initialForm = { company_name: '', project_name: '', evolution_instance: '', active: true, image: null };
const listFrom = value => Array.isArray(value) ? value : (value?.items || value?.results || value?.data || []);
const valueOf = (object, keys, fallback = '—') => keys.map(key => object?.[key]).find(value => value !== undefined && value !== null && value !== '') ?? fallback;
const asBoolean = value => value === true || value === 1 || value === 'true' || value === '1';
const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

async function backendError(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  const detail = typeof payload.detail === 'string' ? payload.detail : payload.message;
  return detail === 'Not Found' ? 'El servicio de recordatorios no está disponible (404).' : (detail || fallback);
}

function ImagePreview({ imageUrl }) {
  const { authToken, logout } = useAuth();
  const [source, setSource] = useState('');
  useEffect(() => {
    let objectUrl; let active = true;
    if (!imageUrl) return undefined;
    apiFetch(imageUrl, { token: authToken, onUnauthorized: logout }).then(async response => {
      if (!response.ok) return;
      objectUrl = URL.createObjectURL(await response.blob());
      if (active) setSource(objectUrl);
    }).catch(() => { if (active) setSource(''); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [imageUrl, authToken, logout]);
  return source ? <img src={source} alt="Vista previa de imagen bancaria" className="h-14 w-20 rounded-lg border border-slate-200 object-cover shadow-sm" /> : <span className="text-slate-400">Sin imagen</span>;
}

function Toggle({ checked, disabled, onChange, label }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-7 w-12 !p-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${checked ? 'bg-[#0B5A8E]' : 'bg-slate-300'}`}><span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200" style={{ left: checked ? 'calc(100% - 26px)' : '2px' }} /></button>;
}

export default function MessagingView() {
  const { authToken, logout } = useAuth();
  const [settings, setSettings] = useState({});
  const [promptEditor, setPromptEditor] = useState({ value: '', dirty: false });
  const [savingPrompt, setSavingPrompt] = useState(false);
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
      setPromptEditor(current => current.dirty ? current : { value: settingsData.message_prompt || '', dirty: false });
      setProjects(listFrom(projectsData)); setRuns(listFrom(runsData));
    } catch (requestError) { if (requestError.message !== 'Unauthorized') setError(requestError.message); } finally { if (!quiet) setLoading(false); }
  }, [authToken, logout]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!runs.some(run => String(valueOf(run, ['status', 'estado'], '')).toLowerCase() === 'running')) return undefined;
    const interval = window.setInterval(() => load(true), 5000);
    return () => window.clearInterval(interval);
  }, [runs, load]);

  const savePrompt = async event => {
    event.preventDefault();
    if (promptEditor.value.length > 4000) { setError('El prompt no puede superar los 4000 caracteres.'); return; }
    setSavingPrompt(true); setError('');
    try {
      const response = await apiFetch('/api/v1/cobros/reminders/settings', {
        method: 'PATCH', token: authToken, onUnauthorized: logout,
        body: { message_prompt: promptEditor.value.trim() || null },
      });
      if (!response.ok) throw new Error(await backendError(response, 'No se pudo guardar el prompt.'));
      const updated = await response.json();
      setSettings(updated);
      setPromptEditor({ value: updated.message_prompt || '', dirty: false });
    } catch (requestError) { if (requestError.message !== 'Unauthorized') setError(requestError.message); }
    finally { setSavingPrompt(false); }
  };

  const saveProject = async event => {
    event.preventDefault();
    if (!form.image) { setError('Selecciona una imagen bancaria para continuar.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(form.image.type) || form.image.size > 5 * 1024 * 1024) { setError('La imagen debe ser JPEG, PNG o WEBP y pesar como máximo 5 MB.'); return; }
    setSaving(true); setError('');
    try {
      const body = new FormData();
      body.append('company_name', form.company_name); body.append('project_name', form.project_name); body.append('evolution_instance', form.evolution_instance); body.append('active', String(form.active)); body.append('image', form.image);
      const response = await apiFetch('/api/v1/cobros/reminders/projects', { method: 'POST', token: authToken, onUnauthorized: logout, body });
      if (!response.ok) throw new Error(await backendError(response, 'No se pudo guardar la configuración.'));
      setForm(initialForm); if (fileInput.current) fileInput.current.value = ''; await load(true);
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
      const data = await response.json(); setDeliveries(current => ({ ...current, [runId]: listFrom(data) }));
    } catch (requestError) { if (requestError.message !== 'Unauthorized') setError(requestError.message); }
  };

  return <div className="mx-auto max-w-[1440px] space-y-6 pb-8">
    <div className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#053E68] to-[#0B5A8E] px-6 py-5 text-white shadow-sm sm:flex-row sm:items-center">
      <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15"><BellRing className="h-6 w-6 text-[#F4CD04]" /></div><div><p className="text-sm font-medium text-blue-100">Gestión de cobros</p><p className="text-lg font-semibold">Recordatorios automáticos de Carmen</p><p className="mt-0.5 text-sm text-blue-100">Configura imágenes e instancias por empresa y proyecto.</p></div></div>
      <button type="button" onClick={() => load()} disabled={loading} className="inline-flex items-center justify-center gap-2 !rounded-xl !border !border-white/25 !bg-white/10 !px-4 !py-2.5 text-sm font-semibold text-white hover:!bg-white/20 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><b>No se pudo cargar Mensajería.</b> {error}</div>}

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <h3 className="font-semibold text-[#053E68]">Prompt del mensaje</h3>
        <p className="mt-1 text-sm text-slate-500">Define la personalidad, el tono y la estructura de los mensajes que genera Carmen.</p>
      </div>
      <form onSubmit={savePrompt} className="space-y-3 px-6 py-5">
        <label htmlFor="message-prompt" className="block text-sm font-medium text-slate-700">Instrucciones para Carmen</label>
        <textarea id="message-prompt" rows={7} maxLength={4000} disabled={loading || savingPrompt}
          value={promptEditor.value}
          onChange={event => setPromptEditor({ value: event.target.value, dirty: true })}
          placeholder="Ej. Usa un tono amable y claro. Saluda al cliente, explica el saldo y cierra con una invitación a comunicarse con nosotros."
          className="w-full rounded-xl border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-[#0B5A8E] focus:ring-2 focus:ring-[#0B5A8E]/15 disabled:bg-slate-50" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{promptEditor.value.length}/4000 caracteres. Si lo dejas vacío, se usa el comportamiento predeterminado.</p>
          <div className="flex items-center gap-3">
            {promptEditor.dirty && <button type="button" onClick={() => setPromptEditor({ value: settings.message_prompt || '', dirty: false })} disabled={savingPrompt} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Descartar cambios</button>}
            <button type="submit" disabled={!promptEditor.dirty || savingPrompt || loading} className="rounded-lg bg-[#053E68] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{savingPrompt ? 'Guardando…' : 'Guardar prompt'}</button>
          </div>
        </div>
      </form>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-6 py-5"><h3 className="font-semibold text-[#053E68]">Configuración por empresa y proyecto</h3><p className="mt-1 text-sm text-slate-500">La misma combinación actualiza la imagen bancaria y la instancia existentes.</p></div><form onSubmit={saveProject} className="m-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:grid-cols-12"><label className="lg:col-span-3"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Empresa SAP</span><input required placeholder="Ej. RV4" value={form.company_name} onChange={event => setForm(current => ({ ...current, company_name: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#0B5A8E] focus:ring-2 focus:ring-[#0B5A8E]/15" /></label><label className="lg:col-span-3"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Proyecto SAP</span><input required placeholder="Ej. Cobros" value={form.project_name} onChange={event => setForm(current => ({ ...current, project_name: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#0B5A8E] focus:ring-2 focus:ring-[#0B5A8E]/15" /></label><label className="lg:col-span-3"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Instancia Evolution</span><input required placeholder="Nombre de instancia" value={form.evolution_instance} onChange={event => setForm(current => ({ ...current, evolution_instance: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#0B5A8E] focus:ring-2 focus:ring-[#0B5A8E]/15" /></label><label className="lg:col-span-3"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Imagen bancaria</span><span className="flex h-[42px] items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 text-sm text-slate-500"><FileImage className="h-4 w-4 text-[#0B5A8E]" /><input ref={fileInput} required type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setForm(current => ({ ...current, image: event.target.files?.[0] || null }))} className="min-w-0 text-xs file:mr-2 file:border-0 file:bg-transparent file:font-medium file:text-[#053E68]" /></span></label><div className="flex items-center justify-between gap-4 lg:col-span-12"><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.active} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} className="h-4 w-4 rounded accent-[#0B5A8E]" />Configuración activa</label><button disabled={saving} className="!rounded-lg !bg-[#053E68] !px-5 !py-2.5 text-sm font-semibold text-white hover:!bg-[#0B5A8E] disabled:opacity-60">Guardar configuración</button></div></form><div className="overflow-x-auto px-5 pb-5"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">{['Empresa + proyecto', 'Instancia', 'Archivo', 'Estado', 'Vista previa', 'Acciones'].map(header => <th key={header} className="px-3 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{projects.map(project => <tr key={project.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50"><td className="px-3 py-3 font-medium text-slate-800">{valueOf(project, ['company_name'])}<span className="mx-1.5 text-slate-300">/</span>{valueOf(project, ['project_name'])}</td><td className="px-3 py-3 text-slate-600">{valueOf(project, ['evolution_instance'])}</td><td className="px-3 py-3 text-slate-600">{valueOf(project, ['image_filename', 'file_name'], 'Imagen')}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${asBoolean(project.active) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{asBoolean(project.active) ? 'Activa' : 'Inactiva'}</span></td><td className="px-3 py-3"><ImagePreview key={valueOf(project, ['image_url'], '')} imageUrl={valueOf(project, ['image_url'], '')} /></td><td className="px-3 py-3"><div className="flex items-center gap-3"><Toggle label={asBoolean(project.active) ? 'Desactivar configuración' : 'Activar configuración'} checked={asBoolean(project.active)} onChange={active => updateProject(project, 'PATCH', { active })} /><button type="button" aria-label="Eliminar configuración" onClick={() => updateProject(project, 'DELETE')} className="!p-2 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}{!loading && projects.length === 0 && <tr><td colSpan="6" className="px-3 py-10 text-center text-slate-500">Aún no hay configuraciones registradas.</td></tr>}</tbody></table></div></section>

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h3 className="font-semibold text-[#053E68]">Historial de ejecuciones</h3><p className="mt-1 text-sm text-slate-500">Consulta el resultado de cada proceso y sus entregas.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{runs.length} registros</span></div><div className="overflow-x-auto px-5 pb-3"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">{['', 'Fecha consultada', 'Vencimiento', 'Candidatos', 'Aceptados', 'Fallidos', 'Estado', 'Error general'].map(header => <th key={header} className="px-3 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{runs.map(run => { const runId = String(valueOf(run, ['id', 'run_id'], '')); const status = valueOf(run, ['status'], '—'); return <Fragment key={runId}><tr className="border-b border-slate-100 hover:bg-slate-50"><td className="px-3 py-3"><button type="button" aria-label="Ver entregas" onClick={() => toggleRun(run)} className="!p-1.5 text-[#0B5A8E] hover:bg-blue-50">{expandedRuns.has(runId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td><td className="px-3 py-3 text-slate-600">{valueOf(run, ['queried_at', 'created_at'])}</td><td className="px-3 py-3 text-slate-600">{valueOf(run, ['target_due_date'])}</td><td className="px-3 py-3">{valueOf(run, ['candidates'], 0)}</td><td className="px-3 py-3 text-emerald-700">{valueOf(run, ['accepted'], 0)}</td><td className="px-3 py-3 text-red-600">{valueOf(run, ['failed'], 0)}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{status}</span></td><td className="px-3 py-3 text-slate-500">{valueOf(run, ['error'])}</td></tr>{expandedRuns.has(runId) && <tr><td colSpan="8" className="bg-slate-50 p-4"><div className="rounded-xl border border-slate-200 bg-white p-3"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Entregas de esta ejecución</p><table className="w-full text-xs"><thead><tr className="text-left text-slate-500">{['Cliente', 'Teléfono', 'Empresa + proyecto', 'Instancia', 'Total', 'Lotes', 'Estado', 'Mensaje', 'Error'].map(header => <th key={header} className="p-2 font-semibold">{header}</th>)}</tr></thead><tbody>{(deliveries[runId] || []).map((delivery, index) => <tr key={delivery.id || index} className="border-t border-slate-100"><td className="p-2">{valueOf(delivery, ['client_name', 'cliente'])}</td><td className="p-2">{valueOf(delivery, ['phone', 'telefono'])}</td><td className="p-2">{valueOf(delivery, ['company_name'])} / {valueOf(delivery, ['project_name'])}</td><td className="p-2">{valueOf(delivery, ['evolution_instance'])}</td><td className="p-2">{money.format(Number(valueOf(delivery, ['total'], 0)) || 0)}</td><td className="p-2">{Array.isArray(delivery.lots) ? delivery.lots.join(', ') : valueOf(delivery, ['lotes'])}</td><td className="p-2">{valueOf(delivery, ['status'])}</td><td className="p-2">{valueOf(delivery, ['message', 'generated_message'])}</td><td className="p-2">{valueOf(delivery, ['error'])}</td></tr>)}</tbody></table></div></td></tr>}</Fragment>; })}{!loading && runs.length === 0 && <tr><td colSpan="8" className="px-3 py-10 text-center text-slate-500">Aún no hay ejecuciones registradas.</td></tr>}</tbody></table></div><p className="px-6 pb-5 text-xs text-slate-500">“Aceptado” indica que Evolution aceptó el envío; no confirma que el cliente lo haya leído.</p></section>
  </div>;
}

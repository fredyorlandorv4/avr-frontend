import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, RefreshCw, X } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const todayInGuatemala = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const keyOf = (company, project) => `${String(company || '').trim().toLowerCase()}|${String(project || '').trim().toLowerCase()}`;
const lotsOf = delivery => (Array.isArray(delivery.lotes) ? delivery.lotes : []).map(lot => typeof lot === 'string' ? lot : lot?.lote).filter(Boolean).join(', ') || '—';

function statusOf(delivery) {
  const status = String(delivery.status || '').toLowerCase();
  if (status === 'accepted' || status === 'sent') return { label: 'Enviados', className: 'bg-emerald-100 text-emerald-800' };
  if (status === 'sending' || status === 'processing' || (status === 'pending' && Number(delivery.attempts) > 0)) return { label: 'Enviando', className: 'bg-blue-100 text-blue-800' };
  if (status === 'pending' || status === 'scheduled' || status === 'queued') return { label: 'Programado', className: 'bg-amber-100 text-amber-800' };
  if (status === 'failed') return { label: 'Fallido', className: 'bg-red-100 text-red-800' };
  return { label: status || '—', className: 'bg-slate-100 text-slate-700' };
}

function MessageDetail({ delivery, imageUrl, onClose }) {
  const { authToken, logout } = useAuth();
  const [imageSource, setImageSource] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!imageUrl) return undefined;
    let active = true;
    let objectUrl;
    apiFetch(imageUrl, { token: authToken, onUnauthorized: logout }).then(async response => {
      if (!response.ok) { if (active) setImageFailed(true); return; }
      objectUrl = URL.createObjectURL(await response.blob());
      if (active) setImageSource(objectUrl);
    }).catch(() => { if (active) setImageFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [imageUrl, authToken, logout]);

  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="message-detail-title" className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
        <div><h2 id="message-detail-title" className="text-xl font-bold text-[#053E68]">Mensaje para {delivery.nombre_cliente}</h2><p className="mt-1 text-sm text-slate-500">{delivery.proyecto} · {lotsOf(delivery)}</p></div>
        <button type="button" onClick={onClose} aria-label="Cerrar mensaje" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </header>
      <div className="grid gap-5 overflow-y-auto p-6 md:grid-cols-[220px_1fr]">
        <div>{imageSource ? <img src={imageSource} alt="Imagen configurada para el recordatorio" className="max-h-72 w-full rounded-lg border border-slate-200 bg-white object-contain" /> : <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">{imageUrl && !imageFailed ? 'Cargando imagen…' : 'Imagen no disponible'}</div>}</div>
        <div className="min-w-0"><h3 className="mb-2 text-sm font-semibold text-slate-700">Mensaje completo</h3><div className="min-h-48 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">{delivery.message || 'El mensaje todavía no ha sido generado.'}</div></div>
      </div>
    </div>
  </div>, document.body);
}

export default function MessagingQueueView() {
  const { authToken, logout } = useAuth();
  const [run, setRun] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestInFlight = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (!authToken || requestInFlight.current) return;
    requestInFlight.current = true;
    if (!quiet) setLoading(true);
    try {
      const [runsResponse, projectsResponse] = await Promise.all([
        apiFetch('/api/v1/cobros/reminders/runs', { token: authToken, onUnauthorized: logout }),
        apiFetch('/api/v1/cobros/reminders/projects', { token: authToken, onUnauthorized: logout }),
      ]);
      if (!runsResponse.ok || !projectsResponse.ok) throw new Error('No se pudieron consultar los mensajes programados.');
      const [runs, configuredProjects] = await Promise.all([runsResponse.json(), projectsResponse.json()]);
      const todayRun = (Array.isArray(runs) ? runs : []).find(item => item.run_date === todayInGuatemala()) || null;
      const todayDeliveries = [];
      if (todayRun) {
        let offset = 0;
        while (true) {
          const response = await apiFetch(`/api/v1/cobros/reminders/runs/${todayRun.id}/deliveries?limit=500&offset=${offset}`, { token: authToken, onUnauthorized: logout });
          if (!response.ok) throw new Error('No se pudieron cargar las entregas de hoy.');
          const page = await response.json();
          todayDeliveries.push(...page);
          if (page.length < 500) break;
          offset += page.length;
        }
      }
      setRun(todayRun);
      setDeliveries(todayDeliveries);
      setProjects(Array.isArray(configuredProjects) ? configuredProjects : []);
      setError('');
    } catch (requestError) {
      if (requestError.message !== 'Unauthorized') setError(requestError.message || 'No se pudieron cargar los mensajes.');
    } finally { requestInFlight.current = false; if (!quiet) setLoading(false); }
  }, [authToken, logout]);

  useEffect(() => {
    load();
    const interval = window.setInterval(() => load(true), 5000);
    return () => window.clearInterval(interval);
  }, [load]);

  const imagesByProject = useMemo(() => new Map(projects.map(project => [keyOf(project.company_name, project.project_name), project.image_url])), [projects]);
  const imageUrl = selected ? imagesByProject.get(keyOf(selected.empresa, selected.proyecto)) : null;
  const closeDetail = useCallback(() => setSelected(null), []);

  return <div className="mx-auto max-w-[1440px] space-y-5 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#053E68] to-[#0B5A8E] px-6 py-5 text-white shadow-sm">
      <div className="flex items-center gap-4"><div className="rounded-xl bg-white/15 p-3"><MessageSquare className="h-6 w-6 text-[#F4CD04]" /></div><div><h2 className="text-xl font-semibold">Mensajería de hoy</h2><p className="mt-1 text-sm text-blue-100">Mensajes del {todayInGuatemala()} · actualización automática cada 5 segundos</p></div></div>
      <button type="button" onClick={() => load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>
    </div>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-6 py-4"><div><h3 className="font-semibold text-[#053E68]">Mensajes programados y enviados</h3><p className="mt-1 text-sm text-slate-500">Doble clic en un mensaje para ver el texto completo y la imagen.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{deliveries.length} registros</span></div>
      {run?.status === 'running' && run.candidates > deliveries.length && <p className="border-b border-amber-100 bg-amber-50 px-6 py-3 text-sm text-amber-800">La ejecución sigue preparando mensajes: {deliveries.length} de {run.candidates} candidatos tienen registro todavía.</p>}
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] table-fixed text-left text-sm"><colgroup><col className="w-[21%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[31%]" /><col className="w-[12%]" /></colgroup><thead className="bg-[#053E68] text-white"><tr>{['Cliente', 'Proyecto', 'Lote', 'Mensaje', 'Status'].map(header => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
        {loading ? <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-500">Cargando mensajes…</td></tr> : deliveries.length ? deliveries.map(delivery => {
          const status = statusOf(delivery);
          return <tr key={delivery.id} className="hover:bg-slate-50"><td className="truncate px-4 py-3 font-medium text-slate-800" title={delivery.nombre_cliente}>{delivery.nombre_cliente || '—'}</td><td className="truncate px-4 py-3 text-slate-700" title={delivery.proyecto}>{delivery.proyecto || '—'}</td><td className="truncate px-4 py-3 text-slate-700" title={lotsOf(delivery)}>{lotsOf(delivery)}</td><td className="px-4 py-3"><button type="button" onDoubleClick={() => setSelected(delivery)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(delivery); } }} title="Doble clic para ver el mensaje completo" className="block w-full min-w-0 truncate rounded px-1 py-1 text-left text-slate-700 hover:bg-blue-50 hover:text-[#053E68]">{delivery.message || 'Mensaje aún no generado'}</button></td><td className="px-4 py-3"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span></td></tr>;
        }) : <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-500">{run ? 'La ejecución de hoy aún no tiene mensajes registrados.' : 'Los mensajes aparecerán cuando comience la ejecución diaria.'}</td></tr>}
      </tbody></table></div>
    </section>
    {selected && <MessageDetail delivery={selected} imageUrl={imageUrl} onClose={closeDetail} />}
  </div>;
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bot, CheckCircle2, Clock3, FileText, Loader2, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';
import TranscriptionModal from './TranscriptionModal.jsx';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;

const asList = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const textOf = (value) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value?.detail || value?.text || value?.content || value?.summary || value?.description || '';
};

function AnalysisSection({ title, items, tone = 'blue', collapsible = false }) {
  const entries = asList(items);
  if (!entries.length) return null;
  const tones = { blue: 'border-blue-100 bg-blue-50 text-blue-900', green: 'border-green-100 bg-green-50 text-green-900', orange: 'border-orange-100 bg-orange-50 text-orange-900', gray: 'border-gray-200 bg-gray-50 text-gray-800' };
  const content = <div className="space-y-3">{entries.map((entry, index) => {
      const object = entry && typeof entry === 'object' && !Array.isArray(entry);
      const detail = textOf(entry);
      const entryTitle = object ? entry.title || entry.name || '' : '';
      const priority = object ? entry.priority : null;
      const evidence = object ? asList(entry.evidence_call_ids).filter(Boolean) : [];
      return <div key={`${entryTitle || detail}-${index}`} className="text-sm leading-relaxed">
        {entryTitle && <p className="font-medium">{entryTitle}</p>}
        {detail && <p className={entryTitle ? 'mt-1 opacity-90' : ''}>{detail}</p>}
        {(priority || evidence.length > 0) && <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {priority && <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium">Prioridad: {priority}</span>}
          {evidence.map((callId) => <span key={callId} className="rounded-full bg-white/70 px-2 py-0.5">Llamada #{callId}</span>)}
        </div>}
      </div>;
    })}</div>;
  if (collapsible) return <details className={`group rounded-xl border ${tones[tone]}`}>
    <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold"><span>{title}</span><span className="ml-auto text-xs font-normal opacity-70 group-open:hidden">Ver</span><span className="ml-auto hidden text-xs font-normal opacity-70 group-open:inline">Ocultar</span></summary>
    <div className="border-t border-current/10 px-4 pb-4">{content}</div>
  </details>;
  return <section className={`rounded-xl border p-4 ${tones[tone]}`}><h4 className="mb-3 text-sm font-semibold">{title}</h4>{content}</section>;
}

function StatusBadge({ status }) {
  if (status === 'completed') return <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"><CheckCircle2 className="w-3.5 h-3.5" />Completado</span>;
  if (status === 'pending') return <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700"><Loader2 className="w-3.5 h-3.5 animate-spin" />En proceso</span>;
  if (status === 'failed') return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"><AlertCircle className="w-3.5 h-3.5" />Error</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"><Clock3 className="w-3.5 h-3.5" />Sin reporte</span>;
}

export default function CallImprovementAnalysisView() {
  const { authToken, logout } = useAuth();
  const [cards, setCards] = useState([]);
  const [callLimit, setCallLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [error, setError] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);
  const pollStartedAt = useRef(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!authToken) return;
    if (!silent) setLoading(true);
    try {
      const response = await apiFetch('/api/v1/agents/improvement-analysis', { token: authToken, onUnauthorized: logout });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `No se pudo cargar el análisis (${response.status}).`);
      }
      const data = await response.json();
      setCards(Array.isArray(data?.cards) ? data.cards : []);
      setCallLimit(Number.isFinite(data?.call_limit) ? data.call_limit : 10);
      setError('');
    } catch (err) {
      if (err.message !== 'Unauthorized') setError(err.message || 'Error de red al cargar los análisis.');
    } finally { if (!silent) setLoading(false); }
  }, [authToken, logout]);

  useEffect(() => { load(); }, [load]);
  const hasPending = useMemo(() => cards.some((card) => card?.report?.status === 'pending'), [cards]);

  useEffect(() => {
    if (!hasPending) { pollStartedAt.current = null; return undefined; }
    if (pollStartedAt.current == null) pollStartedAt.current = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - pollStartedAt.current >= POLL_TIMEOUT_MS) {
        window.clearInterval(timer);
        setError('Tiempo agotado: el análisis tardó más de 2 minutos. Actualiza la pantalla o intenta nuevamente.');
        return;
      }
      load({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasPending, load]);

  const enqueue = useCallback(async (body, agentId = null) => {
    agentId == null ? setGenerating(true) : setRetryingId(agentId);
    setError('');
    pollStartedAt.current = Date.now();
    try {
      const response = await apiFetch('/api/v1/agents/improvement-analysis', { method: 'POST', token: authToken, onUnauthorized: logout, body });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `No se pudo encolar el análisis (${response.status}).`);
      }
      await load({ silent: true });
    } catch (err) {
      if (err.message !== 'Unauthorized') setError(err.message || 'Error de red al encolar el análisis.');
    } finally { agentId == null ? setGenerating(false) : setRetryingId(null); }
  }, [authToken, logout, load]);

  return <div className="max-w-[1280px] mx-auto space-y-6">
    <TranscriptionModal show={Boolean(selectedCall)} call={selectedCall} onClose={() => setSelectedCall(null)} />
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div className="flex items-center gap-2"><span className="w-1 h-9 bg-[#F4CD04] rounded-full" /><div><h2 className="text-xl font-bold text-[#053E68] leading-tight">Análisis de llamadas</h2><p className="text-sm text-gray-400 mt-0.5">{cards.length} agente{cards.length !== 1 ? 's' : ''} · hasta {callLimit} llamadas por agente</p></div></div><div className="flex flex-wrap gap-2"><button onClick={() => load()} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button><button onClick={() => enqueue({})} disabled={generating || hasPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#053E68] text-white hover:bg-[#06497c] text-sm font-medium disabled:opacity-50">{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}Generar análisis</button></div></div>
    {hasPending && <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"><Loader2 className="w-4 h-4 animate-spin" />Actualizando los análisis en proceso cada 3 segundos.</div>}
    {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
    {loading && cards.length === 0 ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#053E68]" /></div> : cards.length === 0 ? <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm"><Bot className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="font-medium text-gray-600">No hay agentes para analizar</p></div> : <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">{cards.map((card) => <AgentCard key={card.agent_id} card={card} callLimit={callLimit} retryingId={retryingId} onRetry={enqueue} onSelectCall={setSelectedCall} />)}</div>}
  </div>;
}

function AgentCard({ card, callLimit, retryingId, onRetry, onSelectCall }) {
  const report = card?.report;
  const status = report?.status;
  const pending = status === 'pending';
  const result = report?.result;
  const completedCalls = asList(card?.calls).filter((call) => String(call?.status || '').toLowerCase() === 'completed');
  const canRetry = !pending && (status === 'failed' || (report && result == null) || report?.current === false);
  return <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-5">
    <header className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="rounded-xl bg-[#053E68]/5 p-2.5"><Bot className="w-5 h-5 text-[#053E68]" /></span><div className="min-w-0"><h3 className="truncate font-bold text-[#053E68]">{card.agent_name || `Agente ${card.agent_id}`}</h3><p className="text-xs text-gray-400">ID: {card.agent_id}</p></div></div><StatusBadge status={status} /></header>
    {report?.current === false && <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">El prompt o las llamadas cambiaron; este análisis puede estar desactualizado.</div>}
    {canRetry && <div className="flex justify-end"><button type="button" onClick={() => onRetry({ agent_ids: [card.agent_id], force: true }, card.agent_id)} disabled={retryingId === card.agent_id} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#053E68] hover:text-[#06497c] disabled:opacity-50"><RotateCcw className={`w-3.5 h-3.5 ${retryingId === card.agent_id ? 'animate-spin' : ''}`} />{status === 'failed' || result == null ? 'Reintentar' : 'Regenerar'}</button></div>}
    {card.prompt && <details className="group rounded-xl border border-gray-100 bg-gray-50"><summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold text-gray-700"><FileText className="w-4 h-4 text-[#053E68]" />Prompt utilizado<span className="ml-auto text-xs font-normal text-gray-400 group-open:hidden">Ver</span><span className="ml-auto hidden text-xs font-normal text-gray-400 group-open:inline">Ocultar</span></summary><pre className="max-h-64 overflow-y-auto border-t border-gray-100 px-3 py-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-600">{card.prompt}</pre></details>}
    <details className="group rounded-xl border border-gray-100 bg-gray-50"><summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold text-gray-700"><FileText className="w-4 h-4 text-[#053E68]" />Llamadas ({completedCalls.length}/{callLimit})<span className="ml-auto text-xs font-normal text-gray-400 group-open:hidden">Ver</span><span className="ml-auto hidden text-xs font-normal text-gray-400 group-open:inline">Ocultar</span></summary>{completedCalls.length ? <div className="space-y-2 border-t border-gray-100 p-3">{completedCalls.map((call, index) => <button key={call.id || index} type="button" onClick={() => onSelectCall(call)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-left text-sm text-gray-600 transition hover:border-[#053E68]/20 hover:bg-[#053E68]/5"><span className="font-medium text-[#053E68]">Llamada {index + 1}</span><span className="truncate text-xs text-gray-400">{call.created_at ? new Date(call.created_at).toLocaleString('es-GT') : 'Sin fecha'}</span></button>)}</div> : <p className="border-t border-gray-100 p-3 text-sm text-gray-400">No hay llamadas completadas disponibles.</p>}</details>
    {!report ? <p className="text-sm text-gray-500">No hay llamadas completadas disponibles para analizar.</p> : pending ? <div className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800"><Loader2 className="w-4 h-4 animate-spin" />Análisis en proceso</div> : status === 'failed' || result == null ? <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><p className="font-semibold">No se pudo generar el análisis.</p>{report.error_message && <p className="mt-1 text-xs">{report.error_message}</p>}</div> : status === 'completed' ? <div className="space-y-3">{result.summary && <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><h4 className="mb-2 font-semibold">Resumen</h4><p className="leading-relaxed">{textOf(result.summary)}</p></section>}<AnalysisSection title="Puntos buenos" items={result.strengths} tone="green" collapsible /><AnalysisSection title="Puntos a mejorar" items={result.improvements} tone="orange" collapsible /><AnalysisSection title="Mejoras sugeridas para el prompt" items={result.prompt_improvements} tone="blue" collapsible /><AnalysisSection title="Observaciones de llamadas" items={result.call_observations} tone="gray" collapsible /><AnalysisSection title="Notas sobre calidad de datos" items={result.data_quality_notes} tone="gray" /></div> : <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><p className="font-semibold">No se pudo generar el análisis.</p>{report.error_message && <p className="mt-1 text-xs">{report.error_message}</p>}</div>}
  </article>;
}

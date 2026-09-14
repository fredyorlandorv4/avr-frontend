import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Bot, CheckCircle2, Clock3, FileText, Loader2,
  RefreshCw, RotateCcw, Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';

const POLL_MS = 5000;
const COMPLETE_STATUSES = new Set(['completed', 'complete', 'done', 'ready', 'success', 'succeeded']);
const PENDING_STATUSES = new Set(['pending', 'queued', 'processing', 'running', 'in_progress', 'started']);

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function getCards(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.cards || payload?.items || payload?.agents || payload?.results || payload?.data || [];
}

function getReport(card) {
  return card?.report || card?.improvement_analysis || card?.improvement_report || card?.analysis_report || card?.analysis || {};
}

function getAgent(card) {
  return card?.agent || card?.agent_data || card;
}

function statusFor(card) {
  const report = getReport(card);
  return String(report?.status || card?.report_status || card?.status || 'not_generated').toLowerCase();
}

function readableStatus(status) {
  const labels = {
    completed: 'Completado', complete: 'Completado', done: 'Completado', ready: 'Completado', success: 'Completado', succeeded: 'Completado',
    pending: 'Pendiente', queued: 'En cola', processing: 'Analizando', running: 'Analizando', in_progress: 'Analizando', started: 'Analizando',
    not_generated: 'Sin generar', failed: 'Error', error: 'Error',
  };
  return labels[status] || status.replaceAll('_', ' ');
}

function textOf(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') return value.text || value.content || value.summary || value.transcription || value.descripcion || '';
  return '';
}

function AnalysisSection({ title, items, tone = 'blue' }) {
  const values = asList(items).map(textOf).filter(Boolean);
  if (!values.length) return null;
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-900',
    green: 'border-green-100 bg-green-50 text-green-900',
    orange: 'border-orange-100 bg-orange-50 text-orange-900',
  };
  return (
    <section className={`rounded-xl border p-4 ${tones[tone]}`}>
      <h4 className="font-semibold text-sm mb-2">{title}</h4>
      <ul className="list-disc list-inside space-y-1.5 text-sm leading-relaxed">
        {values.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </section>
  );
}

function StatusBadge({ status }) {
  const complete = COMPLETE_STATUSES.has(status);
  const pending = PENDING_STATUSES.has(status);
  const className = complete
    ? 'bg-green-50 text-green-700'
    : pending ? 'bg-yellow-50 text-yellow-700' : status === 'failed' || status === 'error'
      ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {complete ? <CheckCircle2 className="w-3.5 h-3.5" /> : pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock3 className="w-3.5 h-3.5" />}
      {readableStatus(status)}
    </span>
  );
}

export default function CallImprovementAnalysisView() {
  const { authToken, logout } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!authToken) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/v1/agents/improvement-analysis', { token: authToken, onUnauthorized: logout });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'No se pudo cargar el análisis de llamadas.');
      }
      setCards(getCards(await response.json()));
    } catch (err) {
      if (err.message !== 'Unauthorized') setError(err.message || 'Error de conexión al cargar los análisis.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [authToken, logout]);

  useEffect(() => { load(); }, [load]);

  const hasPending = useMemo(
    () => cards.some((card) => PENDING_STATUSES.has(statusFor(card))),
    [cards],
  );

  useEffect(() => {
    if (!hasPending) return undefined;
    const timer = window.setInterval(() => load({ silent: true }), POLL_MS);
    return () => window.clearInterval(timer);
  }, [hasPending, load]);

  const requestAnalysis = useCallback(async (body, agentId = null) => {
    agentId == null ? setGenerating(true) : setRegeneratingId(agentId);
    setError('');
    try {
      const response = await apiFetch('/api/v1/agents/improvement-analysis', {
        method: 'POST', token: authToken, onUnauthorized: logout, body,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'No se pudo encolar el análisis.');
      }
      await load({ silent: true });
    } catch (err) {
      if (err.message !== 'Unauthorized') setError(err.message || 'Error de conexión al generar el análisis.');
    } finally {
      agentId == null ? setGenerating(false) : setRegeneratingId(null);
    }
  }, [authToken, logout, load]);

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-9 bg-[#F4CD04] rounded-full" />
          <div>
            <h2 className="text-xl font-bold text-[#053E68] leading-tight">Análisis de llamadas</h2>
            <p className="text-sm text-gray-400 mt-0.5">{cards.length} agente{cards.length !== 1 ? 's' : ''} · últimas 10 llamadas por agente</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => load()} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          <button onClick={() => requestAnalysis({})} disabled={generating} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#053E68] text-white hover:bg-[#06497c] text-sm font-medium disabled:opacity-50">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generar análisis
          </button>
        </div>
      </div>

      {hasPending && <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"><Loader2 className="w-4 h-4 animate-spin" /> Actualizando automáticamente mientras se generan los reportes.</div>}
      {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

      {loading && cards.length === 0 ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#053E68]" /></div>
      ) : cards.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm"><Bot className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="font-medium text-gray-600">No hay agentes para analizar</p></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {cards.map((card, index) => {
            const agent = getAgent(card);
            const report = getReport(card);
            const agentId = agent?.id ?? card?.agent_id ?? card?.id;
            const status = statusFor(card);
            const transcripts = asList(card?.transcriptions || card?.last_transcriptions || card?.calls || report?.transcriptions).slice(0, 10);
            const prompt = agent?.prompt || card?.prompt || report?.prompt;
            const strengths = report?.strengths || report?.good_points || report?.puntos_buenos || report?.positive_points;
            const improvements = report?.areas_for_improvement || report?.improvement_points || report?.puntos_a_mejorar || report?.weaknesses;
            const promptImprovements = report?.prompt_improvements || report?.prompt_improvement || report?.mejoras_prompt || report?.prompt_suggestions;
            return (
              <article key={agentId ?? index} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-5">
                <header className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0"><span className="p-2.5 rounded-xl bg-[#053E68]/5"><Bot className="w-5 h-5 text-[#053E68]" /></span><div className="min-w-0"><h3 className="font-bold text-[#053E68] truncate">{agent?.nombre || agent?.name || agent?.agent_name || `Agente ${agentId ?? ''}`}</h3><p className="text-xs text-gray-400 truncate">{agent?.agent_id || agent?.area || 'Agente configurado'}</p></div></div>
                  <StatusBadge status={status} />
                </header>

                <div className="flex justify-end"><button onClick={() => requestAnalysis({ agent_ids: [agentId], force: true }, agentId)} disabled={!agentId || regeneratingId === agentId} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#053E68] hover:text-[#06497c] disabled:opacity-50"><RotateCcw className={`w-3.5 h-3.5 ${regeneratingId === agentId ? 'animate-spin' : ''}`} /> Regenerar</button></div>

                {prompt && <section><h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2"><FileText className="w-4 h-4 text-[#053E68]" /> Prompt utilizado</h4><pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">{prompt}</pre></section>}

                <section><h4 className="text-sm font-semibold text-gray-700 mb-2">Últimas transcripciones ({transcripts.length}/10)</h4>{transcripts.length ? <div className="space-y-2">{transcripts.map((transcript, i) => <details key={transcript?.id ?? i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><summary className="cursor-pointer text-sm text-gray-600">Llamada {i + 1}{transcript?.created_at ? ` · ${new Date(transcript.created_at).toLocaleString('es-GT')}` : ''}</summary><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-600">{textOf(transcript) || 'Transcripción no disponible.'}</p></details>)}</div> : <p className="text-sm text-gray-400">No hay transcripciones disponibles.</p>}</section>

                {COMPLETE_STATUSES.has(status) ? <div className="space-y-3"><AnalysisSection title="Puntos buenos" items={strengths} tone="green" /><AnalysisSection title="Puntos a mejorar" items={improvements} tone="orange" /><AnalysisSection title="Mejoras sugeridas para el prompt" items={promptImprovements} tone="blue" />{!asList(strengths).length && !asList(improvements).length && !asList(promptImprovements).length && <p className="text-sm text-gray-400">El reporte está completado, pero no incluye recomendaciones.</p>}</div> : <p className="text-sm text-gray-400">{PENDING_STATUSES.has(status) ? 'La IA está preparando el reporte.' : 'Genera el análisis para obtener recomendaciones de la IA.'}</p>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, ComposedChart, Area,
} from 'recharts';
import { RefreshCw, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';

// ─── Colores ──────────────────────────────────────────────────
const C = {
  effective:   '#1D9E75',
  ineffective: '#E24B4A',
  total:       '#053E68',  // azul marca
  amber:       '#BA7517',
  blue2:       '#B5D4F4',
  accent:      '#F4CD04',  // amarillo marca
};

// ─── Helpers ──────────────────────────────────────────────────
function fmtDuration(sec) {
  if (sec == null || sec === 0) return '—';
  if (sec < 60) return `${Number(sec).toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function effBadge(pct) {
  if (pct >= 75) return { bg: '#E1F5EE', color: '#0F6E56', label: 'Alto' };
  if (pct >= 40) return { bg: '#FAEEDA', color: '#854F0B', label: 'Medio' };
  if (pct > 0)   return { bg: '#FCEBEB', color: '#A32D2D', label: 'Bajo' };
  return { bg: '#f0f0f0', color: '#888', label: 'Sin datos' };
}

function buildQuery(params) {
  const q = new URLSearchParams();
  if (params.dateFrom) q.set('date_from', params.dateFrom);
  if (params.dateTo)   q.set('date_to',   params.dateTo);
  if (params.userId)   q.set('user_id',   params.userId);
  const str = q.toString();
  return str ? `?${str}` : '';
}

// ─── Section card ─────────────────────────────────────────────
function Section({ title, children, className = '' }) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl p-4 lg:p-5 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1 h-4 bg-[#F4CD04] rounded-full" />
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────
const KPI_COLORS = { green: C.effective, red: C.ineffective, blue: C.total, amber: C.amber };

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p
        className="text-2xl font-semibold leading-none tabular-nums"
        style={{ color: accent ? KPI_COLORS[accent] : '#053E68' }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Tabla de agentes ─────────────────────────────────────────
function AgentTable({ agents }) {
  if (!agents.length) return <p className="text-gray-400 text-sm py-4">Sin datos de agentes</p>;

  const headers = ['Agente', 'Llamadas', 'Efectivas', 'Eficiencia', 'Dur. Mín', 'Dur. Máx', 'Mediana', 'Estado'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} className="text-[11px] font-medium text-gray-400 uppercase tracking-wider text-left px-2.5 pb-2 border-b border-gray-200 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map((a, i) => {
            const pct   = a.efficiency_pct ?? a.efficiencyPct ?? 0;
            const badge = effBadge(pct);
            const barColor = pct >= 75 ? C.effective : pct >= 40 ? C.amber : C.ineffective;
            return (
              <tr key={a.user_id ?? i} className="hover:bg-gray-50/60">
                <td className="px-2.5 py-2.5 border-b border-gray-100 font-medium text-gray-700 whitespace-nowrap">
                  {a.agent_name ?? a.name ?? a.full_name ?? `Agente ${a.user_id}`}
                </td>
                <td className="px-2.5 py-2.5 border-b border-gray-100 text-gray-600 whitespace-nowrap">{a.total_calls ?? a.totalCalls ?? 0}</td>
                <td className="px-2.5 py-2.5 border-b border-gray-100 text-gray-600 whitespace-nowrap">{a.effective ?? 0}</td>
                <td className="px-2.5 py-2.5 border-b border-gray-100 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <div className="bg-gray-200 rounded h-1.5 w-[70px] shrink-0">
                      <div className="h-1.5 rounded" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                    <span className="tabular-nums text-xs text-gray-600">{pct}%</span>
                  </div>
                </td>
                <td className="px-2.5 py-2.5 border-b border-gray-100 text-gray-400 whitespace-nowrap">{fmtDuration(a.min_duration_sec ?? a.min_duration ?? a.minDuration)}</td>
                <td className="px-2.5 py-2.5 border-b border-gray-100 text-gray-400 whitespace-nowrap">{fmtDuration(a.max_duration_sec ?? a.max_duration ?? a.maxDuration)}</td>
                <td className="px-2.5 py-2.5 border-b border-gray-100 text-gray-600 whitespace-nowrap">{fmtDuration(a.median_duration_sec ?? a.median_duration ?? a.medianDuration)}</td>
                <td className="px-2.5 py-2.5 border-b border-gray-100 whitespace-nowrap">
                  <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Dashboard principal ──────────────────────────────────────
const inputCls = 'px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 bg-white outline-none focus:border-[#053E68] transition disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50';

export default function DashboardView() {
  const { authToken, logout } = useAuth();

  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', userId: '' });

  const [kpis,         setKpis]         = useState(null);
  const [daily,        setDaily]        = useState([]);
  const [byHour,       setByHour]       = useState([]);
  const [durationDist, setDurationDist] = useState([]);
  const [agentStats,   setAgentStats]   = useState([]);
  const [campaignStats,setCampaignStats]= useState([]);
  const [fuSummary,    setFuSummary]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  const fetchAll = useCallback(async (f) => {
    if (!authToken) return;
    setLoading(true);
    setError(null);

    const qFull    = buildQuery(f);                                          // date + user
    const qDateOnly= buildQuery({ dateFrom: f.dateFrom, dateTo: f.dateTo }); // solo date

    try {
      const opts = { token: authToken, onUnauthorized: logout };
      const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
        apiFetch(`/api/v1/dashboard/calls/kpis${qFull}`,                  opts),
        apiFetch(`/api/v1/dashboard/calls/daily${qFull}`,                 opts),
        apiFetch(`/api/v1/dashboard/calls/by-hour${qDateOnly}`,           opts),
        apiFetch(`/api/v1/dashboard/calls/duration-distribution${qFull}`, opts),
        apiFetch(`/api/v1/dashboard/agents/stats${qDateOnly}`,            opts),
        apiFetch(`/api/v1/dashboard/campaigns/stats${qDateOnly}`,         opts),
        apiFetch(`/api/v1/dashboard/follow-ups/summary`,                  opts),
      ]);

      const [d1, d2, d3, d4, d5, d6, d7] = await Promise.all([
        r1.ok ? r1.json() : null,
        r2.ok ? r2.json() : [],
        r3.ok ? r3.json() : [],
        r4.ok ? r4.json() : [],
        r5.ok ? r5.json() : [],
        r6.ok ? r6.json() : [],
        r7.ok ? r7.json() : null,
      ]);

      setKpis(d1);
      setDaily(Array.isArray(d2) ? d2 : d2?.data ?? []);
      setByHour(Array.isArray(d3) ? d3 : d3?.data ?? []);
      setDurationDist(Array.isArray(d4) ? d4 : d4?.data ?? []);
      setAgentStats(Array.isArray(d5) ? d5 : d5?.data ?? []);
      setCampaignStats(Array.isArray(d6) ? d6 : d6?.data ?? []);
      setFuSummary(d7);
    } catch (err) {
      if (err.message !== 'Unauthorized') setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authToken, logout]);

  useEffect(() => { fetchAll(filters); }, [fetchAll]);

  // Agent list for user_id dropdown — derived from agentStats
  const agentOptions = useMemo(() => agentStats.map(a => ({
    id:   a.user_id,
    name: a.agent_name ?? a.name ?? a.full_name ?? `Agente ${a.user_id}`,
  })), [agentStats]);

  const today = new Date().toISOString().slice(0, 10);

  const handleFilterChange = (key, val) => {
    // Ninguna fecha puede ser posterior a hoy.
    if ((key === 'dateFrom' || key === 'dateTo') && val && val > today) val = today;
    const next = { ...filters, [key]: val };
    // La fecha de inicio no puede ser mayor a la final: ajustamos el otro extremo.
    if (key === 'dateFrom' && next.dateTo && val && val > next.dateTo) next.dateTo = val;
    if (key === 'dateTo'   && next.dateFrom && val && val < next.dateFrom) next.dateFrom = val;
    setFilters(next);
    fetchAll(next);
  };

  const clearFilters = () => {
    const next = { dateFrom: '', dateTo: '', userId: '' };
    setFilters(next);
    fetchAll(next);
  };

  // Normalizar campos de kpis (snake_case o camelCase)
  const k = kpis ? {
    total:          kpis.total_calls   ?? kpis.totalCalls   ?? 0,
    completed:      kpis.completed     ?? 0,
    ringing:        kpis.ringing       ?? kpis.active       ?? 0,
    effective:      kpis.effective     ?? 0,
    ineffective:    kpis.ineffective   ?? 0,
    efficiencyPct:  kpis.efficiency_pct?? kpis.efficiencyPct?? 0,
    minDuration:    kpis.min_duration_sec    ?? kpis.min_duration    ?? kpis.minDuration    ?? 0,
    maxDuration:    kpis.max_duration_sec    ?? kpis.max_duration    ?? kpis.maxDuration    ?? 0,
    medianDuration: kpis.median_duration_sec ?? kpis.median_duration ?? kpis.medianDuration ?? 0,
    avgDuration:    kpis.avg_duration_sec    ?? kpis.avg_duration    ?? kpis.avgDuration    ?? 0,
  } : null;

  // Normalizar duration buckets (is_effective o isEffective)
  const durationBuckets = durationDist.map(b => ({
    ...b,
    label:       b.label ?? b.range ?? '?',
    count:       b.count ?? 0,
    isEffective: b.is_effective ?? b.isEffective ?? false,
  }));

  // Normalizar campaign stats
  const campStats = campaignStats.map(c => ({
    name:        c.name       ?? c.campaign_name ?? '?',
    total:       c.total      ?? 0,
    effective:   c.effective  ?? 0,
    ineffective: c.ineffective ?? 0,
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  // Follow-up summary
  const fu = fuSummary ? {
    total:     fuSummary.total     ?? 0,
    completed: fuSummary.completed ?? 0,
    pending:   fuSummary.pending   ?? 0,
  } : { total: 0, completed: 0, pending: 0 };

  const hasFilters = filters.dateFrom || filters.dateTo || filters.userId;

  // ─── Estados de carga/error ─────────────────────────────
  if (loading && !k) return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
      <RefreshCw className="w-8 h-8 animate-spin" />
      <p className="mt-3 text-sm">Cargando tablero…</p>
    </div>
  );

  if (error) return (
    <div className="p-6 text-red-700 bg-red-50 border border-red-200 rounded-2xl max-w-[1280px] mx-auto">
      Error: {error}
    </div>
  );

  return (
    <div className="max-w-[1280px] mx-auto space-y-5">

      {/* Header + filtros */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
            Tablero de gestión telefónica
          </p>
          <h1 className="text-2xl font-bold text-[#053E68]">Rendimiento de Llamadas</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={filters.dateFrom}
            max={filters.dateTo || today}
            onChange={e => handleFilterChange('dateFrom', e.target.value)}
            className={inputCls}
          />
          <span className="text-sm text-gray-300">—</span>
          <input
            type="date"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            max={today}
            onChange={e => handleFilterChange('dateTo', e.target.value)}
            className={inputCls}
          />

          <select
            value={filters.userId}
            onChange={e => handleFilterChange('userId', e.target.value)}
            disabled={agentOptions.length === 0}
            className={inputCls}
          >
            <option value="">Todos los agentes</option>
            {agentOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <button
            onClick={clearFilters}
            disabled={!hasFilters}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar
          </button>

          <button
            onClick={() => fetchAll(filters)}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-[#053E68] text-white font-medium hover:bg-[#06497c] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* KPIs — solo si hay datos */}
      {k && (
        <Section title="Resumen general">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-2.5">
            <KpiCard label="Total llamadas"     value={k.total}         sub="período seleccionado" />
            <KpiCard label="Completadas"        value={k.completed}     sub={`${k.ringing} activas`}      accent="blue" />
            <KpiCard label="Efectivas ≥30s"    value={k.effective}     sub="de completadas"              accent="green" />
            <KpiCard label="No efectivas <30s" value={k.ineffective}   sub="contacto no logrado"         accent="red" />
            <KpiCard label="Eficiencia"
              value={`${k.efficiencyPct}%`}
              sub="efectivas / completadas"
              accent={k.efficiencyPct >= 70 ? 'green' : k.efficiencyPct >= 40 ? 'amber' : 'red'} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <KpiCard label="Duración mínima"   value={fmtDuration(k.minDuration)}    sub="llamada más corta" />
            <KpiCard label="Duración máxima"   value={fmtDuration(k.maxDuration)}    sub="llamada más larga"  accent="amber" />
            <KpiCard label="Mediana duración"  value={fmtDuration(k.medianDuration)} sub="valor central"      accent="blue" />
            <KpiCard label="Promedio duración" value={fmtDuration(k.avgDuration)}    sub="influido por outliers" />
          </div>
        </Section>
      )}

      {/* Tendencia diaria */}
      {daily.length > 0 && (
        <Section title="Tendencia diaria">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => (v || '').slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [v, n === 'total' ? 'Total' : n === 'effective' ? 'Efectivas' : 'No efectivas']} />
              <Bar dataKey="total"       fill={C.blue2}      radius={[3,3,0,0]} name="Total" />
              <Bar dataKey="effective"   fill={C.effective}  radius={[3,3,0,0]} name="Efectivas" />
              <Area dataKey="ineffective" fill="rgba(226,75,74,.12)" stroke={C.ineffective} strokeWidth={2} name="No efectivas" />
            </ComposedChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Distribución duración + por hora */}
      {(durationBuckets.length > 0 || byHour.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="Distribución por duración">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={durationBuckets} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => [`${v} llamadas`]} />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {durationBuckets.map((b, i) => <Cell key={i} fill={b.isEffective ? C.effective : C.ineffective} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>
          <Section title="Distribución por hora del día">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byHour} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey={byHour[0] ? (Object.keys(byHour[0]).find(key => key.includes('hour')) ?? 'hour') : 'hour'} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => [`${v} llamadas`]} />
                <Bar dataKey="count" fill={C.total} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>
      )}

      {/* Tabla de agentes */}
      <Section title="Rendimiento por agente">
        <AgentTable agents={agentStats} />
      </Section>

      {/* Llamadas por campaña + Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Llamadas por campaña">
          {campStats.length === 0
            ? <p className="text-gray-400 text-sm">Sin datos de campañas</p>
            : (
              <ResponsiveContainer width="100%" height={Math.max(200, campStats.length * 44)}>
                <BarChart data={campStats} layout="vertical" margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="effective"   stackId="s" fill={C.effective}   name="Efectivas"    radius={[0,0,0,0]} />
                  <Bar dataKey="ineffective" stackId="s" fill={C.ineffective} name="No efectivas" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </Section>

        <Section title="Seguimientos (follow-ups)">
          <div className="grid grid-cols-3 gap-2.5 mb-3.5">
            <KpiCard label="Total"       value={fu.total} />
            <KpiCard label="Completados" value={fu.completed}
              sub={fu.total > 0 ? `${Math.round((fu.completed / fu.total) * 100)}%` : '—'}
              accent="green" />
            <KpiCard label="Pendientes"  value={fu.pending}
              sub={fu.total > 0 ? `${Math.round((fu.pending / fu.total) * 100)}%` : '—'}
              accent="amber" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={[
                  { name: `Completados (${fu.completed})`, value: fu.completed || 0 },
                  { name: `Pendientes (${fu.pending})`,    value: fu.pending    || 0 },
                ]}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={80}
                dataKey="value" paddingAngle={2}
              >
                <Cell fill={C.effective} />
                <Cell fill={C.amber} />
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Section>
      </div>

    </div>
  );
}

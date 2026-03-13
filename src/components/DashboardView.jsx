import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, ComposedChart, Area,
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';

// ─── Colores ──────────────────────────────────────────────────
const C = {
  effective:   '#1D9E75',
  ineffective: '#E24B4A',
  total:       '#378ADD',
  amber:       '#BA7517',
  blue2:       '#B5D4F4',
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

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }) {
  const colors = { green: C.effective, red: C.ineffective, blue: C.total, amber: C.amber };
  return (
    <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '0.85rem 1rem' }}>
      <p style={{ fontSize: 11, color: '#888', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </p>
      <p style={{ fontSize: 24, fontWeight: 600, margin: 0, lineHeight: 1, color: accent ? colors[accent] : 'inherit', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

// ─── Tabla de agentes ─────────────────────────────────────────
function AgentTable({ agents }) {
  const th = { fontSize: 11, fontWeight: 500, color: '#888', padding: '0 10px 8px', textAlign: 'left', borderBottom: '0.5px solid #ddd', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' };
  const td = { padding: '10px 10px', borderBottom: '0.5px solid #eee', fontSize: 13, whiteSpace: 'nowrap' };

  if (!agents.length) return <p style={{ color: '#aaa', fontSize: 13, padding: '1rem 0' }}>Sin datos de agentes</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Agente','Llamadas','Efectivas','Eficiencia','Dur. Mín','Dur. Máx','Mediana','Promedio','Estado'].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map((a, i) => {
            const pct   = a.efficiency_pct ?? a.efficiencyPct ?? 0;
            const badge = effBadge(pct);
            const barColor = pct >= 75 ? C.effective : pct >= 40 ? C.amber : C.ineffective;
            return (
              <tr key={a.user_id ?? i}>
                <td style={{ ...td, fontWeight: 500 }}>{a.name ?? a.full_name ?? `Agente ${a.user_id}`}</td>
                <td style={td}>{a.total_calls ?? a.totalCalls ?? 0}</td>
                <td style={td}>{a.effective ?? 0}</td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ background: '#eee', borderRadius: 2, height: 6, width: 70, flexShrink: 0 }}>
                      <div style={{ width: `${pct}%`, height: 6, borderRadius: 2, background: barColor }} />
                    </div>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{pct}%</span>
                  </div>
                </td>
                <td style={{ ...td, color: '#888' }}>{fmtDuration(a.min_duration ?? a.minDuration)}</td>
                <td style={{ ...td, color: '#888' }}>{fmtDuration(a.max_duration ?? a.maxDuration)}</td>
                <td style={td}>{fmtDuration(a.median_duration ?? a.medianDuration)}</td>
                <td style={td}>{fmtDuration(a.avg_duration ?? a.avgDuration)}</td>
                <td style={td}>
                  <span style={{ background: badge.bg, color: badge.color, fontSize: 11, padding: '2px 8px', borderRadius: 3, fontWeight: 500 }}>
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
    name: a.name ?? a.full_name ?? `Agente ${a.user_id}`,
  })), [agentStats]);

  const handleFilterChange = (key, val) => {
    const next = { ...filters, [key]: val };
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
    minDuration:    kpis.min_duration  ?? kpis.minDuration  ?? 0,
    maxDuration:    kpis.max_duration  ?? kpis.maxDuration  ?? 0,
    medianDuration: kpis.median_duration ?? kpis.medianDuration ?? 0,
    avgDuration:    kpis.avg_duration  ?? kpis.avgDuration  ?? 0,
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

  // ─── Estilos ────────────────────────────────────────────
  const section = { marginBottom: '1.75rem' };
  const sTitle  = { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px', paddingBottom: 6, borderBottom: '0.5px solid #e5e5e5' };
  const grid = cols => ({ display: 'grid', gridTemplateColumns: cols, gap: 10 });

  // ─── Estados de carga/error ─────────────────────────────
  if (loading && !k) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
      <RefreshCw style={{ display: 'inline', animation: 'spin 1s linear infinite', width: 32, height: 32 }} />
      <p style={{ marginTop: 12 }}>Cargando tablero…</p>
    </div>
  );

  if (error) return (
    <div style={{ padding: '2rem', color: '#A32D2D', background: '#FCEBEB', borderRadius: 8 }}>
      Error: {error}
    </div>
  );

  return (
    <div style={{ padding: '0.5rem', fontFamily: 'system-ui, sans-serif', maxWidth: 1280, margin: '0 auto' }}>

      {/* Header + filtros */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>
            TABLERO DE GESTIÓN TELEFÓNICA
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Rendimiento de Llamadas</h1>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={filters.dateFrom}
            onChange={e => handleFilterChange('dateFrom', e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '0.5px solid #ccc' }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>—</span>
          <input type="date" value={filters.dateTo}
            onChange={e => handleFilterChange('dateTo', e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '0.5px solid #ccc' }} />

          {agentOptions.length > 0 && (
            <select value={filters.userId}
              onChange={e => handleFilterChange('userId', e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '0.5px solid #ccc' }}>
              <option value="">Todos los agentes</option>
              {agentOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}

          {hasFilters && (
            <button onClick={clearFilters}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #ccc', cursor: 'pointer', background: '#fff' }}>
              Limpiar
            </button>
          )}

          <button onClick={() => fetchAll(filters)} disabled={loading}
            style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: 'none', background: loading ? '#aaa' : C.total, color: '#fff', cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading && <RefreshCw style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />}
            Actualizar
          </button>
        </div>
      </div>

      {/* KPIs fila 1 — solo si hay datos */}
      {k && (
        <div style={section}>
          <p style={sTitle}>Resumen general</p>
          <div style={{ ...grid('repeat(5, minmax(0,1fr))'), marginBottom: 10 }}>
            <KpiCard label="Total llamadas"     value={k.total}         sub="período seleccionado" />
            <KpiCard label="Completadas"        value={k.completed}     sub={`${k.ringing} activas`}       accent="blue" />
            <KpiCard label="Efectivas ≥30s"    value={k.effective}     sub="de completadas"               accent="green" />
            <KpiCard label="No efectivas <30s" value={k.ineffective}   sub="contacto no logrado"          accent="red" />
            <KpiCard label="Eficiencia"
              value={`${k.efficiencyPct}%`}
              sub="efectivas / completadas"
              accent={k.efficiencyPct >= 70 ? 'green' : k.efficiencyPct >= 40 ? 'amber' : 'red'} />
          </div>
          <div style={grid('repeat(4, minmax(0,1fr))')}>
            <KpiCard label="Duración mínima"   value={fmtDuration(k.minDuration)}    sub="llamada más corta" />
            <KpiCard label="Duración máxima"   value={fmtDuration(k.maxDuration)}    sub="llamada más larga"  accent="amber" />
            <KpiCard label="Mediana duración"  value={fmtDuration(k.medianDuration)} sub="valor central"      accent="blue" />
            <KpiCard label="Promedio duración" value={fmtDuration(k.avgDuration)}    sub="influido por outliers" />
          </div>
        </div>
      )}

      {/* Tendencia diaria */}
      {daily.length > 0 && (
        <div style={section}>
          <p style={sTitle}>Tendencia diaria</p>
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
        </div>
      )}

      {/* Distribución duración + por hora */}
      {(durationBuckets.length > 0 || byHour.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: '1.75rem' }}>
          <div>
            <p style={sTitle}>Distribución por duración</p>
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
          </div>
          <div>
            <p style={sTitle}>Distribución por hora del día</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byHour} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey={byHour[0] ? (Object.keys(byHour[0]).find(k => k.includes('hour')) ?? 'hour') : 'hour'} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => [`${v} llamadas`]} />
                <Bar dataKey="count" fill={C.total} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabla de agentes */}
      <div style={section}>
        <p style={sTitle}>Rendimiento por agente</p>
        <AgentTable agents={agentStats} />
      </div>

      {/* Llamadas por campaña + Follow-ups */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={section}>
          <p style={sTitle}>Llamadas por campaña</p>
          {campStats.length === 0
            ? <p style={{ color: '#aaa', fontSize: 13 }}>Sin datos de campañas</p>
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
        </div>

        <div style={section}>
          <p style={sTitle}>Seguimientos (follow-ups)</p>
          <div style={{ ...grid('repeat(3,1fr)'), marginBottom: 14 }}>
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
        </div>
      </div>

    </div>
  );
}

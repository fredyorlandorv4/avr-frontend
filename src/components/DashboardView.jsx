import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
  ComposedChart, Area,
} from 'recharts';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';

// ─── Colores ─────────────────────────────────────────────────
const C = {
  effective:   '#1D9E75',
  ineffective: '#E24B4A',
  total:       '#378ADD',
  amber:       '#BA7517',
  blue2:       '#B5D4F4',
  light:       '#9FE1CB',
};

// ─── Helpers ─────────────────────────────────────────────────
function getDuration(call) {
  // usa call.duration si está disponible; si no, calcula desde timestamps
  if (call.duration != null) return call.duration;
  if (call.ended_at && call.created_at)
    return (new Date(call.ended_at) - new Date(call.created_at)) / 1000;
  return null;
}

function fmtDuration(sec) {
  if (sec == null || sec === 0) return '—';
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isCompleted(status) {
  const s = (status || '').toLowerCase();
  return s === 'completed' || s === 'answered';
}

function isActive(status) {
  const s = (status || '').toLowerCase();
  return s === 'ringing' || s === 'active';
}

function effBadge(pct) {
  if (pct >= 75) return { bg: '#E1F5EE', color: '#0F6E56', label: 'Alto' };
  if (pct >= 40) return { bg: '#FAEEDA', color: '#854F0B', label: 'Medio' };
  if (pct > 0)   return { bg: '#FCEBEB', color: '#A32D2D', label: 'Bajo' };
  return { bg: '#f0f0f0', color: '#888', label: 'Sin datos' };
}

// ─── KPI Card ────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }) {
  const accentColor = { green: C.effective, red: C.ineffective, blue: C.total, amber: C.amber };
  return (
    <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '0.85rem 1rem' }}>
      <p style={{ fontSize: 11, color: '#888', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </p>
      <p style={{ fontSize: 24, fontWeight: 600, margin: 0, lineHeight: 1, color: accent ? accentColor[accent] : 'inherit', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

// ─── Tabla de agentes ────────────────────────────────────────
function AgentTable({ agents }) {
  const th = { fontSize: 11, fontWeight: 500, color: '#888', padding: '0 10px 8px', textAlign: 'left', borderBottom: '0.5px solid #ddd', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' };
  const td = { padding: '10px 10px', borderBottom: '0.5px solid #eee', fontSize: 13, whiteSpace: 'nowrap' };

  if (!agents.length) {
    return <p style={{ color: '#aaa', fontSize: 13, padding: '1rem 0' }}>Sin datos de agentes</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Agente', 'Llamadas', 'Efectivas', 'Eficiencia', 'Dur. Mín', 'Dur. Máx', 'Mediana', 'Promedio', 'Estado'].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map(a => {
            const badge = effBadge(a.efficiencyPct);
            const barColor = a.efficiencyPct >= 75 ? C.effective : a.efficiencyPct >= 40 ? C.amber : C.ineffective;
            return (
              <tr key={a.userId}>
                <td style={{ ...td, fontWeight: 500 }}>{a.name}</td>
                <td style={td}>{a.totalCalls}</td>
                <td style={td}>{a.effective}</td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ background: '#eee', borderRadius: 2, height: 6, width: 70, flexShrink: 0 }}>
                      <div style={{ width: `${a.efficiencyPct}%`, height: 6, borderRadius: 2, background: barColor }} />
                    </div>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{a.efficiencyPct}%</span>
                  </div>
                </td>
                <td style={{ ...td, color: '#888', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(a.minDuration)}</td>
                <td style={{ ...td, color: '#888', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(a.maxDuration)}</td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(a.medianDuration)}</td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(a.avgDuration)}</td>
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

// ─── Cómputo de métricas ─────────────────────────────────────
function useMetrics(calls, campaigns, followUps, users) {
  return useMemo(() => {
    const augmented = calls.map(c => ({ ...c, _duration: getDuration(c) }));
    const completed = augmented.filter(c => isCompleted(c.status));
    const durations = completed.map(c => c._duration).filter(d => d != null);
    const effective   = completed.filter(c => (c._duration ?? 0) >= 30);
    const ineffective = completed.filter(c => c._duration != null && c._duration < 30);

    const callMetrics = {
      totalCalls:      calls.length,
      completed:       completed.length,
      ringing:         calls.filter(c => isActive(c.status)).length,
      effective:       effective.length,
      ineffective:     ineffective.length,
      efficiencyPct:   completed.length > 0 ? Math.round((effective.length / completed.length) * 100) : 0,
      minDuration:     durations.length ? Math.min(...durations) : 0,
      maxDuration:     durations.length ? Math.max(...durations) : 0,
      medianDuration:  median(durations),
      avgDuration:     durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    };

    // Tendencia diaria
    const dailyMap = new Map();
    augmented.forEach(c => {
      const date = (c.created_at || '').slice(0, 10);
      if (!date) return;
      if (!dailyMap.has(date)) dailyMap.set(date, { date, total: 0, effective: 0, ineffective: 0 });
      const d = dailyMap.get(date);
      d.total++;
      if (isCompleted(c.status)) {
        if ((c._duration ?? 0) >= 30) d.effective++;
        else if (c._duration != null)  d.ineffective++;
      }
    });
    const dailyStats = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    // Buckets de duración
    const bucketDefs = [
      ['< 30s',   0,   30,  false],
      ['30–60s',  30,  60,  true],
      ['1–2 min', 60,  120, true],
      ['2–5 min', 120, 300, true],
      ['5–10 min',300, 600, true],
      ['> 10 min',600, Infinity, true],
    ];
    const durationBuckets = bucketDefs.map(([label, lo, hi, isEff]) => ({
      label,
      count: durations.filter(d => d >= lo && d < hi).length,
      isEffective: isEff,
    }));

    // Distribución por hora
    const hourMap = new Map();
    augmented.forEach(c => {
      if (!c.created_at) return;
      const h = new Date(c.created_at).getHours();
      hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
    });
    const hourStats = [...hourMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([h, count]) => ({
        hour: h < 12 ? `${h === 0 ? 12 : h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
        count,
      }));

    // Stats por agente — join: call.campaign_name → campaign.user_id → user
    const campaignByName = new Map(campaigns.map(c => [c.name, c]));
    const userMap = new Map(users.map(u => [u.id, u]));
    const agentCallsMap = new Map();
    augmented.forEach(call => {
      const campaign = campaignByName.get(call.campaign_name);
      if (!campaign) return;
      const uid = campaign.user_id;
      if (!uid) return;
      if (!agentCallsMap.has(uid)) agentCallsMap.set(uid, []);
      agentCallsMap.get(uid).push(call);
    });
    const agentStats = [...agentCallsMap.entries()].map(([uid, uCalls]) => {
      const uCompleted = uCalls.filter(c => isCompleted(c.status));
      const uDurations = uCompleted.map(c => c._duration).filter(d => d != null);
      const uEff = uCompleted.filter(c => (c._duration ?? 0) >= 30);
      const user = userMap.get(uid);
      return {
        userId:        uid,
        name:          user?.full_name || user?.username || `Usuario ${uid}`,
        totalCalls:    uCalls.length,
        effective:     uEff.length,
        ineffective:   uCompleted.length - uEff.length,
        efficiencyPct: uCompleted.length > 0 ? Math.round((uEff.length / uCompleted.length) * 100) : 0,
        minDuration:   uDurations.length ? Math.min(...uDurations) : null,
        maxDuration:   uDurations.length ? Math.max(...uDurations) : null,
        medianDuration:uDurations.length ? median(uDurations) : null,
        avgDuration:   uDurations.length ? uDurations.reduce((a, b) => a + b, 0) / uDurations.length : null,
      };
    });

    // Stats por campaña
    const campaignStats = campaigns
      .map(camp => {
        const campCalls = augmented.filter(c => c.campaign_name === camp.name);
        const eff   = campCalls.filter(c => isCompleted(c.status) && (c._duration ?? 0) >= 30);
        const ineff = campCalls.filter(c => isCompleted(c.status) && c._duration != null && c._duration < 30);
        return {
          name:          camp.name,
          total:         campCalls.length,
          effective:     eff.length,
          ineffective:   ineff.length,
          efficiencyPct: campCalls.length > 0 ? Math.round((eff.length / campCalls.length) * 100) : 0,
        };
      })
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);

    // Follow-up stats
    const fuStats = {
      total:     followUps.length,
      completed: followUps.filter(f => f.completed).length,
      pending:   followUps.filter(f => !f.completed).length,
    };

    return { callMetrics, dailyStats, durationBuckets, hourStats, agentStats, campaignStats, fuStats };
  }, [calls, campaigns, followUps, users]);
}

// ─── Componente principal ─────────────────────────────────────
export default function DashboardView({ calls, campaigns, followUps, onRefresh }) {
  const { authToken, logout } = useAuth();
  const [users, setUsers] = useState([]);

  // Carga usuarios (solo para la tabla de agentes)
  useEffect(() => {
    if (!authToken) return;
    apiFetch('/api/v1/users', { token: authToken, onUnauthorized: logout })
      .then(r => r.ok ? r.json() : [])
      .then(data => setUsers(Array.isArray(data) ? data : (data.items || data.users || [])))
      .catch(() => {});
  }, [authToken]);

  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', campaignName: 'all' });

  const filteredCalls = useMemo(() => {
    return calls.filter(c => {
      if (filters.dateFrom && (c.created_at || '') < filters.dateFrom) return false;
      if (filters.dateTo   && (c.created_at || '').slice(0, 10) > filters.dateTo) return false;
      if (filters.campaignName !== 'all' && c.campaign_name !== filters.campaignName) return false;
      return true;
    });
  }, [calls, filters]);

  const { callMetrics, dailyStats, durationBuckets, hourStats, agentStats, campaignStats, fuStats } =
    useMetrics(filteredCalls, campaigns, followUps, users);

  const uniqueCampaigns = useMemo(() => [...new Set(campaigns.map(c => c.name))], [campaigns]);

  const section  = { marginBottom: '1.75rem' };
  const sTitle   = { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px', paddingBottom: 6, borderBottom: '0.5px solid #e5e5e5' };
  const grid = cols => ({ display: 'grid', gridTemplateColumns: cols, gap: 10 });

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
          <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '0.5px solid #ccc' }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>—</span>
          <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '0.5px solid #ccc' }} />
          <select value={filters.campaignName} onChange={e => setFilters(f => ({ ...f, campaignName: e.target.value }))}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '0.5px solid #ccc' }}>
            <option value="all">Todas las campañas</option>
            {uniqueCampaigns.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {(filters.dateFrom || filters.dateTo || filters.campaignName !== 'all') && (
            <button onClick={() => setFilters({ dateFrom: '', dateTo: '', campaignName: 'all' })}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #ccc', cursor: 'pointer', background: '#fff' }}>
              Limpiar
            </button>
          )}
          <button onClick={onRefresh}
            style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: 'none', background: C.total, color: '#fff', cursor: 'pointer' }}>
            Actualizar
          </button>
        </div>
      </div>

      {/* KPIs fila 1 */}
      <div style={section}>
        <p style={sTitle}>Resumen general</p>
        <div style={{ ...grid('repeat(5, minmax(0,1fr))'), marginBottom: 10 }}>
          <KpiCard label="Total llamadas"    value={callMetrics.totalCalls}  sub="período seleccionado" />
          <KpiCard label="Completadas"       value={callMetrics.completed}   sub={`${callMetrics.ringing} activas`} accent="blue" />
          <KpiCard label="Efectivas ≥30s"   value={callMetrics.effective}   sub="de completadas"       accent="green" />
          <KpiCard label="No efectivas <30s" value={callMetrics.ineffective} sub="contacto no logrado" accent="red" />
          <KpiCard label="Eficiencia"
            value={`${callMetrics.efficiencyPct}%`}
            sub="efectivas / completadas"
            accent={callMetrics.efficiencyPct >= 70 ? 'green' : callMetrics.efficiencyPct >= 40 ? 'amber' : 'red'} />
        </div>
        <div style={grid('repeat(4, minmax(0,1fr))')}>
          <KpiCard label="Duración mínima"  value={fmtDuration(callMetrics.minDuration)}    sub="llamada más corta" />
          <KpiCard label="Duración máxima"  value={fmtDuration(callMetrics.maxDuration)}    sub="llamada más larga"  accent="amber" />
          <KpiCard label="Mediana duración" value={fmtDuration(callMetrics.medianDuration)} sub={`${durationBuckets[1]?.count ?? 0} llamadas 30–60s`} accent="blue" />
          <KpiCard label="Promedio duración" value={fmtDuration(callMetrics.avgDuration)}   sub="influido por outliers" />
        </div>
      </div>

      {/* Tendencia diaria */}
      <div style={section}>
        <p style={sTitle}>Tendencia diaria</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={dailyStats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n) => [v, n === 'total' ? 'Total' : n === 'effective' ? 'Efectivas' : 'No efectivas']} />
            <Bar dataKey="total"     fill={C.blue2}      radius={[3,3,0,0]} name="Total" />
            <Bar dataKey="effective" fill={C.effective}  radius={[3,3,0,0]} name="Efectivas" />
            <Area dataKey="ineffective" fill="rgba(226,75,74,.12)" stroke={C.ineffective} strokeWidth={2} name="No efectivas" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Distribución duración + por hora */}
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
                {durationBuckets.map((b, i) => (
                  <Cell key={i} fill={b.isEffective ? C.effective : C.ineffective} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p style={sTitle}>Distribución por hora del día</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourStats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [`${v} llamadas`]} />
              <Bar dataKey="count" fill={C.total} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de agentes */}
      <div style={section}>
        <p style={sTitle}>Rendimiento por agente</p>
        <AgentTable agents={agentStats} />
      </div>

      {/* Llamadas por campaña + Follow-ups */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={section}>
          <p style={sTitle}>Llamadas por campaña</p>
          {campaignStats.length === 0
            ? <p style={{ color: '#aaa', fontSize: 13 }}>Sin datos de campañas</p>
            : (
              <ResponsiveContainer width="100%" height={Math.max(200, campaignStats.length * 44)}>
                <BarChart data={campaignStats} layout="vertical" margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
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
            <KpiCard label="Total"      value={fuStats.total} />
            <KpiCard label="Completados" value={fuStats.completed}
              sub={fuStats.total > 0 ? `${Math.round((fuStats.completed / fuStats.total) * 100)}%` : '—'}
              accent="green" />
            <KpiCard label="Pendientes" value={fuStats.pending}
              sub={fuStats.total > 0 ? `${Math.round((fuStats.pending / fuStats.total) * 100)}%` : '—'}
              accent="amber" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={[
                  { name: `Completados (${fuStats.completed})`, value: fuStats.completed || 0 },
                  { name: `Pendientes (${fuStats.pending})`,    value: fuStats.pending    || 0 },
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

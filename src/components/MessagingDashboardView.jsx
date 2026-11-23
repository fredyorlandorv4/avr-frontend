import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatPortfolioMoney } from '../utils/portfolioMoney.js';
import { buildMessagingDashboard } from '../utils/messagingDashboard.js';
import { DEBT_AGE_BUCKETS, sumPortfolioMetrics } from '../utils/portfolioMetrics.js';

const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const startDate = () => { const date = new Date(`${today()}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 29); return date.toISOString().slice(0, 10); };
const fieldClass = 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700';

function PortfolioCounts({ title, pendingLabel, pending, currentLabel, current, loading, error }) {
  return <section className="rounded-2xl border border-gray-100 bg-white p-5">
    <h2 className="font-semibold text-[#053E68]">{title}</h2>
    <div className="mt-4 space-y-4">
      <div>
        <div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-gray-700">{pendingLabel}</span><strong className="text-lg text-[#053E68]">{loading ? '…' : pending.toLocaleString('es-GT')}</strong></div>
      </div>
      <div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-gray-700">{currentLabel}</span><strong className="text-gray-500">{loading ? '…' : error ? 'No disponible' : current.toLocaleString('es-GT')}</strong></div>
    </div>
    <p className="mt-4 text-xs text-gray-500">Proyectos identificados en SAP sin saldo pendiente, incluidas cuotas futuras.</p>
  </section>;
}

export default function MessagingDashboardView() {
  const { authToken, logout, sapSources } = useAuth();
  const [from, setFrom] = useState(startDate);
  const [to, setTo] = useState(today);
  const [source, setSource] = useState('todo');
  const [portfolio, setPortfolio] = useState({ clients: [], metrics: {}, projectStatus: [] });
  const [messages, setMessages] = useState({ deliveries: [], customerDeliveries: [], configs: [] });
  const [expanded, setExpanded] = useState(new Set());
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState('');
  const [messagesError, setMessagesError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const allowedSourcesKey = sapSources.slice().sort().join('|');

  useEffect(() => {
    if (!authToken) return undefined;
    let active = true;
    const load = async () => {
      setPortfolioLoading(true);
      setPortfolioError('');
      try {
        const response = await apiFetch('/api/v1/cobros/cartera-vencida?tipo=todo', { token: authToken, onUnauthorized: logout });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(typeof payload.detail === 'string' ? payload.detail : payload.detail?.message || 'No se pudo cargar la cartera SAP.');
        }
        const payload = await response.json();
        if (active) setPortfolio({ clients: payload.clientes || [], metrics: payload.metricas_por_fuente || {}, projectStatus: payload.estado_proyectos ?? null });
      } catch (err) {
        if (active && err.message !== 'Unauthorized') { setPortfolioError(err.message); setPortfolio({ clients: [], metrics: {}, projectStatus: null }); }
      } finally { if (active) setPortfolioLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [authToken, logout, refresh, allowedSourcesKey]);

  useEffect(() => {
    if (!authToken) return undefined;
    let active = true;
    const load = async () => {
      setMessagesLoading(true);
      setMessagesError('');
      try {
        const options = { token: authToken, onUnauthorized: logout };
        const params = new URLSearchParams({ date_from: from, date_to: to, tipo: 'todo' });
        const customerParams = new URLSearchParams(params); customerParams.set('por_cliente', 'true');
        const responses = await Promise.all([apiFetch(`/api/v1/cobros/reminders/dashboard?${params}`, options), apiFetch(`/api/v1/cobros/reminders/dashboard?${customerParams}`, options), apiFetch('/api/v1/cobros/reminders/projects', options)]);
        if (responses.some(response => !response.ok)) throw new Error('No se pudieron cargar las estadísticas de mensajes.');
        const [deliveries, customerDeliveries, configs] = await Promise.all(responses.map(response => response.json()));
        if (active) setMessages({ deliveries, customerDeliveries, configs });
      } catch (err) {
        if (active && err.message !== 'Unauthorized') { setMessagesError(err.message); setMessages({ deliveries: [], customerDeliveries: [], configs: [] }); }
      } finally { if (active) setMessagesLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [authToken, logout, from, to, refresh, allowedSourcesKey]);
  const { rows, totals, pendingProjectCount, currentProjectCount } = useMemo(() => {
    const allowed = allowedSourcesKey.split('|');
    const matches = item => allowed.includes(item.tipo_cartera || 'lotes') && (source === 'todo' || (item.tipo_cartera || 'lotes') === source);
    return buildMessagingDashboard(portfolio.clients.filter(matches), messages.deliveries.filter(matches), messages.configs, today(), messages.customerDeliveries.filter(matches), (portfolio.projectStatus || []).filter(matches));
  }, [portfolio.clients, portfolio.projectStatus, messages, source, allowedSourcesKey]);
  const metrics = useMemo(() => sumPortfolioMetrics(portfolio.metrics, source, allowedSourcesKey.split('|')), [portfolio.metrics, source, allowedSourcesKey]);
  const loading = portfolioLoading || messagesLoading;
  const error = portfolioError || messagesError;
  const metricValue = value => portfolioLoading ? '…' : portfolioError || value == null ? 'No disponible' : value.toLocaleString('es-GT');
  const maxAge = Math.max(1, ...Object.values(metrics?.ages || {}));
  const maxSent = Math.max(1, ...rows.map(row => row.sent));

  return <div className="mx-auto max-w-[1280px] space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Tablero de mensajería</p><h1 className="text-2xl font-bold text-[#053E68]">Mensajes y cartera</h1></div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-gray-600">Desde <input aria-label="Fecha inicial" type="date" max={to} value={from} onChange={event => setFrom(event.target.value || to)} className={fieldClass} /></label>
        <label className="text-sm text-gray-600">Hasta <input aria-label="Fecha final" type="date" min={from} max={today()} value={to} onChange={event => setTo(event.target.value || from)} className={fieldClass} /></label>
        <select aria-label="Cartera" value={source} onChange={event => setSource(event.target.value)} className={fieldClass}>
          <option value="todo">Todas las carteras</option>{sapSources.includes('lotes') && <option value="lotes">Lotes</option>}{sapSources.includes('edificios') && <option value="edificios">Edificios</option>}
        </select>
        <button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)} className="inline-flex items-center gap-2 rounded-lg bg-[#053E68] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>
      </div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-gray-100 bg-white p-5"><p className="text-sm text-gray-500">Mensajes enviados en el período</p><p className="mt-2 text-2xl font-bold text-[#053E68]">{loading ? '…' : totals.sent.toLocaleString('es-GT')}</p><p className="mt-1 text-xs text-gray-500">Envíos aceptados por Evolution, según fecha de envío.</p></div>
      <div className="rounded-2xl border border-gray-100 bg-white p-5"><p className="text-sm text-gray-500">Saldo vencido de Consulta SAP</p><div className="mt-2 flex flex-wrap gap-x-5 text-2xl font-bold text-[#053E68]">{loading ? '…' : <>{(source !== 'edificios' && sapSources.includes('lotes')) && <span>{formatPortfolioMoney(totals.GTQ / 100, 'GTQ')}</span>}{(source !== 'lotes' && sapSources.includes('edificios')) && <span>{formatPortfolioMoney(totals.USD / 100, 'USD')}</span>}</>}</div><p className="mt-1 text-xs text-gray-500">Cuotas vencidas a la fecha actual; no cambia con el período de mensajes.</p></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-gray-100 bg-white p-5"><p className="text-sm text-gray-500">Total de Deudores</p><p className="mt-2 text-3xl font-bold text-[#053E68]">{metricValue(metrics?.debtors)}</p><p className="mt-2 text-xs text-gray-500">Clientes de la cartera SAP con al menos un saldo pendiente, incluidos los que tienen compromiso de pago.</p></div>
      <div className="rounded-2xl border border-gray-100 bg-white p-5"><p className="text-sm text-gray-500">Clientes al Día</p><p className="mt-2 text-3xl font-bold text-emerald-600">{metricValue(metrics?.current)}</p><p className="mt-2 text-xs text-gray-500">Clientes de la cartera SAP sin saldos pendientes.</p></div>
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="font-semibold text-[#053E68]">Deudores por Antigüedad</h2>
        <p className="mt-1 text-xs text-gray-500">Cada cliente se cuenta una vez, según su cuota pendiente más antigua. Días de atraso a la fecha actual.</p>
        {portfolioLoading ? <p className="py-8 text-center text-gray-500">Cargando cartera…</p> : !metrics || portfolioError ? <p className="py-8 text-center text-gray-500">No hay métricas de cartera disponibles. Verifica que el backend esté actualizado.</p> : <div className="mt-5 space-y-3">{DEBT_AGE_BUCKETS.map(key => <div key={key} className="grid grid-cols-[70px_1fr_45px] items-center gap-3 text-sm"><span className="text-gray-600">{key}</span><div className="h-4 overflow-hidden rounded-full bg-gray-100" aria-hidden="true"><div className="h-full rounded-full bg-[#0B5F8F]" style={{ width: `${metrics.ages[key] / maxAge * 100}%` }} /></div><strong className="text-right text-[#053E68]">{metrics.ages[key].toLocaleString('es-GT')}</strong></div>)}<p className="pt-2 text-xs text-gray-500">{metrics.withoutDelay.toLocaleString('es-GT')} deudores con saldo por vencer o sin atraso. {metrics.withoutDate > 0 && `${metrics.withoutDate.toLocaleString('es-GT')} deudores sin fecha de vencimiento.`}</p></div>}
      </section>
      <PortfolioCounts title="Estado de proyectos" pendingLabel="Proyectos con saldo pendiente" pending={pendingProjectCount} currentLabel="Proyectos sin cuota pendiente" current={currentProjectCount} loading={loading} error={portfolioError || portfolio.projectStatus == null} />
    </div>
    <section className="rounded-2xl border border-gray-100 bg-white p-5">
      <h2 className="font-semibold text-[#053E68]">Mensajes enviados por proyecto</h2>
      <p className="mt-1 text-sm text-gray-500">Envíos aceptados en el período seleccionado. El saldo corresponde a cuotas vencidas a la fecha actual.</p>
      {loading ? <p className="py-10 text-center text-gray-500">Cargando estadísticas…</p> : !rows.length ? <p className="py-10 text-center text-gray-500">No hay datos para los filtros seleccionados.</p> : <div className="mt-4 space-y-3">{rows.map(row => <div key={row.key} className="border-t border-gray-100 pt-3"><div className="grid gap-2 sm:grid-cols-[minmax(150px,1fr)_minmax(120px,2fr)_140px] sm:items-center">
        <button type="button" aria-expanded={expanded.has(row.key)} onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(row.key)) next.delete(row.key); else next.add(row.key); return next; })} className="flex min-w-0 items-start gap-2 text-left"><span>{expanded.has(row.key) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span><span><span className="block break-words font-medium text-gray-800">{row.project}</span><span className="text-xs text-gray-500">{row.company} · {row.source === 'edificios' ? 'Edificios' : 'Lotes'}</span></span></button>
        <div><div className="mb-1 flex justify-between gap-2 text-sm"><span className="text-gray-500">Mensajes enviados</span><strong className="text-[#053E68]">{row.sent.toLocaleString('es-GT')}</strong></div><div className="h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#0B5F8F]" style={{ width: `${row.sent / maxSent * 100}%` }} /></div></div>
        <div className="text-sm sm:text-right"><span className="block text-xs text-gray-500">Saldo vencido</span><strong className="text-[#053E68]">{formatPortfolioMoney(row.cents / 100, row.source === 'edificios' ? 'USD' : 'GTQ')}</strong></div>
      </div>{expanded.has(row.key) && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-xs text-gray-500"><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Saldo vencido</th><th className="px-3 py-2">Cuotas vencidas</th><th className="px-3 py-2">Mensajes enviados</th></tr></thead><tbody>{[...row.customers.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es')).map(customer => <tr key={customer.key} className="border-t border-gray-100"><td className="px-3 py-2">{customer.name} {customer.code && <span className="text-xs text-gray-500">({customer.code})</span>}</td><td className="px-3 py-2">{formatPortfolioMoney(customer.cents / 100, row.source === 'edificios' ? 'USD' : 'GTQ')}</td><td className="px-3 py-2">{customer.installments}</td><td className="px-3 py-2">{customer.sent}</td></tr>)}</tbody></table>{!row.customers.size && <p className="px-3 py-2 text-sm text-gray-500">No hay clientes con saldo vencido en la cartera visible.</p>}</div>}</div>)}</div>}
    </section>
  </div>;
}

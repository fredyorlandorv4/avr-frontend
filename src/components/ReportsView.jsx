import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useArea } from '../context/AreaContext.jsx';
import { apiFetch } from '../api.js';
import AreaFilter from './AreaFilter.jsx';

const PAGE_SIZE = 100;
const TABLE_PAGE_SIZE = 25;
const today = () => new Date().toISOString().slice(0, 10);

const statusLabels = {
  ringing: 'Timbrando', answered: 'Contestada', completed: 'Completada',
  active: 'Activa', pending: 'Pendiente', failed: 'Fallida',
  'no-answer': 'Buzón', no_answer: 'Buzón', busy: 'Ocupado',
  cancelled: 'Cancelada', initiated: 'Iniciada', voicemail: 'Buzón',
};

const valueAt = (source, paths) => {
  for (const path of paths) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], source);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
};

const MONTHS = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
  noviembre: 10, diciembre: 11,
};
const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6 };

const formatCommitmentDate = (date) => date.toLocaleDateString('es-GT', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
});

function commitmentDate(call) {
  // "Resumen" es la fuente acordada: evita mostrar textos de follow-up u otros
  // campos del análisis que no son una fecha de compromiso.
  const summary = call.analysis?.summary;
  if (typeof summary !== 'string') return '';
  const normalized = summary.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!/(compromet|compromiso|pagara|pagar|pago)/.test(normalized)) return '';

  const callDate = new Date(call.created_at || call.called_at || Date.now());
  if (Number.isNaN(callDate.getTime())) return '';
  const base = new Date(Date.UTC(callDate.getUTCFullYear(), callDate.getUTCMonth(), callDate.getUTCDate()));
  const makeDate = (year, month, day) => {
    const result = new Date(Date.UTC(year, month, Number(day)));
    return result.getUTCMonth() === month && result.getUTCDate() === Number(day) ? result : null;
  };
  const nextWeekday = (weekday, extraWeek = false) => {
    const result = new Date(base);
    let daysUntil = (weekday - base.getUTCDay() + 7) % 7;
    if (daysUntil === 0 || extraWeek) daysUntil += 7;
    result.setUTCDate(result.getUTCDate() + daysUntil);
    return result;
  };

  // Formatos numéricos como "20/08" o "20-08-2026".
  const numeric = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    const year = numeric[3] ? (numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3])) : base.getUTCFullYear();
    const result = makeDate(year, Number(numeric[2]) - 1, numeric[1]);
    if (result) return formatCommitmentDate(result);
  }

  // Primero se prefieren fechas completas: "martes 18 de agosto" debe ganar
  // sobre la palabra "mañana" que puede aparecer antes en la misma oración.
  const explicit = normalized.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/);
  if (explicit) {
    const result = makeDate(Number(explicit[3]) || base.getUTCFullYear(), MONTHS[explicit[2]], explicit[1]);
    if (result) return formatCommitmentDate(result);
  }

  // "el día 20 del mes en curso", "20 de este mes" y equivalentes.
  const thisMonth = normalized.match(/\b(?:dia\s+)?(\d{1,2})\s+(?:del\s+mes\s+(?:en\s+curso|actual)|de\s+(?:este|el)\s+mes)\b/);
  if (thisMonth) {
    const result = makeDate(base.getUTCFullYear(), base.getUTCMonth(), thisMonth[1]);
    if (result) return formatCommitmentDate(result);
  }

  const nextWeek = normalized.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+de\s+la\s+proxima\s+semana\b/);
  if (nextWeek) {
    return formatCommitmentDate(nextWeekday(WEEKDAYS[nextWeek[1]], true));
  }

  const upcomingWeekday = normalized.match(/\b(?:el\s+)?(?:proximo\s+|este\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if (upcomingWeekday) {
    return formatCommitmentDate(nextWeekday(WEEKDAYS[upcomingWeekday[1]]));
  }

  if (/\b(?:fin(?:al(?:es)?)?|ultimo)\s+de(?:l)?\s+mes\b/.test(normalized)) {
    const result = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
    return formatCommitmentDate(result);
  }
  if (/\b(?:inicio|principio|primeros)\s+de(?:l)?\s+mes\b/.test(normalized)) {
    return formatCommitmentDate(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1)));
  }
  if (/\bhoy\b/.test(normalized)) {
    return formatCommitmentDate(base);
  }

  if (/\bmanana\b/.test(normalized)) {
    const result = new Date(base);
    result.setUTCDate(result.getUTCDate() + 1);
    return formatCommitmentDate(result);
  }
  return '';
}

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-GT');
};

const formatDuration = (seconds) => {
  if (seconds == null || seconds === '') return '—';
  const total = Math.round(Number(seconds));
  if (Number.isNaN(total)) return String(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

function downloadExcel(rows) {
  const headers = ['Empresa', 'Proyecto', 'Cliente', 'Fecha/Hora de Llamada', 'Status de llamada', 'Duración de llamada', 'Fecha de compromiso de pago'];
  const values = rows.map((row) => [row.company, row.project, row.client, row.calledAt, row.status, row.duration, row.commitment]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...values]);
  worksheet['!cols'] = headers.map((header, index) => ({
    // El ancho se expresa en caracteres y se limita para evitar hojas inmanejables.
    wch: Math.min(60, Math.max(header.length, ...values.map((row) => String(row[index] || '—').length)) + 2),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reportes');
  XLSX.writeFile(workbook, `reporte-llamadas-${today()}.xlsx`, { compression: true });
}

export default function ReportsView() {
  const { authToken, logout } = useAuth();
  const { scope } = useArea();
  const [dateStart, setDateStart] = useState(today);
  const [dateEnd, setDateEnd] = useState(today);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [tablePage, setTablePage] = useState(1);

  const queryFor = useCallback((page) => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (scope.areaId != null) params.set('area_id', String(scope.areaId));
    if (scope.subarea) params.set('subarea', scope.subarea);
    if (dateStart) params.set('fecha_inicio', dateStart);
    if (dateEnd) params.set('fecha_fin', dateEnd);
    return params.toString();
  }, [scope, dateStart, dateEnd]);

  const fetchAll = useCallback(async () => {
    const all = [];
    let page = 1;
    let total = Infinity;
    while (all.length < total) {
      const response = await apiFetch(`/api/v1/calls/admin/all?${queryFor(page)}`, { token: authToken, onUnauthorized: logout });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || 'No se pudieron cargar las llamadas.');
      const payload = await response.json();
      const items = Array.isArray(payload) ? payload : (payload.items || []);
      total = Array.isArray(payload) ? items.length : (payload.total ?? items.length);
      all.push(...items);
      if (!items.length || items.length < PAGE_SIZE) break;
      page += 1;
    }
    return all;
  }, [authToken, logout, queryFor]);

  const load = useCallback(async () => {
    if (!authToken) return;
    setLoading(true); setError('');
    try { setCalls(await fetchAll()); setTablePage(1); }
    catch (err) { if (err.message !== 'Unauthorized') setError(err.message || 'No se pudieron cargar las llamadas.'); }
    finally { setLoading(false); }
  }, [authToken, fetchAll]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => calls.map((call) => ({
    id: call.id || call.call_id,
    company: valueAt(call, ['company_name', 'client_company', 'empresa', 'client.company_name', 'client.company.name', 'campaign.company_name']) || '—',
    project: valueAt(call, ['project_name', 'project.name', 'campaign.project_name', 'campaign.project.name', 'campaign_name']) || '—',
    client: valueAt(call, ['client_name', 'client.name', 'contact_name']) || '—',
    calledAt: formatDateTime(valueAt(call, ['created_at', 'called_at', 'start_time'])),
    status: statusLabels[String(call.status || '').toLowerCase()] || call.status || '—',
    duration: formatDuration(call.duration),
    commitment: commitmentDate(call) || '—',
  })), [calls]);
  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const visibleRows = rows.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE);

  const changeStart = (value) => { setDateStart(value); if (dateEnd && value > dateEnd) setDateEnd(value); };
  const changeEnd = (value) => { setDateEnd(value); if (dateStart && value < dateStart) setDateStart(value); };
  const exportRows = async () => {
    setExporting(true); setError('');
    try { downloadExcel(calls.length ? rows : (await fetchAll()).map((call) => ({ company: valueAt(call, ['company_name', 'client_company', 'empresa']) || '—', project: valueAt(call, ['project_name', 'campaign_name']) || '—', client: call.client_name || '—', calledAt: formatDateTime(call.created_at), status: statusLabels[String(call.status || '').toLowerCase()] || call.status || '—', duration: formatDuration(call.duration), commitment: commitmentDate(call) || '—' }))); }
    catch (err) { if (err.message !== 'Unauthorized') setError(err.message || 'No se pudo exportar el reporte.'); }
    finally { setExporting(false); }
  };

  return <div className="max-w-[1600px] mx-auto space-y-6">
    <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div><h2 className="text-xl font-bold text-[#053E68]">Reporte de llamadas</h2><p className="text-sm text-gray-400 mt-1">{loading ? 'Cargando...' : `${rows.length} ${rows.length === 1 ? 'llamada' : 'llamadas'}`}</p></div>
        <div className="flex flex-wrap gap-2"><AreaFilter /><button onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button><button onClick={exportRows} disabled={loading || exporting} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#053E68] text-white text-sm font-medium hover:bg-[#06497c] disabled:opacity-50"><Download className="w-4 h-4" />{exporting ? 'Exportando...' : 'Exportar a Excel'}</button></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 max-w-xl"><label className="text-sm text-gray-600">Desde<input type="date" value={dateStart} max={dateEnd || undefined} onChange={(event) => changeStart(event.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg" /></label><label className="text-sm text-gray-600">Hasta<input type="date" value={dateEnd} min={dateStart || undefined} onChange={(event) => changeEnd(event.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg" /></label></div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </section>
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-[#053E68] text-white"><tr>{['Empresa', 'Proyecto', 'Cliente', 'Fecha/Hora de Llamada', 'Status de llamada', 'Duración de llamada', 'Fecha de compromiso de pago'].map((header) => <th key={header} className="px-4 py-3 font-semibold whitespace-nowrap">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{loading ? <tr><td colSpan="7" className="px-4 py-12 text-center text-gray-400">Cargando llamadas...</td></tr> : visibleRows.length ? visibleRows.map((row, index) => <tr key={row.id || index} className="hover:bg-gray-50"><td className="px-4 py-3">{row.company}</td><td className="px-4 py-3">{row.project}</td><td className="px-4 py-3 font-medium">{row.client}</td><td className="px-4 py-3 whitespace-nowrap">{row.calledAt}</td><td className="px-4 py-3">{row.status}</td><td className="px-4 py-3 whitespace-nowrap">{row.duration}</td><td className="px-4 py-3">{row.commitment}</td></tr>) : <tr><td colSpan="7" className="px-4 py-12 text-center text-gray-400">No hay llamadas para los filtros seleccionados.</td></tr>}</tbody></table></div>
      {rows.length > TABLE_PAGE_SIZE && <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600"><span>Página {tablePage} de {totalPages}</span><div className="flex gap-2"><button onClick={() => setTablePage((page) => page - 1)} disabled={tablePage === 1} className="px-3 py-1.5 border rounded-lg disabled:opacity-50">Anterior</button><button onClick={() => setTablePage((page) => page + 1)} disabled={tablePage === totalPages} className="px-3 py-1.5 border rounded-lg disabled:opacity-50">Siguiente</button></div></div>}
    </section>
  </div>;
}

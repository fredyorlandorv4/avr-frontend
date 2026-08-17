import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
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

function commitmentDate(call) {
  const direct = valueAt(call, [
    'analysis.payment_commitment_date', 'analysis.commitment_payment_date',
    'analysis.commitment_date', 'analysis.fecha_compromiso_pago',
  ]);
  if (direct) return typeof direct === 'object' ? JSON.stringify(direct) : direct;

  // El reporte toma el dato únicamente del mismo objeto que muestra el botón
  // "Análisis" en el monitor. Puede venir como campo o dentro de un texto del análisis.
  const date = '(?:\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?|\\d{1,2}\\s+de\\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\\s+de\\s+\\d{4})?|hoy|ma[ñn]ana|lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)';
  const textPatterns = [
    new RegExp(`(?:fecha\\s+de\\s+)?compromiso(?:\\s+de\\s+pago)?\\s*[:-]?\\s*([^\\n.]{3,80})`, 'i'),
    new RegExp(`(?:se\\s+)?compromet(?:e|ió|era)[\\s\\S]{0,90}?(${date})`, 'i'),
    new RegExp(`(?:pagar(?:á|a)?|realizar(?:á|a)?\\s+(?:el\\s+)?pago)[\\s\\S]{0,90}?(${date})`, 'i'),
  ];
  const findDateInText = (value) => {
    if (typeof value !== 'string') return '';
    for (const pattern of textPatterns) {
      const match = value.match(pattern);
      if (match) return match[1].trim();
    }
    return '';
  };

  const queue = [call.analysis];
  const seen = new Set();
  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);
    for (const [key, value] of Object.entries(item)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (typeof value !== 'object' && /(?:commitment|compromiso).*(?:payment|pago|date|fecha)|(?:payment|pago).*(?:commitment|compromiso)/.test(normalized)) {
        return String(value);
      }
      const dateInText = findDateInText(value);
      if (dateInText) return dateInText;
      if (value && typeof value === 'object') queue.push(value);
    }
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

const xmlEscape = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function downloadExcel(rows) {
  const headers = ['Empresa', 'Proyecto', 'Cliente', 'Fecha/Hora de Llamada', 'Status de llamada', 'Duración de llamada', 'Fecha de compromiso de pago'];
  const values = rows.map((row) => [row.company, row.project, row.client, row.calledAt, row.status, row.duration, row.commitment]);
  const widths = headers.map((header, index) => Math.min(420, Math.max(80, Math.max(header.length, ...values.map((row) => String(row[index] || '').length)) * 7.2 + 14)));
  const cells = (row, style) => row.map((value) => `<Cell ss:StyleID="${style}"><Data ss:Type="String">${xmlEscape(value || '—')}</Data></Cell>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles><Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#053E68" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF" ss:Bold="1"/></Style><Style ss:ID="cell"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style></Styles>
  <Worksheet ss:Name="Reportes"><Table>${widths.map((width) => `<Column ss:Width="${width}"/>`).join('')}<Row>${cells(headers, 'header')}</Row>${values.map((row) => `<Row>${cells(row, 'cell')}</Row>`).join('')}</Table></Worksheet>
</Workbook>`;
  const blob = new Blob([`\ufeff${xml}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte-llamadas-${today()}.xls`;
  link.click();
  URL.revokeObjectURL(url);
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

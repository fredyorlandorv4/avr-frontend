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
  'no-answer': 'Sin respuesta', no_answer: 'Sin respuesta', busy: 'Ocupado',
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
  if (!/(compromet|compromiso|pagara|pagar|pago|cita|agend)/.test(normalized)) return '';

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

function toReportRow(call) {
  const isVoicemail = Boolean(call.voicemail_detected ?? call.voicemailDetected ?? call.analysis?.voicemail_detection?.detected);
  const isCobros = String(call.area_name || call.area || '').trim().toLowerCase() === 'cobros';
  const row = {
    id: call.id || call.call_id,
    callIds: [call.id, call.call_id].filter((value) => value != null).map(String),
    project: valueAt(call, ['project_name', 'project.name', 'campaign.project_name', 'campaign.project.name', 'campaign_name']) || '—',
    client: valueAt(call, ['client_name', 'client.name', 'contact_name']) || '—',
    calledAt: formatDateTime(valueAt(call, ['created_at', 'called_at', 'start_time'])),
    status: statusLabels[String(call.status || '').toLowerCase()] || call.status || '—',
    duration: formatDuration(call.duration),
    commitment: commitmentDate(call) || '—',
    transcription: call.transcription || '—',
  };
  return {
    ...row,
    lote: isCobros ? (valueAt(call, ['lote', 'lot', 'contact.lote', 'cobros_campaign.lote']) || '—') : '',
    campaignCreator: isCobros ? (call.campaign_creator || '—') : '',
    isCobros,
    status: isVoicemail ? 'Buzón' : row.status,
  };
}

function downloadExcel(rows, dateHeader, includeCobrosDetails) {
  const headers = ['Proyecto', 'Cliente', 'Fecha/Hora de Llamada', 'Status de llamada', 'Duración de llamada', dateHeader, 'Follow Ups', 'Transcripción'];
  const values = rows.map((row) => [row.project, row.client, row.calledAt, row.status, row.duration, row.commitment, row.followUps, row.transcription]);
  if (includeCobrosDetails) {
    headers.splice(1, 0, 'Lote');
    headers.splice(7, 0, 'Creado por');
    values.forEach((value, index) => {
      value.splice(1, 0, rows[index].lote || '—');
      value.splice(7, 0, rows[index].campaignCreator || '—');
    });
  }
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...values]);
  worksheet['!cols'] = headers.map((header, index) => ({
    // El ancho se expresa en caracteres y se limita para evitar hojas inmanejables.
    wch: header === 'Transcripción'
      ? 32
      : Math.min(60, Math.max(header.length, ...values.map((row) => String(row[index] || '—').length)) + 2),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reportes');
  XLSX.writeFile(workbook, `reporte-llamadas-${today()}.xlsx`, { compression: true });
}

export default function ReportsView() {
  const { authToken, logout, areaName, isAdmin } = useAuth();
  const { scope, effectiveAreaId, areas } = useArea();
  const [dateStart, setDateStart] = useState(today);
  const [dateEnd, setDateEnd] = useState(today);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const [clientInput, setClientInput] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // La consulta se actualiza mientras se escribe sin saturar la API con una
  // petición por cada pulsación.
  useEffect(() => {
    const timer = setTimeout(() => setClientSearch(clientInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [clientInput]);

  const queryFor = useCallback((page) => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (scope.areaId != null) params.set('area_id', String(scope.areaId));
    if (scope.subarea) params.set('subarea', scope.subarea);
    if (dateStart) params.set('fecha_inicio', dateStart);
    if (dateEnd) params.set('fecha_fin', dateEnd);
    if (clientSearch.trim()) params.set('cliente', clientSearch.trim());
    if (statusFilter) params.set('estado', statusFilter);
    return params.toString();
  }, [scope, dateStart, dateEnd, clientSearch, statusFilter]);

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

  const fetchCobrosLots = useCallback(async (loadedCalls) => {
    const callIds = new Set(loadedCalls.map((call) => String(call.id ?? '')).filter(Boolean));
    const reportCampaignNames = new Set(
      loadedCalls
        .map((call) => String(call.campaign_name || '').trim())
        .filter(Boolean),
    );
    const lotsByCallId = new Map();
    const creatorsByCallId = new Map();
    const userNamesById = new Map();
    let skip = 0;

    try {
      const usersResponse = await apiFetch('/api/v1/auth/users', { token: authToken, onUnauthorized: logout });
      if (usersResponse.ok) {
        const users = await usersResponse.json();
        users.forEach((user) => userNamesById.set(String(user.id), user.full_name || user.username || `Usuario #${user.id}`));
      }
    } catch (error) {
      console.warn('No se pudo obtener el creador de las campañas', error);
    }

    // Reportes se alimenta de llamadas, que pueden pertenecer a campañas
    // creadas antes del rango consultado. Por eso no se filtra por fecha de
    // creación de campaña al construir el mapa de lotes.
    while (true) {
      const params = new URLSearchParams({ skip: String(skip), limit: '100', fecha_inicio: '2000-01-01', fecha_fin: today() });
      if (scope.areaId != null) params.set('area_id', String(scope.areaId));
      const campaignsResponse = await apiFetch(`/api/v1/campaigns?${params.toString()}`, { token: authToken, onUnauthorized: logout });
      if (!campaignsResponse.ok) break;

      const campaigns = await campaignsResponse.json();
      const cobrosCampaigns = campaigns.filter((campaign) => (
        String(campaign.area_name || '').trim().toLowerCase() === 'cobros'
        && reportCampaignNames.has(String(campaign.name || '').trim())
      ));

      for (const campaign of cobrosCampaigns) {
        try {
          const contactsResponse = await apiFetch(`/api/v1/campaigns/contacts_by_campaing/${campaign.id}`, { token: authToken, onUnauthorized: logout });
          if (!contactsResponse.ok) {
            console.warn(`No se pudieron cargar contactos para campaña ${campaign.id}: ${contactsResponse.status}`);
            continue;
          }
          const payload = await contactsResponse.json();
          const contacts = payload.contacts || [];
          contacts.forEach((contact) => {
            const callId = String(contact.call_id ?? '');
            if (callId && callIds.has(callId) && contact.lote) {
              const currentLots = lotsByCallId.get(callId) || [];
              if (!currentLots.includes(contact.lote)) lotsByCallId.set(callId, [...currentLots, contact.lote]);
            }
            if (callId && callIds.has(callId)) {
              creatorsByCallId.set(callId, userNamesById.get(String(campaign.user_id)) || `Usuario #${campaign.user_id}`);
            }
          });
        } catch (error) {
          // Un fallo de una campaña nunca debe impedir visualizar el reporte.
          console.warn(`Error cargando contactos para campaña ${campaign.id}`, error);
        }
      }

      if (campaigns.length < 100) break;
      skip += campaigns.length;
    }

    return { lotsByCallId, creatorsByCallId };
  }, [authToken, logout, scope.areaId]);

  const fetchFollowUps = useCallback(async () => {
    const all = [];
    const seenIds = new Set();
    let skip = 0;
    while (skip < 10000) {
      const params = new URLSearchParams({ skip: String(skip), limit: String(PAGE_SIZE) });
      if (scope.areaId != null) params.set('area_id', String(scope.areaId));
      if (scope.subarea) params.set('subarea', scope.subarea);
      const response = await apiFetch(`/api/v1/follow-ups?${params.toString()}`, { token: authToken, onUnauthorized: logout });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || 'No se pudieron cargar los follow-ups.');
      const payload = await response.json();
      const items = Array.isArray(payload) ? payload : (payload.items || payload.results || payload.data || []);
      // Algunos backends ignoran `skip` y responden siempre la primera página.
      // En ese caso, detenerse evita que Exportar quede permanentemente cargando.
      const newItems = items.filter((item) => {
        const id = item.id ?? `${item.call_id || ''}:${item.notes || ''}:${item.created_at || ''}`;
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });
      all.push(...newItems);
      if (newItems.length === 0) return all;
      if (items.length < PAGE_SIZE) return all;
      skip += items.length;
    }
    return all;
  }, [authToken, logout, scope]);

  const load = useCallback(async () => {
    if (!authToken) return;
    setLoading(true); setError('');
    try {
      const loadedCalls = await fetchAll();
      const { lotsByCallId, creatorsByCallId } = await fetchCobrosLots(loadedCalls);
      setCalls(loadedCalls.map((call) => ({
        ...call,
        lote: call.lote || lotsByCallId.get(String(call.id ?? ''))?.join(', ') || null,
        campaign_creator: creatorsByCallId.get(String(call.id ?? '')) || null,
      })));
      setTablePage(1);
    }
    catch (err) { if (err.message !== 'Unauthorized') setError(err.message || 'No se pudieron cargar las llamadas.'); }
    finally { setLoading(false); }
  }, [authToken, fetchAll, fetchCobrosLots]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => calls.map(toReportRow), [calls]);
  const showLoteColumn = rows.some((row) => row.isCobros);
  const activeAreaName = effectiveAreaId != null
    ? (areas.find((area) => area.id === effectiveAreaId)?.area || '')
    : areaName;
  const isTelemarketing = activeAreaName.trim().toLowerCase() === 'telemarketing';
  const dateHeader = isTelemarketing
    ? 'Fecha de cita'
    : isAdmin && effectiveAreaId == null
      ? 'Fecha de compromiso / cita'
      : 'Fecha compromiso de pago';
  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const visibleRows = rows.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE);

  const changeStart = (value) => { setDateStart(value); if (dateEnd && value > dateEnd) setDateEnd(value); };
  const changeEnd = (value) => { setDateEnd(value); if (dateStart && value < dateStart) setDateStart(value); };
  const exportRows = async () => {
    setExporting(true); setError('');
    try {
      const sourceRows = calls.length ? rows : (await fetchAll()).map(toReportRow);
      const followUps = await fetchFollowUps();
      const followUpsByCallId = new Map();
      followUps.forEach((followUp) => {
        if (followUp.call_id == null) return;
        const key = String(followUp.call_id);
        const text = String(followUp.notes || '').split('|').map((part) => part.trim()).filter(Boolean).join('\n');
        if (!text) return;
        followUpsByCallId.set(key, [...(followUpsByCallId.get(key) || []), text]);
      });
      downloadExcel(sourceRows.map((row) => ({
        ...row,
        followUps: row.callIds.flatMap((id) => followUpsByCallId.get(id) || []).filter((text, index, texts) => texts.indexOf(text) === index).join('\n\n') || '—',
      })), dateHeader, sourceRows.some((row) => row.isCobros));
    }
    catch (err) { if (err.message !== 'Unauthorized') setError(err.message || 'No se pudo exportar el reporte.'); }
    finally { setExporting(false); }
  };

  return <div className="max-w-[1600px] mx-auto space-y-6">
    <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div><h2 className="text-xl font-bold text-[#053E68]">Reporte de llamadas</h2><p className="text-sm text-gray-400 mt-1">{loading ? 'Cargando...' : `${rows.length} ${rows.length === 1 ? 'llamada' : 'llamadas'}`}</p></div>
        <div className="flex flex-wrap gap-2"><AreaFilter /><button onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button><button onClick={exportRows} disabled={loading || exporting} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#053E68] text-white text-sm font-medium hover:bg-[#06497c] disabled:opacity-50"><Download className="w-4 h-4" />{exporting ? 'Exportando...' : 'Exportar a Excel'}</button></div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-gray-600 w-40">Desde<input type="date" value={dateStart} max={dateEnd || undefined} onChange={(event) => changeStart(event.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg" /></label>
        <label className="text-sm text-gray-600 w-40">Hasta<input type="date" value={dateEnd} min={dateStart || undefined} onChange={(event) => changeEnd(event.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg" /></label>
        <label className="text-sm text-gray-600 w-52">Cliente<input type="search" value={clientInput} onChange={(event) => setClientInput(event.target.value)} placeholder="Nombre de cliente..." className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg" /></label>
        <label className="text-sm text-gray-600 w-40">Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"><option value="">Todos</option><option value="completed">Completadas</option><option value="voicemail">Buzón</option></select></label>
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </section>
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-[#053E68] text-white"><tr>{['Proyecto', ...(showLoteColumn ? ['Lote'] : []), 'Cliente', 'Fecha/Hora de Llamada', 'Status de llamada', 'Duración de llamada', dateHeader, ...(showLoteColumn ? ['Creado por'] : [])].map((header) => <th key={header} className="px-4 py-3 font-semibold whitespace-nowrap">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{loading ? <tr><td colSpan={showLoteColumn ? 8 : 6} className="px-4 py-12 text-center text-gray-400">Cargando llamadas...</td></tr> : visibleRows.length ? visibleRows.map((row, index) => <tr key={row.id || index} className="hover:bg-gray-50"><td className="px-4 py-3">{row.project}</td>{showLoteColumn && <td className="px-4 py-3">{row.lote || '—'}</td>}<td className="px-4 py-3 font-medium">{row.client}</td><td className="px-4 py-3 whitespace-nowrap">{row.calledAt}</td><td className="px-4 py-3">{row.status}</td><td className="px-4 py-3 whitespace-nowrap">{row.duration}</td><td className="px-4 py-3">{row.commitment}</td>{showLoteColumn && <td className="px-4 py-3">{row.campaignCreator || '—'}</td>}</tr>) : <tr><td colSpan={showLoteColumn ? 8 : 6} className="px-4 py-12 text-center text-gray-400">No hay llamadas para los filtros seleccionados.</td></tr>}</tbody></table></div>
      {rows.length > TABLE_PAGE_SIZE && <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600"><span>Página {tablePage} de {totalPages}</span><div className="flex gap-2"><button onClick={() => setTablePage((page) => page - 1)} disabled={tablePage === 1} className="px-3 py-1.5 border rounded-lg disabled:opacity-50">Anterior</button><button onClick={() => setTablePage((page) => page + 1)} disabled={tablePage === totalPages} className="px-3 py-1.5 border rounded-lg disabled:opacity-50">Siguiente</button></div></div>}
    </section>
  </div>;
}

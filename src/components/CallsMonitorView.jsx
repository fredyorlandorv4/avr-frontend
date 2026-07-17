import { useState, useRef, useCallback, useEffect } from 'react';
import { Phone, FileText, BarChart3, RefreshCw, Search, X, Headphones, Download, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useArea } from '../context/AreaContext.jsx';
import { apiFetch } from '../api.js';
import AreaFilter from './AreaFilter.jsx';
import { CallListSkeleton } from './Skeleton.jsx';

const getRecordingUrl = (callId) => `/api/v1/calls/${callId}/recording/download`;

const PAGE_SIZE = 20;

// Solo mostramos el botón en llamadas que podrían tener grabación
const RECORDABLE_STATUSES = ['completed', 'answered'];

const STATUS_MAP = {
  ringing:     'Timbrando',
  answered:    'Contestada',
  completed:   'Completada',
  active:      'Activa',
  pending:     'Pendiente',
  failed:      'Fallida',
  'no-answer': 'Sin respuesta',
  no_answer:   'Sin respuesta',
  busy:        'Ocupado',
  cancelled:   'Cancelada',
  initiated:   'Iniciada',
};

function getStatusLabel(status) { return STATUS_MAP[status] || status; }

function getStatusColor(status) {
  if (status === 'ringing' || status === 'active')     return 'bg-green-100 text-green-800';
  if (status === 'answered' || status === 'completed') return 'bg-blue-100 text-blue-800';
  if (status === 'pending' || status === 'initiated')  return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function getStatusIconColor(status) {
  if (status === 'ringing' || status === 'active')     return 'bg-green-100 text-green-600';
  if (status === 'answered' || status === 'completed') return 'bg-blue-100 text-blue-600';
  if (status === 'pending' || status === 'initiated')  return 'bg-yellow-100 text-yellow-600';
  return 'bg-red-100 text-red-600';
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function CallsMonitorView({ onViewTranscription, onViewAnalysis }) {
  const { authToken, logout } = useAuth();
  // El alcance (área / subárea / sin categorizar) lo maneja AreaFilter vía AreaContext.
  const { effectiveAreaId, scope } = useArea();

  // ── Filtros (todos se aplican en el backend) ──────────────
  // Por defecto cargamos solo las llamadas de hoy para no traer de más.
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [filterSearch,   setFilterSearch]   = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [dateStart,      setDateStart]      = useState(todayStr);
  const [dateEnd,        setDateEnd]        = useState(todayStr);

  // Búsqueda con debounce para no pegarle al backend en cada tecla
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(filterSearch.trim()), 400);
    return () => clearTimeout(t);
  }, [filterSearch]);

  // ── Datos / paginación ────────────────────────────────────
  const [calls,       setCalls]       = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(false);   // carga inicial / cambio de filtros
  const [loadingMore, setLoadingMore] = useState(false);   // scroll infinito
  const [loadError,   setLoadError]   = useState(null);

  const hasMore = calls.length < total;

  // Opciones de campaña para el selector (lista completa, no solo lo cargado)
  const [campaignOptions, setCampaignOptions] = useState([]);
  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ skip: '0', limit: '100' });
        if (effectiveAreaId != null) qs.set('area_id', String(effectiveAreaId));
        const res = await apiFetch(`/api/v1/campaigns?${qs.toString()}`, { token: authToken, onUnauthorized: logout });
        if (res.ok && !cancelled) {
          const data = await res.json();
          const names = [...new Set(
            (Array.isArray(data) ? data : [])
              .map(c => c.name || c.title)
              .filter(Boolean)
          )].sort();
          setCampaignOptions(names);
        }
      } catch (err) {
        if (err.message !== 'Unauthorized') console.error('Error loading campaigns:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [authToken, effectiveAreaId, logout]);

  // ── Query builder ─────────────────────────────────────────
  const buildQuery = useCallback((pageNum) => {
    const qs = new URLSearchParams();
    qs.set('page',  String(pageNum));
    qs.set('limit', String(PAGE_SIZE));
    // Alcance: area_id es el área; subarea es el id de la subárea o 'none'.
    if (scope.areaId != null)    qs.set('area_id', String(scope.areaId));
    if (scope.subarea)           qs.set('subarea', scope.subarea);
    if (filterStatus !== 'all')  qs.set('estado', filterStatus);
    if (filterCampaign)          qs.set('campana', filterCampaign);
    if (searchQuery)             qs.set('cliente', searchQuery);
    if (dateStart)               qs.set('fecha_inicio', dateStart);
    if (dateEnd)                 qs.set('fecha_fin', dateEnd);
    return qs.toString();
  }, [scope, filterStatus, filterCampaign, searchQuery, dateStart, dateEnd]);

  // ── Carga (append = scroll infinito) ──────────────────────
  const load = useCallback(async (pageNum, { append }) => {
    if (!authToken) return;
    append ? setLoadingMore(true) : setLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch(`/api/v1/calls/admin/all?${buildQuery(pageNum)}`, {
        token: authToken,
        onUnauthorized: logout,
      });
      if (res.ok) {
        const data = await res.json();
        setTotal(data.total ?? 0);
        setPage(data.page ?? pageNum);
        setCalls(prev => append ? [...prev, ...(data.items || [])] : (data.items || []));
      } else {
        const detail = await res.json().catch(() => null);
        setLoadError(detail?.detail || 'No se pudieron cargar las llamadas');
        if (!append) setCalls([]);
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        console.error('Error loading calls:', err);
        setLoadError('No se pudieron cargar las llamadas');
      }
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, [authToken, logout, buildQuery]);

  // Recarga desde la página 1 cada vez que cambia un filtro (buildQuery cambia).
  useEffect(() => {
    load(1, { append: false });
  }, [load]);

  // ── Scroll infinito (IntersectionObserver sobre un centinela) ──
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        load(page + 1, { append: true });
      }
    }, { rootMargin: '250px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, page, load]);

  // ── UI helpers ────────────────────────────────────────────
  const today = todayStr();

  // El rango se mantiene válido en el estado: el min/max del input es sólo una
  // pista para el calendario, no impide teclear una fecha fuera de rango.
  const changeDateStart = useCallback((value) => {
    setDateStart(value);
    if (value) setDateEnd((end) => (end && value > end ? value : end));
  }, []);
  const changeDateEnd = useCallback((value) => {
    setDateEnd(value);
    if (value) setDateStart((start) => (start && value < start ? value : start));
  }, []);
  const hasActiveFilters =
    filterStatus !== 'all' || filterSearch || filterCampaign ||
    dateStart !== today || dateEnd !== today;
  const clearFilters = () => {
    setFilterStatus('all'); setFilterSearch('');
    setFilterCampaign('');
    setDateStart(today);    setDateEnd(today);
  };

  const refresh = useCallback(() => { load(1, { append: false }); }, [load]);

  // ── Audio player ──────────────────────────────────────────
  const [activeAudioId, setActiveAudioId] = useState(null);
  const [audioLoading,  setAudioLoading]  = useState({});
  const [audioError,    setAudioError]    = useState({});
  const blobCache = useRef({});

  const handleToggleAudio = useCallback(async (call) => {
    const id = call.id;
    if (activeAudioId === id) { setActiveAudioId(null); return; }
    setActiveAudioId(id);
    if (blobCache.current[id]) return;

    setAudioLoading(prev => ({ ...prev, [id]: true }));
    setAudioError(prev => ({ ...prev, [id]: null }));
    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${BASE}${getRecordingUrl(id)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'Grabación no disponible' : `Error ${res.status}`);
      }
      const blob = await res.blob();
      blobCache.current[id] = URL.createObjectURL(blob);
    } catch (err) {
      setAudioError(prev => ({ ...prev, [id]: err.message || 'No se pudo cargar la grabación' }));
    } finally {
      setAudioLoading(prev => ({ ...prev, [id]: false }));
    }
  }, [activeAudioId, authToken]);

  const handleDownload = useCallback((call) => {
    const url = blobCache.current[call.id];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `grabacion_${call.call_id || call.id}.mp3`;
    a.click();
  }, []);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="w-full bg-white rounded-2xl shadow-sm p-6 border border-gray-100">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="w-1 h-7 bg-[#F4CD04] rounded-full" />
            <div>
              <p className="text-sm text-gray-400 mt-0.5">
                {loading
                  ? 'Cargando…'
                  : `${total} ${total === 1 ? 'llamada' : 'llamadas'}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AreaFilter />
            <button
              onClick={refresh}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition font-medium text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Nombre de cliente..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] text-sm transition"
            />
          </div>

          <select
            value={filterCampaign}
            onChange={(e) => setFilterCampaign(e.target.value)}
            disabled={campaignOptions.length === 0}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] text-sm transition disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            <option value="">Todas las campañas</option>
            {campaignOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] text-sm transition"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="completed">Completadas</option>
            <option value="pending">Pendientes</option>
            <option value="failed">Fallidas</option>
          </select>

          <button
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            title="Limpiar filtros"
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600"
          >
            <X className="w-4 h-4" />
            Limpiar
          </button>
        </div>

        {/* Rango de fechas */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">Desde</label>
            <input
              type="date"
              value={dateStart}
              max={dateEnd || today}
              onChange={(e) => changeDateStart(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] text-sm transition"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">Hasta</label>
            <input
              type="date"
              value={dateEnd}
              min={dateStart || undefined}
              max={today}
              onChange={(e) => changeDateEnd(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] text-sm transition"
            />
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <CallListSkeleton />
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-12">
            <X className="w-12 h-12 text-red-400 mb-4" />
            <p className="text-gray-500">{loadError}</p>
            <button onClick={refresh} className="mt-3 text-sm text-[#053E68] font-medium hover:underline">
              Reintentar
            </button>
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Phone className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-500">
              {hasActiveFilters ? 'No hay llamadas con los filtros aplicados' : 'No hay llamadas registradas'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-3 text-sm text-[#053E68] font-medium hover:underline">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {calls.map((call) => {
              const contactName  = call.client_name   || null;
              const phone        = call.destination   || '—';
              const campaignName = call.campaign_name || null;
              const hasRecording = RECORDABLE_STATUSES.includes(call.status);
              const isAudioOpen  = activeAudioId === call.id;
              const isLoading    = audioLoading[call.id];
              const error        = audioError[call.id];
              const blobUrl      = blobCache.current[call.id];

              return (
                <div key={call.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                  {/* Fila superior: info + estado */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full flex-shrink-0 mt-0.5 ${getStatusIconColor(call.status)}`}>
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        {contactName
                          ? <p className="font-semibold text-gray-800 leading-tight">{contactName}</p>
                          : <p className="font-semibold text-gray-400 italic text-sm">Sin nombre</p>
                        }
                        <p className="text-sm text-gray-600 font-mono mt-0.5">{phone}</p>
                        {campaignName && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-[#053E68]/5 text-[#053E68] text-xs rounded-full font-medium">
                            {campaignName}
                          </span>
                        )}
                        <p className="text-xs text-gray-400 mt-1">ID: {call.call_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start">
                      {call.area_name && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#F4CD04]/20 text-[#7a6800] capitalize">
                          {call.area_name}
                        </span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(call.status)}`}>
                        {getStatusLabel(call.status)}
                      </span>
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Duración</p>
                      <p className="text-sm font-medium text-gray-800">
                        {call.duration ? `${call.duration}s` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Hora Inicio</p>
                      <p className="text-sm font-medium text-gray-800">
                        {call.created_at ? new Date(call.created_at).toLocaleString('es-GT') : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onViewTranscription(call)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition"
                    >
                      <FileText className="w-4 h-4" />
                      Transcripción
                    </button>
                    <button
                      onClick={() => onViewAnalysis(call)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#053E68]/5 text-[#053E68] rounded-lg hover:bg-[#053E68]/10 transition"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Análisis
                    </button>

                    {hasRecording && (
                      <button
                        onClick={() => handleToggleAudio(call)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition ${
                          isAudioOpen
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {isLoading
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Headphones className="w-4 h-4" />
                        }
                        {isLoading ? 'Cargando...' : isAudioOpen ? 'Cerrar audio' : 'Escuchar'}
                      </button>
                    )}
                  </div>

                  {/* ── Player inline ── */}
                  {isAudioOpen && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      {isLoading && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                          Descargando grabación...
                        </div>
                      )}

                      {error && !isLoading && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <X className="w-4 h-4" /> {error}
                        </p>
                      )}

                      {blobUrl && !isLoading && (
                        <div className="space-y-2">
                          <audio
                            key={blobUrl}
                            src={blobUrl}
                            controls
                            autoPlay
                            className="w-full h-10"
                          />
                          <button
                            onClick={() => handleDownload(call)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                          >
                            <Download className="w-4 h-4" />
                            Descargar grabación
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Centinela + estado de scroll infinito */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex items-center justify-center py-4 text-gray-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Cargando más…</span>
              </div>
            )}
            {!hasMore && calls.length > 0 && (
              <p className="text-center text-xs text-gray-400 py-2">No hay más llamadas</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

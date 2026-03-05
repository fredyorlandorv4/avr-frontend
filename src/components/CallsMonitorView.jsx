import { useState, useMemo, useRef, useCallback } from 'react';
import { Phone, FileText, BarChart3, RefreshCw, Search, X, Headphones, Download, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

// ─────────────────────────────────────────────────────────────
// TODO: cuando el endpoint esté listo, actualiza esta función
// Ejemplo real: `/api/v1/calls/${callId}/recording`
// ─────────────────────────────────────────────────────────────
const getRecordingUrl = (callId) => `/api/v1/calls/${callId}/recording`;

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
  busy:        'Ocupado',
};

const STATUS_GROUPS = {
  active:    ['ringing', 'active'],
  completed: ['completed', 'answered'],
  pending:   ['pending'],
  failed:    ['failed', 'no-answer', 'busy'],
};

function getStatusLabel(status) { return STATUS_MAP[status] || status; }

function getStatusColor(status) {
  if (status === 'ringing' || status === 'active')     return 'bg-green-100 text-green-800';
  if (status === 'answered' || status === 'completed') return 'bg-blue-100 text-blue-800';
  if (status === 'pending')                            return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function getStatusIconColor(status) {
  if (status === 'ringing' || status === 'active')     return 'bg-green-100 text-green-600';
  if (status === 'answered' || status === 'completed') return 'bg-blue-100 text-blue-600';
  if (status === 'pending')                            return 'bg-yellow-100 text-yellow-600';
  return 'bg-red-100 text-red-600';
}

export default function CallsMonitorView({ calls, loading, onRefresh, onViewTranscription, onViewAnalysis }) {
  const { authToken } = useAuth();

  // Filtros
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [filterDate,     setFilterDate]     = useState('');
  const [filterSearch,   setFilterSearch]   = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');

  // Audio player
  const [activeAudioId, setActiveAudioId] = useState(null);   // call.id con player abierto
  const [audioLoading,  setAudioLoading]  = useState({});     // { [call.id]: true/false }
  const [audioError,    setAudioError]    = useState({});     // { [call.id]: 'mensaje' }
  const blobCache = useRef({});                               // { [call.id]: objectURL }

  // ── Campaña options ───────────────────────────────────────
  const campaignOptions = useMemo(() => {
    const names = new Set();
    calls.forEach(c => { if (c.campaign_name) names.add(c.campaign_name); });
    return [...names].sort();
  }, [calls]);

  // ── Filtrado client-side ──────────────────────────────────
  const filteredCalls = useMemo(() => {
    const search = filterSearch.trim().toLowerCase();
    return calls.filter(call => {
      if (filterStatus !== 'all') {
        const allowed = STATUS_GROUPS[filterStatus] || [];
        if (!allowed.includes(call.status)) return false;
      }
      if (filterDate) {
        if (!call.created_at) return false;
        const callDate = new Date(call.created_at).toISOString().slice(0, 10);
        if (callDate !== filterDate) return false;
      }
      if (search) {
        const name  = (call.client_name || '').toLowerCase();
        const phone = (call.destination  || '').toLowerCase();
        if (!name.includes(search) && !phone.includes(search)) return false;
      }
      if (filterCampaign) {
        if ((call.campaign_name || '') !== filterCampaign) return false;
      }
      return true;
    });
  }, [calls, filterStatus, filterDate, filterSearch, filterCampaign]);

  const hasActiveFilters = filterStatus !== 'all' || filterDate || filterSearch || filterCampaign;
  const clearFilters = () => {
    setFilterStatus('all'); setFilterDate('');
    setFilterSearch('');    setFilterCampaign('');
  };

  // ── Lógica del player ─────────────────────────────────────
  const handleToggleAudio = useCallback(async (call) => {
    const id = call.id;

    // Si ya está abierto, lo cerramos
    if (activeAudioId === id) {
      setActiveAudioId(null);
      return;
    }

    setActiveAudioId(id);

    // Si ya tenemos el blob en caché, no volvemos a pedir
    if (blobCache.current[id]) return;

    setAudioLoading(prev => ({ ...prev, [id]: true }));
    setAudioError(prev => ({ ...prev, [id]: null }));

    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${BASE}${getRecordingUrl(call.call_id || id)}`, {
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
    <div className="w-full mx-auto space-y-6">
      <div className="w-full bg-white rounded-xl shadow-sm p-6 border border-gray-100">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Monitor de Llamadas</h2>
            {!loading && (
              <p className="text-sm text-gray-500 mt-0.5">
                {filteredCalls.length} de {calls.length} llamadas
              </p>
            )}
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Nombre o teléfono..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <select
            value={filterCampaign}
            onChange={(e) => setFilterCampaign(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Todas las campañas</option>
            {campaignOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="completed">Completadas</option>
            <option value="pending">Pendientes</option>
            <option value="failed">Fallidas</option>
          </select>

          <div className="flex gap-2">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                title="Limpiar filtros"
                className="flex-shrink-0 flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="w-12 h-12 text-gray-400 animate-spin mb-4" />
            <p className="text-gray-500">Cargando llamadas...</p>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Phone className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-500">
              {calls.length === 0 ? 'No hay llamadas registradas' : 'No hay llamadas con los filtros aplicados'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-3 text-sm text-blue-600 hover:underline">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCalls.map((call) => {
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
                          <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                            {campaignName}
                          </span>
                        )}
                        <p className="text-xs text-gray-400 mt-1">ID: {call.call_id}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium self-start ${getStatusColor(call.status)}`}>
                      {getStatusLabel(call.status)}
                    </span>
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
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition"
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
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Phone, FileText, BarChart3, RefreshCw } from 'lucide-react';

const STATUS_MAP = {
  ringing:   'Timbrando',
  answered:  'Contestada',
  completed: 'Completada',
  active:    'Activa',
  pending:   'Pendiente',
  failed:    'Fallida',
  'no-answer': 'Sin respuesta',
  busy:      'Ocupado',
};

const STATUS_GROUPS = {
  active:    ['ringing', 'active'],
  completed: ['completed', 'answered'],
  pending:   ['pending'],
  failed:    ['failed', 'no-answer', 'busy'],
};

function getStatusLabel(status) {
  return STATUS_MAP[status] || status;
}

function getStatusColor(status) {
  if (status === 'ringing' || status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'answered' || status === 'completed') return 'bg-blue-100 text-blue-800';
  if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function getStatusIconColor(status) {
  if (status === 'ringing' || status === 'active') return 'bg-green-100 text-green-600';
  if (status === 'answered' || status === 'completed') return 'bg-blue-100 text-blue-600';
  if (status === 'pending') return 'bg-yellow-100 text-yellow-600';
  return 'bg-red-100 text-red-600';
}

export default function CallsMonitorView({ calls, loading, onRefresh, onViewTranscription, onViewAnalysis }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  const filteredCalls = useMemo(() => {
    return calls.filter(call => {
      // Status filter
      if (filterStatus !== 'all') {
        const allowed = STATUS_GROUPS[filterStatus] || [];
        if (!allowed.includes(call.status)) return false;
      }

      // Date filter — compare ISO date string (YYYY-MM-DD)
      if (filterDate) {
        if (!call.created_at) return false;
        const callDate = new Date(call.created_at).toISOString().slice(0, 10);
        if (callDate !== filterDate) return false;
      }

      return true;
    });
  }, [calls, filterStatus, filterDate]);

  return (
    <div className="w-full mx-auto space-y-6">
      <div className="w-full bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Monitor de Llamadas</h2>
          <button
            onClick={onRefresh}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="completed">Completadas</option>
            <option value="pending">Pendientes</option>
            <option value="failed">Fallidas</option>
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {(filterStatus !== 'all' || filterDate) && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterDate(''); }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Limpiar filtros
            </button>
          )}
        </div>

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
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCalls.map((call) => (
              <div key={call.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full flex-shrink-0 ${getStatusIconColor(call.status)}`}>
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{call.destination}</p>
                      <p className="text-sm text-gray-500">Desde: {call.caller_id}</p>
                      <p className="text-xs text-gray-400">ID: {call.call_id}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium self-start sm:self-auto ${getStatusColor(call.status)}`}>
                    {getStatusLabel(call.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Duración</p>
                    <p className="text-sm font-medium text-gray-800">{call.duration ? `${call.duration}s` : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Hora Inicio</p>
                    <p className="text-sm font-medium text-gray-800">
                      {call.created_at ? new Date(call.created_at).toLocaleString('es-GT') : 'N/A'}
                    </p>
                  </div>
                </div>

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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

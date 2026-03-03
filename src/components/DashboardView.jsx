import { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Phone, PhoneCall, PhoneOff, Clock, TrendingUp, RefreshCw } from 'lucide-react';

export default function DashboardView({ calls, stats, isMobile, onRefresh, onViewCallAnalysis }) {
  // --- Gráficas derivadas de datos reales ---

  // Llamadas por hora (hoy, 24 buckets)
  const callsByHour = useMemo(() => {
    const todayStr = new Date().toDateString();
    const buckets = {};

    calls.forEach(call => {
      if (!call.created_at) return;
      const d = new Date(call.created_at);
      if (d.toDateString() !== todayStr) return;
      const label = `${String(d.getHours()).padStart(2, '0')}:00`;
      buckets[label] = (buckets[label] || 0) + 1;
    });

    return Array.from({ length: 24 }, (_, i) => {
      const label = `${String(i).padStart(2, '0')}:00`;
      return { hour: label, calls: buckets[label] || 0 };
    });
  }, [calls]);

  // Distribución por estado
  const callsByStatus = useMemo(() => {
    const completed = calls.filter(c => c.status === 'completed' || c.status === 'answered').length;
    const failed    = calls.filter(c => c.status === 'failed').length;
    const noAnswer  = calls.filter(c => c.status === 'no-answer').length;
    const busy      = calls.filter(c => c.status === 'busy').length;

    return [
      { name: 'Completadas',   value: completed, color: '#10b981' },
      { name: 'Fallidas',      value: failed,    color: '#ef4444' },
      { name: 'Sin respuesta', value: noAnswer,  color: '#f59e0b' },
      { name: 'Ocupado',       value: busy,      color: '#6366f1' },
    ].filter(entry => entry.value > 0);
  }, [calls]);

  const getStatusLabel = (status) => {
    const map = {
      ringing: 'Activa', active: 'Activa',
      answered: 'Completada', completed: 'Completada',
      pending: 'Pendiente',
    };
    return map[status] || 'Fallida';
  };

  const getStatusColor = (status) => {
    if (status === 'ringing' || status === 'active') return 'bg-green-100 text-green-800';
    if (status === 'answered' || status === 'completed') return 'bg-blue-100 text-blue-800';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg"><PhoneCall className="w-6 h-6 text-green-600" /></div>
            <span className="text-2xl font-bold text-green-600">{stats.active}</span>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Llamadas Activas</h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg"><Phone className="w-6 h-6 text-blue-600" /></div>
            <span className="text-2xl font-bold text-blue-600">{stats.completed}</span>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Completadas</h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-50 rounded-lg"><Clock className="w-6 h-6 text-yellow-600" /></div>
            <span className="text-2xl font-bold text-yellow-600">{stats.pending}</span>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Pendientes</h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 rounded-lg"><PhoneOff className="w-6 h-6 text-red-600" /></div>
            <span className="text-2xl font-bold text-red-600">{stats.failed}</span>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Fallidas</h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-lg"><TrendingUp className="w-6 h-6 text-purple-600" /></div>
            <span className="text-2xl font-bold text-purple-600">{stats.avgDuration}s</span>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Duración Promedio</h3>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Llamadas por Hora (Hoy)</h3>
            <button onClick={onRefresh} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={callsByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" stroke="#9ca3af" tick={{ fontSize: 10 }} interval={3} />
                <YAxis stroke="#9ca3af" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="calls" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribución por Estado</h3>
          <div className="h-56 sm:h-64">
            {callsByStatus.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Phone className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">Sin datos de llamadas</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={callsByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={!isMobile}
                    label={isMobile ? false : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={isMobile ? 60 : 80}
                    dataKey="value"
                  >
                    {callsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Actividad Reciente</h3>
        <div className="overflow-x-auto -mx-6 px-6">
          {calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Phone className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500">No hay llamadas registradas</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {calls.slice(0, 5).map((call) => (
                  <div key={call.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{call.destination}</p>
                        <p className="text-xs text-gray-500 truncate">ID: {call.call_id}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                        {getStatusLabel(call.status)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Duración</p>
                        <p className="text-sm font-medium text-gray-800">{call.duration ? `${call.duration}s` : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Hora</p>
                        <p className="text-sm font-medium text-gray-800">
                          {call.created_at ? new Date(call.created_at).toLocaleString('es-GT') : '-'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onViewCallAnalysis(call)}
                      className="mt-4 w-full text-center px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium"
                    >
                      Ver detalles
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Teléfono</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Duración</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Hora</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.slice(0, 5).map((call) => (
                      <tr key={call.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="py-3 px-4 text-sm text-gray-800">{call.destination}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                            {getStatusLabel(call.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800">{call.duration ? `${call.duration}s` : 'N/A'}</td>
                        <td className="py-3 px-4 text-sm text-gray-800">
                          {call.created_at ? new Date(call.created_at).toLocaleString('es-GT') : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => onViewCallAnalysis(call)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Ver detalles
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

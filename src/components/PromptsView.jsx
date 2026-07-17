import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, FileText, Plus, Pencil, Trash2, Eye, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';
import { TableSkeleton } from './Skeleton.jsx';

// Resalta los {{...}} del prompt guardado para distinguirlos del texto.
function highlightVars(text) {
  return text.split(/(\{\{[^{}]+\}\})/g).map((chunk, i) =>
    /^\{\{[^{}]+\}\}$/.test(chunk)
      ? <mark key={i} className="bg-[#F4CD04]/40 text-[#053E68] font-semibold rounded px-1 py-0.5">{chunk}</mark>
      : <span key={i}>{chunk}</span>
  );
}

export default function PromptsView() {
  const { authToken, logout } = useAuth();
  const navigate = useNavigate();

  const [agents, setAgents]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [viewing, setViewing] = useState(null);   // agente cuyo prompt se está viendo

  // --- Carga ---
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/v1/agents', { token: authToken, onUnauthorized: logout });
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : []);
      } else {
        setError('Error al cargar los agentes.');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') setError('Error de conexión. Verifica que la API esté corriendo.');
    } finally {
      setLoading(false);
    }
  }, [authToken, logout]);

  useEffect(() => { loadData(); }, [loadData]);

  // El borrado es definitivo (se pierde el prompt), así que se confirma antes.
  const handleDelete = async (a) => {
    if (!window.confirm(`¿Eliminar el agente "${a.nombre}"? Se perderá su prompt.`)) return;
    setError('');
    try {
      const res = await apiFetch(`/api/v1/agents/${a.id}`, {
        method: 'DELETE', token: authToken, onUnauthorized: logout,
      });
      if (res.ok) {
        loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Error al eliminar el agente.');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') setError('Error de conexión. Verifica que la API esté corriendo.');
    }
  };

  // --- Listado ---
  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-9 bg-[#F4CD04] rounded-full" />
          <div>
            <h2 className="text-xl font-bold text-[#053E68] leading-tight">Prompts de agentes</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {agents.length} agente{agents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => navigate('/prompts/new')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuevo agente
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && agents.length === 0 ? (
          <div className="p-6">
            <TableSkeleton rows={5} cols={4} label="Cargando agentes" />
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-[#053E68]/5 rounded-full mb-4">
              <FileText className="w-10 h-10 text-[#053E68]" />
            </div>
            <p className="text-gray-600 font-medium mb-1">No hay agentes</p>
            <p className="text-gray-400 text-sm">Crea el primero con el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Agent ID</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3">Nota</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {agents.map((a, i) => (
                  <tr key={a.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-[#053E68]">{a.nombre}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-[#053E68]/5 text-[#053E68] px-2 py-0.5 rounded font-mono">{a.agent_id}</code>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{a.area || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={a.nota || ''}>{a.nota || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        a.status ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {a.status ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewing(a)}
                          title="Ver prompt"
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#053E68] transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/prompts/${a.id}/edit`)}
                          title="Editar"
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#053E68] transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(a)}
                          title="Eliminar"
                          className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: ver el prompt (solo lectura, tal como está guardado) */}
      {viewing && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setViewing(null)}
        >
          {/* Alto fijo: el modal mide lo mismo con cualquier prompt y es el
              cuerpo el que scrollea, no la ventana. */}
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 p-6 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1 h-9 bg-[#F4CD04] rounded-full shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-[#053E68] truncate">{viewing.nombre}</h3>
                  <p className="text-sm text-gray-400 mt-0.5 truncate">
                    <code className="font-mono">{viewing.agent_id}</code>
                    {viewing.area ? <span className="capitalize"> · {viewing.area}</span> : null}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewing(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              {viewing.prompt ? (
                <pre className="text-sm text-gray-700 font-mono whitespace-pre-wrap break-words leading-relaxed">
                  {highlightVars(viewing.prompt)}
                </pre>
              ) : (
                <div className="flex h-full flex-col items-center justify-center">
                  <FileText className="w-12 h-12 text-gray-300 mb-4" />
                  <p className="text-gray-500">Este agente no tiene prompt</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

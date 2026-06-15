import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, FileText, Pencil, Power, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';
import PromptEditor from './PromptEditor.jsx';

export default function PromptsView() {
  const { authToken, logout } = useAuth();
  const [prompts,  setPrompts]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(null);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await apiFetch('/api/v1/prompts/', { token: authToken, onUnauthorized: logout });
      const data = await res.json();
      setPrompts(Array.isArray(data) ? data : (data.items || data.results || data.data || []));
    } catch (err) {
      if (err.message !== 'Unauthorized') setError('Error al cargar los prompts.');
    } finally {
      setLoading(false);
    }
  }, [authToken, logout]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Eliminar el prompt "${name}"?`)) return;
    try {
      await apiFetch(`/api/v1/prompts/${id}`, { method: 'DELETE', token: authToken, onUnauthorized: logout });
      load();
    } catch {
      setError('Error al eliminar el prompt.');
    }
  };

  const handleToggleActive = async (p) => {
    try {
      await apiFetch(`/api/v1/prompts/${p.id}`, {
        method:          'PUT',
        token:           authToken,
        onUnauthorized:  logout,
        body:            { active: !p.active },
      });
      load();
    } catch {
      setError('Error al cambiar el estado del prompt.');
    }
  };

  if (editing !== null) return (
    <div className="max-w-[1280px] mx-auto">
      <PromptEditor
        promptId={editing === 'new' ? null : editing}
        onSaved={() => { setEditing(null); load(); }}
        onCancel={() => setEditing(null)}
      />
    </div>
  );

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-9 bg-[#F4CD04] rounded-full" />
          <div>
            <h2 className="text-xl font-bold text-[#053E68] leading-tight">Prompts de agentes</h2>
            <p className="text-sm text-gray-400 mt-0.5">Gestiona los templates de prompts para los agentes de voz</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuevo prompt
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Lista */}
      {loading && prompts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <RefreshCw className="w-10 h-10 text-gray-400 animate-spin mb-4" />
          <p className="text-gray-500">Cargando prompts...</p>
        </div>
      ) : prompts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4 bg-[#053E68]/5 rounded-full mb-4">
            <FileText className="w-10 h-10 text-[#053E68]" />
          </div>
          <p className="text-gray-600 font-medium mb-1">No hay prompts configurados</p>
          <p className="text-gray-400 text-sm">Crea el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {['Nombre', 'Tipo (agent_type)', 'Versión', 'Estado', 'Última edición', 'Acciones'].map(h => (
                    <th key={h} className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-left px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prompts.map(p => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3 font-medium text-[#053E68] whitespace-nowrap">{p.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <code className="text-xs bg-[#053E68]/5 text-[#053E68] px-2 py-0.5 rounded font-mono">{p.agent_type}</code>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap tabular-nums">v{p.version}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        p.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {p.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {p.updated_at ? new Date(p.updated_at).toLocaleDateString('es-GT') : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditing(p.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#053E68] bg-[#053E68]/5 rounded-lg hover:bg-[#053E68]/10 transition font-medium"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleActive(p)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition font-medium"
                        >
                          <Power className="w-3.5 h-3.5" />
                          {p.active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

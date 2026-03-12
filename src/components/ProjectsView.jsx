import { useState, useEffect, useCallback } from 'react';
import { Briefcase, Plus, RefreshCw, X, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';

export default function ProjectsView() {
  const { authToken, logout } = useAuth();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/projects', {
        token: authToken,
        onUnauthorized: logout,
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : data.items || data.results || []);
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  }, [authToken, logout]);

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async () => {
    if (!newProjectName.trim()) {
      setCreateError('Por favor ingresa un nombre para el proyecto');
      return;
    }

    setCreateLoading(true);
    setCreateError('');

    try {
      const res = await apiFetch('/api/v1/projects', {
        method: 'POST',
        token: authToken,
        onUnauthorized: logout,
        body: { name: newProjectName.trim() },
      });

      const data = await res.json();

      if (res.ok) {
        setNewProjectName('');
        setShowForm(false);
        await loadProjects();
      } else {
        setCreateError(data.detail || 'Error al crear el proyecto');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        setCreateError('Error de conexión. Verifica que la API esté corriendo.');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') handleCancelForm();
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setNewProjectName('');
    setCreateError('');
  };

  return (
    <div className="w-full mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Proyectos</h2>
          <p className="text-sm text-gray-500 mt-1">{projects.length} proyecto{projects.length !== 1 ? 's' : ''} registrado{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadProjects}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              Nuevo Proyecto
            </button>
          )}
        </div>
      </div>

      {/* Formulario de creación */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Nuevo Proyecto</h3>
            <button
              onClick={handleCancelForm}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {createError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-red-700 text-sm">{createError}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => { setNewProjectName(e.target.value); setCreateError(''); }}
              onKeyDown={handleKeyDown}
              disabled={createLoading}
              autoFocus
              placeholder="Nombre del proyecto"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={createLoading || !newProjectName.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createLoading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Creando...</>
                ) : (
                  <><Check className="w-4 h-4" /> Crear</>
                )}
              </button>
              <button
                onClick={handleCancelForm}
                disabled={createLoading}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de proyectos */}
      {loading && projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
          <RefreshCw className="w-10 h-10 text-gray-400 animate-spin mb-4" />
          <p className="text-gray-500">Cargando proyectos...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 bg-gray-100 rounded-full mb-4">
            <Briefcase className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium mb-1">No hay proyectos registrados</p>
          <p className="text-gray-400 text-sm">Crea tu primer proyecto usando el botón de arriba</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-50 rounded-lg flex-shrink-0">
                  <Briefcase className="w-6 h-6 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-800 truncate">{project.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">ID: {project.id}</p>
                  {project.created_at && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Creado: {new Date(project.created_at).toLocaleDateString('es-GT')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

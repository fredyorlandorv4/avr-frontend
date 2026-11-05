import { useState, useEffect, useCallback, useRef } from 'react';
import { Briefcase, Plus, RefreshCw, X, Check, Pencil, Trash2 } from 'lucide-react';
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
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const projectFormRef = useRef(null);

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
  }, [loadProjects]);

  const handleCreate = async () => {
    if (createLoading) return;
    if (!newProjectName.trim()) {
      setCreateError('Por favor ingresa un nombre para el proyecto');
      return;
    }

    setCreateLoading(true);
    setCreateError('');

    try {
      const res = await apiFetch(editingProject ? `/api/v1/projects/${editingProject.id}` : '/api/v1/projects', {
        method: editingProject ? 'PUT' : 'POST',
        token: authToken,
        onUnauthorized: logout,
        body: { name: newProjectName.trim() },
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setNewProjectName('');
        setShowForm(false);
        setEditingProject(null);
        await loadProjects();
      } else {
        setCreateError(typeof data.detail === 'string' ? data.detail : 'No se pudo guardar el proyecto.');
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
    setEditingProject(null);
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setNewProjectName(project.name);
    setCreateError('');
    setShowForm(true);
    window.requestAnimationFrame(() => {
      projectFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      projectFormRef.current?.querySelector('input')?.focus();
    });
  };

  const handleDelete = async () => {
    if (!deletingProject || deleteLoading) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await apiFetch(`/api/v1/projects/${deletingProject.id}`, {
        method: 'DELETE', token: authToken, onUnauthorized: logout,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(typeof data.detail === 'string' ? data.detail : 'No se pudo eliminar el proyecto.');
        return;
      }
      if (editingProject?.id === deletingProject.id) handleCancelForm();
      setDeletingProject(null);
      await loadProjects();
    } catch (err) {
      if (err.message !== 'Unauthorized') setDeleteError('Error de conexión. Verifica que la API esté corriendo.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-7 bg-[#F4CD04] rounded-full" />
          <div>
            <p className="text-sm text-gray-400 mt-0.5">{projects.length} proyecto{projects.length !== 1 ? 's' : ''} registrado{projects.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadProjects}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => { setEditingProject(null); setShowForm(true); }}
            disabled={showForm}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Nuevo Proyecto
          </button>
        </div>
      </div>

      {/* Formulario de creación */}
      {showForm && (
        <div ref={projectFormRef} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-5 bg-[#F4CD04] rounded-full" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex-1">{editingProject ? 'Editar proyecto' : 'Nuevo Proyecto'}</h3>
            <button
              onClick={handleCancelForm}
              disabled={createLoading}
              aria-label="Cerrar formulario de proyecto"
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
              aria-label="Nombre del proyecto"
              maxLength={200}
              value={newProjectName}
              onChange={(e) => { setNewProjectName(e.target.value); setCreateError(''); }}
              onKeyDown={handleKeyDown}
              disabled={createLoading}
              autoFocus
              placeholder="Nombre del proyecto"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] text-base transition disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={createLoading || !newProjectName.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createLoading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
                ) : (
                  <><Check className="w-4 h-4" /> {editingProject ? 'Guardar' : 'Crear'}</>
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
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <RefreshCw className="w-10 h-10 text-gray-400 animate-spin mb-4" />
          <p className="text-gray-500">Cargando proyectos...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4 bg-[#053E68]/5 rounded-full mb-4">
            <Briefcase className="w-10 h-10 text-[#053E68]" />
          </div>
          <p className="text-gray-600 font-medium mb-1">No hay proyectos registrados</p>
          <p className="text-gray-400 text-sm">Crea tu primer proyecto usando el botón de arriba</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#053E68]/5 rounded-xl flex-shrink-0">
                  <Briefcase className="w-6 h-6 text-[#053E68]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[#053E68] truncate">{project.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">ID: {project.id}</p>
                  {project.created_at && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Creado: {new Date(project.created_at).toLocaleDateString('es-GT')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => handleEdit(project)} disabled={createLoading || deleteLoading} aria-label={`Editar ${project.name}`} title="Editar" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#053E68] disabled:opacity-50">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => { setDeleteError(''); setDeletingProject(project); }} disabled={createLoading || deleteLoading} aria-label={`Eliminar ${project.name}`} title="Eliminar" className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-project-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="delete-project-title" className="text-lg font-bold text-[#053E68]">Eliminar proyecto</h3>
            <p className="mt-3 text-sm text-gray-700">¿Deseas eliminar <strong>{deletingProject.name}</strong>? Las campañas asociadas quedarán sin proyecto asignado.</p>
            {deleteError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{deleteError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={deleteLoading} onClick={() => setDeletingProject(null)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={deleteLoading} onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{deleteLoading ? 'Eliminando...' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

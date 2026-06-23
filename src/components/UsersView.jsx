import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Users, Plus, RefreshCw, X, Check, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useArea } from '../context/AreaContext.jsx';
import { apiFetch } from '../api.js';

const ROLES = [
  { value: 'agente',     label: 'Agente' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin',      label: 'Administrador' },
];
const ROLE_LABEL = { agente: 'Agente', supervisor: 'Supervisor', admin: 'Administrador' };

const EMPTY_FORM = {
  full_name: '', username: '', email: '', password: '',
  role: 'agente', area_id: '', is_active: true,
};

const inputCls =
  'w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] text-base transition disabled:bg-gray-100 disabled:cursor-not-allowed';

export default function UsersView() {
  const { authToken, logout, isSystem } = useAuth();
  const { areas } = useArea();

  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [filterArea, setFilterArea] = useState('');   // solo system

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);   // usuario en edición; null = creación
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  const [deletingUser, setDeletingUser] = useState(null);  // usuario a eliminar (abre modal)
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState('');

  // --- Carga ---
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const qs = isSystem && filterArea ? `?area_id=${filterArea}` : '';
      const res = await apiFetch(`/api/v1/auth/users${qs}`, { token: authToken, onUnauthorized: logout });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  }, [authToken, logout, isSystem, filterArea]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // --- Modal helpers ---
  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(''); setModalOpen(true); };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      full_name: u.full_name || '',
      username:  u.username,
      email:     u.email,
      password:  '',
      role:      u.role,
      area_id:   u.area_id != null ? String(u.area_id) : '',
      is_active: u.is_active,
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => { if (!saving) { setModalOpen(false); setEditing(null); } };
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Nombre del área: usa el del backend y, si no, lo busca en la lista (usuarios system)
  const areaNameOf = (u) => u.area_name || areas.find((a) => a.id === u.area_id)?.area || `#${u.area_id}`;

  // El rol "admin" solo existe en el área "system". El resto: supervisor o agente.
  const selectedAreaIsSystem = (() => {
    const a = areas.find((x) => String(x.id) === String(form.area_id));
    return !!a && (a.area || '').trim().toLowerCase() === 'system';
  })();
  const roleOptions = selectedAreaIsSystem ? ROLES : ROLES.filter((r) => r.value !== 'admin');

  // --- Guardar (crear / editar) ---
  const handleSave = async () => {
    setFormError('');

    if (!editing) {
      if (!form.username.trim() || !form.email.trim() || !form.password) {
        setFormError('Usuario, email y contraseña son obligatorios.'); return;
      }
      if (form.password.length < 8) { setFormError('La contraseña debe tener al menos 8 caracteres.'); return; }
      if (isSystem && !form.area_id) { setFormError('Selecciona un área.'); return; }
    } else if (form.password && form.password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.'); return;
    }

    setSaving(true);
    try {
      let res;
      if (!editing) {
        const body = {
          email:     form.email.trim(),
          username:  form.username.trim(),
          password:  form.password,
          full_name: form.full_name.trim() || null,
          role:      form.role,
        };
        if (isSystem) body.area_id = Number(form.area_id);  // no-system: el backend fuerza su área
        res = await apiFetch('/api/v1/auth/users', { method: 'POST', token: authToken, onUnauthorized: logout, body });
      } else {
        const body = {
          email:     form.email.trim(),
          full_name: form.full_name.trim() || null,
          role:      form.role,
        };
        if (isSystem && form.area_id) body.area_id = Number(form.area_id);
        if (form.password) body.password = form.password;
        res = await apiFetch(`/api/v1/auth/users/${editing.id}`, { method: 'PATCH', token: authToken, onUnauthorized: logout, body });
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setModalOpen(false); setEditing(null);
        await loadUsers();
      } else {
        setFormError(data.detail || 'Error al guardar el usuario.');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') setFormError('Error de conexión. Verifica que la API esté corriendo.');
    } finally {
      setSaving(false);
    }
  };

  // --- Eliminar ---
  const askDelete = (u) => { setDeletingUser(u); setDeleteError(''); };
  const closeDelete = () => { if (!deleting) { setDeletingUser(null); setDeleteError(''); } };

  const confirmDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await apiFetch(`/api/v1/auth/users/${deletingUser.id}`, { method: 'DELETE', token: authToken, onUnauthorized: logout });
      if (res.ok) {
        setDeletingUser(null);
        await loadUsers();
      } else {
        const d = await res.json().catch(() => ({}));
        setDeleteError(d.detail || 'No se pudo eliminar el usuario.');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') setDeleteError('Error de conexión. Verifica que la API esté corriendo.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-7 bg-[#F4CD04] rounded-full" />
          <div>
            <h2 className="text-xl font-bold text-[#053E68] leading-tight">Usuarios</h2>
            <p className="text-sm text-gray-400 mt-0.5">{users.length} usuario{users.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSystem && (
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="text-sm rounded-lg border border-gray-200 text-gray-700 bg-white px-2.5 py-2 outline-none focus:border-[#053E68] transition"
              title="Filtrar por área"
            >
              <option value="">Todas las áreas</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.area}</option>)}
            </select>
          )}
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-10 h-10 text-gray-400 animate-spin mb-4" />
            <p className="text-gray-500">Cargando usuarios...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-[#053E68]/5 rounded-full mb-4">
              <Users className="w-10 h-10 text-[#053E68]" />
            </div>
            <p className="text-gray-600 font-medium mb-1">No hay usuarios</p>
            <p className="text-gray-400 text-sm">Crea el primero con el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3 font-medium text-[#053E68]">{u.full_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{u.username}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-[#053E68]/5 text-[#053E68] capitalize">
                        {ROLE_LABEL[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{areaNameOf(u)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#053E68] transition"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => askDelete(u)}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"
                          title="Eliminar"
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

      {/* Modal crear / editar */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1 h-5 bg-[#F4CD04] rounded-full" />
              <h3 className="text-base font-bold text-[#053E68] flex-1">
                {editing ? 'Editar usuario' : 'Nuevo usuario'}
              </h3>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-red-700 text-sm">{formError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
                <input className={inputCls} value={form.full_name} disabled={saving}
                  onChange={(e) => setField('full_name', e.target.value)} placeholder="Ej: Juan Pérez" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Usuario *</label>
                <input className={inputCls} value={form.username} disabled={saving || !!editing}
                  onChange={(e) => setField('username', e.target.value)} placeholder="usuario" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                <input type="email" className={inputCls} value={form.email} disabled={saving}
                  onChange={(e) => setField('email', e.target.value)} placeholder="correo@ejemplo.com" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {editing ? 'Nueva contraseña' : 'Contraseña *'}
                </label>
                <input type="password" className={inputCls} value={form.password} disabled={saving}
                  onChange={(e) => setField('password', e.target.value)}
                  placeholder={editing ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Rol *</label>
                <select className={inputCls} value={form.role} disabled={saving}
                  onChange={(e) => setField('role', e.target.value)}>
                  {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {/* Área: solo el usuario "system" puede elegir/cambiar. El resto la hereda. */}
              {isSystem && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Área *</label>
                  <select className={inputCls} value={form.area_id} disabled={saving}
                    onChange={(e) => {
                      const v = e.target.value;
                      const a = areas.find((x) => String(x.id) === String(v));
                      const isSys = !!a && (a.area || '').trim().toLowerCase() === 'system';
                      setForm((f) => ({ ...f, area_id: v, role: (!isSys && f.role === 'admin') ? 'agente' : f.role }));
                    }}>
                    <option value="">-- Selecciona un área --</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.area}</option>)}
                  </select>
                </div>
              )}

            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition font-medium disabled:opacity-50"
              >
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</> : <><Check className="w-4 h-4" /> {editing ? 'Guardar' : 'Crear'}</>}
              </button>
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de confirmación de eliminación */}
      {deletingUser && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          onClick={closeDelete}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Banda superior de advertencia */}
            <div className="relative bg-red-50 px-6 pt-7 pb-6 text-center">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-100 rounded-full opacity-60" />
              <div className="relative z-10 mx-auto mb-3 flex items-center justify-center w-16 h-16 rounded-full bg-red-100 ring-8 ring-red-50">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="relative z-10 text-lg font-bold text-gray-900">Eliminar usuario</h3>
            </div>

            {/* Cuerpo */}
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                ¿Seguro que deseas eliminar a{' '}
                <span className="font-semibold text-gray-900">
                  {deletingUser.full_name || deletingUser.username}
                </span>
                ? El usuario quedará <span className="font-medium">inactivo</span> y dejará de aparecer en la lista.
              </p>

              {/* Tarjeta con datos del usuario */}
              <div className="mt-4 flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#053E68] text-[#F4CD04] font-bold uppercase flex-shrink-0">
                  {(deletingUser.full_name || deletingUser.username || 'U').charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#053E68] truncate">{deletingUser.username}</p>
                  <p className="text-xs text-gray-400 truncate">{deletingUser.email}</p>
                </div>
              </div>

              {deleteError && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-red-700 text-sm">{deleteError}</p>
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={closeDelete}
                disabled={deleting}
                className="flex-1 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleting
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Eliminando...</>
                  : <><Trash2 className="w-4 h-4" /> Eliminar</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

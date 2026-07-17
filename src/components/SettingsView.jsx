import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Layers, RefreshCw, Phone, Plus, X, Check, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';

const inputCls =
  'w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] text-base transition disabled:bg-gray-100 disabled:cursor-not-allowed';

const EMPTY_DID  = { did: '', label: '', area_id: '', subarea: '', status: true };
const EMPTY_AREA = { area: '', description: '' };
const EMPTY_SUB  = { name: '', area_id: '' };

export default function SettingsView() {
  const { authToken, logout } = useAuth();

  const [areas, setAreas]       = useState([]);
  const [subareas, setSubareas] = useState([]);
  const [dids, setDids]         = useState([]);
  const [loading, setLoading]   = useState(false);

  // --- Modal Área (crear / editar) ---
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [areaEditing, setAreaEditing]     = useState(null);   // null = creación
  const [areaForm, setAreaForm]           = useState(EMPTY_AREA);
  const [areaSaving, setAreaSaving]       = useState(false);
  const [areaError, setAreaError]         = useState('');

  // --- Modal Subárea (crear / editar) ---
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subEditing, setSubEditing]     = useState(null);   // null = creación
  const [subForm, setSubForm]           = useState(EMPTY_SUB);
  const [subSaving, setSubSaving]       = useState(false);
  const [subError, setSubError]         = useState('');

  // --- Modal DID (crear / editar) ---
  const [didModalOpen, setDidModalOpen] = useState(false);
  const [didEditing, setDidEditing]     = useState(null);   // null = creación
  const [didForm, setDidForm]           = useState(EMPTY_DID);
  const [didError, setDidError]         = useState('');
  const [didSaving, setDidSaving]       = useState(false);
  const [areaSubareas, setAreaSubareas] = useState([]);   // subáreas del área elegida
  const [loadingSubareas, setLoadingSubareas] = useState(false);

  const selectedArea = areas.find((a) => String(a.id) === String(didForm.area_id)) || null;
  const needsSubarea = !!selectedArea?.subareas;

  // --- Carga ---
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [areasRes, subareasRes, didsRes] = await Promise.all([
        apiFetch('/api/v1/areas',       { token: authToken, onUnauthorized: logout }),
        apiFetch('/api/v1/subareas',    { token: authToken, onUnauthorized: logout }),
        apiFetch('/api/v1/did-numbers', { token: authToken, onUnauthorized: logout }),
      ]);

      if (areasRes.ok) {
        const data = await areasRes.json();
        setAreas(Array.isArray(data) ? data : []);
      }
      if (subareasRes.ok) {
        const data = await subareasRes.json();
        setSubareas(Array.isArray(data) ? data : []);
      }
      if (didsRes.ok) {
        // DidNumberListItem: { did, tag, area, status } — el área ya viene resuelta.
        const didsList = await didsRes.json();
        setDids((Array.isArray(didsList) ? didsList : []).map((d) => ({
          id:     d.id,
          did:    d.did,
          label:  d.tag,
          area:   d.area,
          status: d.status,
        })));
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') console.error('Error loading settings data:', err);
    } finally {
      setLoading(false);
    }
  }, [authToken, logout]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Áreas ──────────────────────────────────────────────────────────────────
  const openAreaCreate = () => {
    setAreaEditing(null); setAreaForm(EMPTY_AREA); setAreaError(''); setAreaModalOpen(true);
  };
  const openAreaEdit = (a) => {
    setAreaEditing(a);
    setAreaForm({ area: a.area || '', description: a.description || '' });
    setAreaError('');
    setAreaModalOpen(true);
  };
  const closeAreaModal = () => { if (!areaSaving) { setAreaModalOpen(false); setAreaEditing(null); } };

  const handleSaveArea = async () => {
    setAreaError('');
    if (!areaForm.area.trim()) { setAreaError('El nombre del área es obligatorio.'); return; }
    if (areaForm.area.trim().length > 20) { setAreaError('El área no puede exceder 20 caracteres.'); return; }
    if (!areaForm.description.trim()) { setAreaError('La descripción es obligatoria.'); return; }

    // "subareas" no se envía: lo gestiona el backend, no lo elige el usuario.
    const body = {
      area:        areaForm.area.trim(),
      description: areaForm.description.trim(),
    };

    setAreaSaving(true);
    try {
      const res = areaEditing
        ? await apiFetch(`/api/v1/areas/${areaEditing.id}`, { method: 'PUT', token: authToken, onUnauthorized: logout, body })
        : await apiFetch('/api/v1/areas', { method: 'POST', token: authToken, onUnauthorized: logout, body });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAreaModalOpen(false); setAreaEditing(null);
        await loadData();
      } else {
        setAreaError(data.detail || 'Error al guardar el área.');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') setAreaError('Error de conexión. Verifica que la API esté corriendo.');
    } finally {
      setAreaSaving(false);
    }
  };

  // ── Subáreas ───────────────────────────────────────────────────────────────
  const openSubCreate = () => {
    setSubEditing(null); setSubForm(EMPTY_SUB); setSubError(''); setSubModalOpen(true);
  };
  const openSubEdit = (s) => {
    setSubEditing(s);
    // El listado trae el área por nombre; se resuelve su id para preseleccionarla.
    const parent = areas.find((a) => (a.area || '').trim().toLowerCase() === (s.area || '').trim().toLowerCase());
    setSubForm({ name: s.name || '', area_id: parent ? String(parent.id) : '' });
    setSubError('');
    setSubModalOpen(true);
  };
  const closeSubModal = () => { if (!subSaving) { setSubModalOpen(false); setSubEditing(null); } };

  const handleSaveSub = async () => {
    setSubError('');
    if (!subForm.name.trim()) { setSubError('El nombre de la subárea es obligatorio.'); return; }
    if (!subForm.area_id)     { setSubError('Selecciona un área.'); return; }

    const body = { name: subForm.name.trim(), area_id: Number(subForm.area_id) };

    setSubSaving(true);
    try {
      const res = subEditing
        ? await apiFetch(`/api/v1/subareas/${subEditing.id}`, { method: 'PUT', token: authToken, onUnauthorized: logout, body })
        : await apiFetch('/api/v1/subareas', { method: 'POST', token: authToken, onUnauthorized: logout, body });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubModalOpen(false); setSubEditing(null);
        await loadData();
      } else {
        setSubError(data.detail || 'Error al guardar la subárea.');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') setSubError('Error de conexión. Verifica que la API esté corriendo.');
    } finally {
      setSubSaving(false);
    }
  };

  // ── DIDs ───────────────────────────────────────────────────────────────────
  const openDidModal = () => {
    setDidEditing(null); setDidForm(EMPTY_DID); setDidError(''); setAreaSubareas([]); setDidModalOpen(true);
  };

  const openDidEdit = (d) => {
    setDidEditing(d);

    // El listado solo trae un nombre en "area", que puede ser un área o una subárea.
    const name = (d.area || '').trim().toLowerCase();
    let parent = areas.find((a) => (a.area || '').trim().toLowerCase() === name);
    let subUuid = '';
    if (!parent) {
      const sub = subareas.find((s) => (s.name || '').trim().toLowerCase() === name);
      if (sub) {
        parent = areas.find((a) => (a.area || '').trim().toLowerCase() === (sub.area || '').trim().toLowerCase());
        subUuid = sub.uuid || '';
      }
    }

    setDidForm({
      did:     d.did || '',
      label:   d.label || '',
      area_id: parent ? String(parent.id) : '',
      subarea: subUuid,
      status:  !!d.status,
    });
    setAreaSubareas([]);
    if (parent?.subareas) loadSubareasForArea(parent);
    setDidError('');
    setDidModalOpen(true);
  };

  const closeDidModal = () => { if (!didSaving) { setDidModalOpen(false); setDidEditing(null); } };
  const setDidField = (k, v) => setDidForm((f) => ({ ...f, [k]: v }));

  // El DID solo admite dígitos, no puede empezar con 0 y tiene un máximo de 8.
  const setDidNumber = (value) => {
    const digits = value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 8);
    setDidField('did', digits);
  };

  // Subáreas de un área concreta: el endpoint recibe el area_id y devuelve { uuid, name }.
  const loadSubareasForArea = useCallback(async (area) => {
    if (!area) { setAreaSubareas([]); return; }
    setLoadingSubareas(true);
    try {
      const res = await apiFetch(`/api/v1/subareas/area/${area.id}`, { token: authToken, onUnauthorized: logout });
      if (res.ok) {
        const data = await res.json();
        setAreaSubareas(Array.isArray(data) ? data : []);
      } else {
        setAreaSubareas([]);
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') console.error('Error loading subareas:', err);
      setAreaSubareas([]);
    } finally {
      setLoadingSubareas(false);
    }
  }, [authToken, logout]);

  // Al cambiar el área: reinicia la subárea y, si el área tiene subáreas, las carga.
  const onDidAreaChange = (value) => {
    const area = areas.find((a) => String(a.id) === String(value)) || null;
    setDidForm((f) => ({ ...f, area_id: value, subarea: '' }));
    setAreaSubareas([]);
    if (area?.subareas) loadSubareasForArea(area);
  };

  const handleSaveDid = async () => {
    setDidError('');
    if (!didForm.did.trim()) { setDidError('El DID es obligatorio.'); return; }
    if (!/^[1-9]\d{7}$/.test(didForm.did)) {
      setDidError('El DID debe tener exactamente 8 dígitos y no puede empezar con 0.'); return;
    }
    if (!didForm.label.trim()) { setDidError('La etiqueta es obligatoria.'); return; }
    if (!didForm.area_id)      { setDidError('Selecciona un área.'); return; }
    if (needsSubarea && !didForm.subarea) { setDidError('Selecciona una subárea.'); return; }

    // area_uuid = uuid de la subárea si el área tiene subáreas; si no, uuid del área.
    const body = {
      DID:       didForm.did.trim(),
      tag:       didForm.label.trim(),
      area_uuid: needsSubarea ? didForm.subarea : (selectedArea?.uuid || ''),
    };
    // El estado solo se puede cambiar al editar (DidNumberCreate no lo acepta).
    if (didEditing) body.status = didForm.status;

    setDidSaving(true);
    try {
      const res = didEditing
        ? await apiFetch(`/api/v1/did-numbers/${didEditing.id}`, { method: 'PUT', token: authToken, onUnauthorized: logout, body })
        : await apiFetch('/api/v1/did-numbers', { method: 'POST', token: authToken, onUnauthorized: logout, body });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDidModalOpen(false); setDidEditing(null);
        await loadData();
      } else {
        setDidError(data.detail || 'Error al guardar el DID.');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') setDidError('Error de conexión. Verifica que la API esté corriendo.');
    } finally {
      setDidSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* ── Áreas ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-7 bg-[#F4CD04] rounded-full" />
          <div>
            <h2 className="text-xl font-bold text-[#053E68] leading-tight">Áreas</h2>
            <p className="text-sm text-gray-400 mt-0.5">{areas.length} área{areas.length !== 1 ? 's' : ''}</p>
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
            onClick={openAreaCreate}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nueva Área
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && areas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-10 h-10 text-gray-400 animate-spin mb-4" />
            <p className="text-gray-500">Cargando áreas...</p>
          </div>
        ) : areas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-[#053E68]/5 rounded-full mb-4">
              <Layers className="w-10 h-10 text-[#053E68]" />
            </div>
            <p className="text-gray-600 font-medium mb-1">No hay áreas</p>
            <p className="text-gray-400 text-sm">Crea la primera con el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Subáreas</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {areas.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3 text-gray-400">{a.id}</td>
                    <td className="px-4 py-3 font-medium text-[#053E68] capitalize">{a.area}</td>
                    <td className="px-4 py-3 text-gray-600">{a.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        a.subareas ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {a.subareas ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => openAreaEdit(a)}
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#053E68] transition"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
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

      {/* ── Subáreas ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <div className="flex items-center gap-2">
          <span className="w-1 h-7 bg-[#F4CD04] rounded-full" />
          <div>
            <h2 className="text-xl font-bold text-[#053E68] leading-tight">Subáreas</h2>
            <p className="text-sm text-gray-400 mt-0.5">{subareas.length} subárea{subareas.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={openSubCreate}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva Subárea
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Subárea</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subareas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="p-4 bg-[#053E68]/5 rounded-full mb-4">
                        <Layers className="w-9 h-9 text-[#053E68]" />
                      </div>
                      <p className="text-gray-600 font-medium mb-1">No hay subáreas</p>
                      <p className="text-gray-400 text-sm">Crea la primera con el botón de arriba</p>
                    </div>
                  </td>
                </tr>
              ) : (
                subareas.map((s, i) => (
                  <tr key={s.id ?? s.uuid ?? i} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-[#053E68] capitalize">{s.name}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{s.area || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => openSubEdit(s)}
                          title="Editar"
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#053E68] transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DIDs ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <div className="flex items-center gap-2">
          <span className="w-1 h-7 bg-[#F4CD04] rounded-full" />
          <div>
            <h2 className="text-xl font-bold text-[#053E68] leading-tight">DIDs</h2>
            <p className="text-sm text-gray-400 mt-0.5">{dids.length} DID{dids.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={openDidModal}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Agregar DID
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">DID</th>
                <th className="px-4 py-3">Etiqueta</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dids.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="p-4 bg-[#053E68]/5 rounded-full mb-4">
                        <Phone className="w-9 h-9 text-[#053E68]" />
                      </div>
                      <p className="text-gray-600 font-medium mb-1">No hay DIDs</p>
                      <p className="text-gray-400 text-sm">Agrega el primero con el botón de arriba</p>
                    </div>
                  </td>
                </tr>
              ) : (
                dids.map((d, i) => (
                  <tr key={`${d.did}-${i}`} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-[#053E68]">{d.did}</td>
                    <td className="px-4 py-3 text-gray-600">{d.label || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{d.area || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        d.status ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {d.status ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => openDidEdit(d)}
                          title="Editar"
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#053E68] transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Área (crear / editar) */}
      {areaModalOpen && createPortal(
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={closeAreaModal}>
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1 h-5 bg-[#F4CD04] rounded-full" />
              <h3 className="text-base font-bold text-[#053E68] flex-1">
                {areaEditing ? 'Editar área' : 'Nueva área'}
              </h3>
              <button onClick={closeAreaModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {areaError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-red-700 text-sm">{areaError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Área *</label>
                <input className={inputCls} value={areaForm.area} disabled={areaSaving} maxLength={20}
                  onChange={(e) => setAreaForm((f) => ({ ...f, area: e.target.value }))}
                  placeholder="Ej: cobros" />
                <p className="text-xs text-gray-400 mt-1.5">Máximo 20 caracteres.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción *</label>
                <textarea className={`${inputCls} resize-none`} rows={3} value={areaForm.description}
                  disabled={areaSaving} maxLength={255}
                  onChange={(e) => setAreaForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Descripción del área" />
                <p className="text-xs text-gray-400 mt-1.5">Máximo 255 caracteres.</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveArea}
                disabled={areaSaving}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition font-medium disabled:opacity-50"
              >
                {areaSaving
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
                  : <><Check className="w-4 h-4" /> {areaEditing ? 'Guardar' : 'Crear'}</>}
              </button>
              <button
                onClick={closeAreaModal}
                disabled={areaSaving}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Subárea (crear) */}
      {subModalOpen && createPortal(
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={closeSubModal}>
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1 h-5 bg-[#F4CD04] rounded-full" />
              <h3 className="text-base font-bold text-[#053E68] flex-1">
                {subEditing ? 'Editar subárea' : 'Nueva subárea'}
              </h3>
              <button onClick={closeSubModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {subError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-red-700 text-sm">{subError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subárea *</label>
                <input className={inputCls} value={subForm.name} disabled={subSaving} maxLength={255}
                  onChange={(e) => setSubForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: cobros tempranos" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Área *</label>
                <select className={inputCls} value={subForm.area_id} disabled={subSaving}
                  onChange={(e) => setSubForm((f) => ({ ...f, area_id: e.target.value }))}>
                  <option value="">-- Selecciona un área --</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.area}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveSub}
                disabled={subSaving}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition font-medium disabled:opacity-50"
              >
                {subSaving
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
                  : <><Check className="w-4 h-4" /> {subEditing ? 'Guardar' : 'Crear'}</>}
              </button>
              <button
                onClick={closeSubModal}
                disabled={subSaving}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Agregar DID */}
      {didModalOpen && createPortal(
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={closeDidModal}>
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1 h-5 bg-[#F4CD04] rounded-full" />
              <h3 className="text-base font-bold text-[#053E68] flex-1">
                {didEditing ? 'Editar DID' : 'Agregar DID'}
              </h3>
              <button onClick={closeDidModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {didError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-red-700 text-sm">{didError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">DID *</label>
                <input className={inputCls} value={didForm.did} disabled={didSaving}
                  inputMode="numeric" maxLength={8} autoComplete="off"
                  onChange={(e) => setDidNumber(e.target.value)} placeholder="Ej: 23456789" />
                <p className="text-xs text-gray-400 mt-1.5">8 dígitos, no puede empezar con 0.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Etiqueta *</label>
                <input className={inputCls} value={didForm.label} disabled={didSaving}
                  onChange={(e) => setDidField('label', e.target.value)} placeholder="Ej: Línea de ventas" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Área *</label>
                <select className={inputCls} value={didForm.area_id} disabled={didSaving}
                  onChange={(e) => onDidAreaChange(e.target.value)}>
                  <option value="">-- Selecciona un área --</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.area}</option>)}
                </select>
              </div>

              {/* Si el área tiene subáreas, hay que elegir una de ellas. */}
              {needsSubarea && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Subárea *</label>
                  <select className={inputCls} value={didForm.subarea} disabled={loadingSubareas || didSaving}
                    onChange={(e) => setDidField('subarea', e.target.value)}>
                    <option value="">
                      {loadingSubareas ? 'Cargando subáreas...' : '-- Selecciona una subárea --'}
                    </option>
                    {areaSubareas.map((s) => <option key={s.uuid} value={s.uuid}>{s.name}</option>)}
                  </select>
                  {!loadingSubareas && areaSubareas.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1.5">Esta área no tiene subáreas disponibles.</p>
                  )}
                </div>
              )}

              {/* El estado solo se puede cambiar al editar. */}
              {didEditing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
                  <select className={inputCls} value={didForm.status ? 'true' : 'false'} disabled={didSaving}
                    onChange={(e) => setDidField('status', e.target.value === 'true')}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveDid}
                disabled={didSaving}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition font-medium disabled:opacity-50"
              >
                {didSaving
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
                  : <><Check className="w-4 h-4" /> {didEditing ? 'Guardar' : 'Agregar'}</>}
              </button>
              <button
                onClick={closeDidModal}
                disabled={didSaving}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

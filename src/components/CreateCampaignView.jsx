import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, RefreshCw, ChevronDown, CheckCircle2, AlertCircle, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useArea } from '../context/AreaContext.jsx';
import { apiFetch } from '../api.js';

export default function CreateCampaignView({ onCancel, onSuccess }) {
  const { authToken, logout, isSystem, areaId, areaName } = useAuth();
  const { areas } = useArea();   // lista de áreas (cargada solo para usuarios "system")
  const [campaignName, setCampaignName] = useState('');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Subáreas: se usa el listado completo porque es el único que trae el id
  // ({ id, uuid, name, area }); /subareas/area/{id} solo devuelve { uuid, name }.
  const [allSubareas, setAllSubareas] = useState([]);
  const [subareasLoading, setSubareasLoading] = useState(false);
  const [selectedSubareaId, setSelectedSubareaId] = useState('');

  // Cargar proyectos al montar el componente
  useEffect(() => {
    const loadProjects = async () => {
      setProjectsLoading(true);
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
        setProjectsLoading(false);
      }
    };
    loadProjects();
  }, []);

  // El usuario "system" elige el área; el resto hereda automáticamente la suya.
  useEffect(() => {
    if (!isSystem && areaId != null) setSelectedAreaId(String(areaId));
  }, [isSystem, areaId]);

  // Subáreas disponibles (para el área elegida o, si no es system, para la propia).
  useEffect(() => {
    const loadSubareas = async () => {
      setSubareasLoading(true);
      try {
        const res = await apiFetch('/api/v1/subareas', { token: authToken, onUnauthorized: logout });
        if (res.ok) {
          const data = await res.json();
          setAllSubareas(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (err.message !== 'Unauthorized') console.error('Error loading subareas:', err);
      } finally {
        setSubareasLoading(false);
      }
    };
    loadSubareas();
  }, [authToken, logout]);

  // Área vigente: la que elige el system-admin, o la propia para el resto.
  const selectedArea = areas.find((a) => String(a.id) === String(selectedAreaId)) || null;
  const currentAreaName = isSystem ? (selectedArea?.area || '') : (areaName || '');

  const availableSubareas = allSubareas.filter(
    (s) => (s.area || '').trim().toLowerCase() === currentAreaName.trim().toLowerCase()
  );

  // El system-admin se guía por el flag "subareas" del área elegida. El resto no tiene
  // la lista de áreas cargada, así que se valida por la existencia de subáreas propias.
  const hasSubareas = isSystem ? !!selectedArea?.subareas : availableSubareas.length > 0;

  // Al cambiar de área, la subárea elegida deja de ser válida.
  useEffect(() => { setSelectedSubareaId(''); }, [selectedAreaId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (validTypes.includes(file.type)) {
      setSelectedFile(file);
      setUploadError('');
    } else {
      setUploadError('Formato no válido. Solo se aceptan archivos Excel (.xlsx, .xls)');
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!campaignName.trim()) {
      setUploadError('Por favor ingresa un nombre para la campaña');
      return;
    }
    if (!selectedProjectId) {
      setUploadError('Por favor selecciona un proyecto asociado');
      return;
    }
    if (!selectedFile) {
      setUploadError('Por favor selecciona un archivo Excel con los contactos');
      return;
    }

    setUploadLoading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const formData = new FormData();
      formData.append('file',          selectedFile);
      formData.append('campaign_name', campaignName.trim());
      if (campaignTitle.trim())       formData.append('title',       campaignTitle.trim());
      if (campaignDescription.trim()) formData.append('description', campaignDescription.trim());
      if (selectedProjectId)          formData.append('project_id',  selectedProjectId);

      // Área: el admin la elige; el resto la hereda de su usuario.
      if (!selectedAreaId) {
        setUploadError('Por favor selecciona un área.');
        setUploadLoading(false);
        return;
      }
      formData.append('area_id', selectedAreaId);

      // Si el área maneja subáreas, hay que precisar cuál.
      if (hasSubareas) {
        if (!selectedSubareaId) {
          setUploadError('Por favor selecciona una subárea.');
          setUploadLoading(false);
          return;
        }
        formData.append('subarea_id', selectedSubareaId);
      }

      const response = await apiFetch('/api/v1/campaigns/upload', {
        method: 'POST',
        token: authToken,
        onUnauthorized: logout,
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadSuccess(`¡Campaña creada exitosamente! Se cargaron ${data.contacts_loaded} contactos.`);
        if (data.errors && data.errors.length > 0) {
          setUploadError(`Advertencias: ${data.errors.join(', ')}`);
        }
        setTimeout(() => onSuccess(), 2000);
      } else {
        setUploadError(data.detail || 'Error al crear la campaña. Por favor intenta nuevamente.');
      }
    } catch (error) {
      if (error.message !== 'Unauthorized') {
        setUploadError('Error de conexión. Verifica que la API esté corriendo.');
      }
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      {/* Bloquea la vista mientras se sube: el parseo del Excel y la carga de
          contactos puede tardar, y el spinner del botón queda fuera de vista. */}
      {uploadLoading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#053E68]/30 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="mx-4 flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-7 shadow-xl">
            <RefreshCw className="w-10 h-10 text-[#053E68] animate-spin" />
            <p className="text-base font-semibold text-[#053E68]">Creando campaña…</p>
            <p className="max-w-xs text-center text-sm text-gray-500">
              Cargando los contactos del archivo. Puede tardar unos segundos.
            </p>
          </div>
        </div>
      )}

      <button
        onClick={onCancel}
        disabled={uploadLoading}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#053E68] transition disabled:opacity-50"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a Campañas
      </button>

      <div className="bg-white rounded-2xl shadow-sm p-6 lg:p-8 border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-10 h-10 bg-[#053E68]/5 rounded-xl flex-shrink-0">
            <Target className="w-5 h-5 text-[#053E68]" />
          </div>
          <h2 className="text-xl font-bold text-[#053E68]">Crear Nueva Campaña</h2>
        </div>

        {uploadSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-800 font-medium text-sm">{uploadSuccess}</p>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800 text-sm">{uploadError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Nombre */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de la Campaña *</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              disabled={uploadLoading}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] transition text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Ej: Campaña Navideña 2024"
            />
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Título</label>
            <input
              type="text"
              value={campaignTitle}
              onChange={(e) => setCampaignTitle(e.target.value)}
              disabled={uploadLoading}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] transition text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Ej: Recordatorio de pago Q3"
            />
          </div>

          {/* Proyecto asociado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Proyecto Asociado *</label>
            <div className="relative">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={uploadLoading || projectsLoading}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] transition text-base appearance-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {projectsLoading ? 'Cargando proyectos...' : '-- Selecciona un proyecto --'}
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Área: sólo el usuario "system" la elige. El resto hereda su propia área. */}
          {isSystem && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Área *</label>
              <div className="relative">
                <select
                  value={selectedAreaId}
                  onChange={(e) => setSelectedAreaId(e.target.value)}
                  disabled={uploadLoading}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] transition text-base appearance-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">-- Selecciona un área --</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>{area.area}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Subárea: sólo si el área vigente maneja subáreas. */}
          {hasSubareas && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subárea *</label>
              <div className="relative">
                <select
                  value={selectedSubareaId}
                  onChange={(e) => setSelectedSubareaId(e.target.value)}
                  disabled={uploadLoading || subareasLoading}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] transition text-base appearance-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {subareasLoading ? 'Cargando subáreas...' : '-- Selecciona una subárea --'}
                  </option>
                  {availableSubareas.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
              {!subareasLoading && availableSubareas.length === 0 && (
                <p className="text-xs text-gray-400 mt-1.5">Esta área no tiene subáreas disponibles.</p>
              )}
            </div>
          )}

          {/* Descripción */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea
              value={campaignDescription}
              onChange={(e) => setCampaignDescription(e.target.value)}
              disabled={uploadLoading}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] transition text-base disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
              placeholder="Describe el objetivo de esta campaña..."
            />
          </div>

          {/* Upload Excel */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Cargar Lista de Contactos (Excel) *</label>
            <div className={`border-2 border-dashed rounded-xl p-6 sm:p-12 text-center transition ${
              selectedFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-[#053E68] hover:bg-[#053E68]/5'
            } ${uploadLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="file"
                className="hidden"
                id="file-upload"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={uploadLoading}
              />
              <label htmlFor="file-upload" className={uploadLoading ? 'cursor-not-allowed' : 'cursor-pointer'}>
                {selectedFile ? (
                  <>
                    <FileText className="w-10 h-10 sm:w-16 sm:h-16 text-green-600 mx-auto mb-4" />
                    <p className="text-base text-green-700 font-medium mb-2">Archivo: {selectedFile.name}</p>
                    <p className="text-sm text-gray-500">Tamaño: {(selectedFile.size / 1024).toFixed(2)} KB</p>
                    {!uploadLoading && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedFile(null);
                          document.getElementById('file-upload').value = '';
                        }}
                        className="mt-3 text-sm text-red-600 hover:text-red-800"
                      >
                        Eliminar archivo
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <FileText className="w-10 h-10 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-base text-gray-600 mb-2">Haz clic para cargar o arrastra el archivo aquí</p>
                    <p className="text-sm text-gray-500">Formato soportado: Excel (.xlsx, .xls)</p>
                  </>
                )}
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button
            onClick={handleUpload}
            // uploadSuccess también bloquea: tras crearla se navega recién a los 2s,
            // y sin esto el botón se re-habilita y permite crearla dos veces.
            disabled={uploadLoading || !!uploadSuccess || !campaignName || !selectedProjectId || !selectedFile || (hasSubareas && !selectedSubareaId)}
            className="flex-1 px-6 py-3 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploadLoading ? (
              <><RefreshCw className="w-5 h-5 animate-spin" /> Cargando campaña...</>
            ) : uploadSuccess ? 'Campaña creada' : 'Crear Campaña'}
          </button>
          <button
            onClick={onCancel}
            disabled={uploadLoading}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

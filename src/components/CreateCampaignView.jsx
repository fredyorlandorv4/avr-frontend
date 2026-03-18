import { useState, useEffect } from 'react';
import { X, FileText, RefreshCw, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';

export default function CreateCampaignView({ onCancel, onSuccess }) {
  const { authToken, logout } = useAuth();
  const [campaignName, setCampaignName] = useState('');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

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
    <div className="w-full space-y-6">
      <div className="mb-6">
        <button
          onClick={onCancel}
          disabled={uploadLoading}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition"
        >
          <X className="w-4 h-4" />
          Volver a Campañas
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 lg:p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Crear Nueva Campaña</h2>

        {uploadSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-green-800 font-medium">{uploadSuccess}</p>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base appearance-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
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

          {/* Descripción */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea
              value={campaignDescription}
              onChange={(e) => setCampaignDescription(e.target.value)}
              disabled={uploadLoading}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
              placeholder="Describe el objetivo de esta campaña..."
            />
          </div>

          {/* Upload Excel */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Cargar Lista de Contactos (Excel) *</label>
            <div className={`border-2 border-dashed rounded-lg p-6 sm:p-12 text-center transition ${
              selectedFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-500'
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
            disabled={uploadLoading || !campaignName || !selectedProjectId || !selectedFile}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploadLoading ? (
              <><RefreshCw className="w-5 h-5 animate-spin" /> Cargando campaña...</>
            ) : 'Crear Campaña'}
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

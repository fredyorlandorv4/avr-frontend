import { Target, RefreshCw, Play, Briefcase } from 'lucide-react';
import AreaFilter from './AreaFilter.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function CampaignListView({ campaigns, loading, onRefresh, onCreateNew, onViewContacts, onStartCampaign }) {
  const { areaName } = useAuth();
  // Los usuarios del área de marketing no pueden crear campañas.
  const canCreateCampaigns = (areaName || '').toLowerCase() !== 'telemarketing';

  const getStatusLabel = (status) => {
    const map = { active: 'Activa', paused: 'Pausada', completed: 'Finalizada', created: 'Creada' };
    return map[status] || status;
  };

  const getStatusColor = (status) => {
    if (status === 'active')    return 'bg-green-100 text-green-800';
    if (status === 'paused')    return 'bg-yellow-100 text-yellow-800';
    if (status === 'completed') return 'bg-gray-100 text-gray-800';
    if (status === 'created')   return 'bg-[#053E68]/10 text-[#053E68]';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-7 bg-[#F4CD04] rounded-full" />
          <div>
            <h2 className="text-xl font-bold text-[#053E68] leading-tight">Mis Campañas</h2>
            <p className="text-sm text-gray-400 mt-0.5">{campaigns.length} campaña{campaigns.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AreaFilter />
          <button
            onClick={onRefresh}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          {canCreateCampaigns && (
            <button
              onClick={onCreateNew}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition text-sm font-medium"
            >
              <Target className="w-4 h-4" />
              Nueva Campaña
            </button>
          )}
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4 bg-[#053E68]/5 rounded-full mb-4">
            <Target className="w-10 h-10 text-[#053E68]" />
          </div>
          <p className="text-gray-600 font-medium mb-1">No hay campañas disponibles</p>
          <p className="text-sm text-gray-400">Crea tu primera campaña para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-lg font-semibold text-[#053E68] leading-tight">{campaign.name}</h3>
                    <p className={`text-sm font-medium mt-0.5 ${campaign.title ? 'text-gray-600' : 'text-gray-300 italic'}`}>
                      {campaign.title || 'Sin título'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Creada: {campaign.created}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                      {getStatusLabel(campaign.status)}
                    </span>
                    {campaign.areaName && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#F4CD04]/20 text-[#7a6800] capitalize">
                        {campaign.areaName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Briefcase className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                    <span className={campaign.projectName ? 'font-medium text-gray-600' : 'text-gray-300 italic'}>
                      {campaign.projectName || 'Sin proyecto asociado'}
                    </span>
                  </div>
                  <p className={`text-xs line-clamp-2 leading-relaxed ${campaign.description ? 'text-gray-500' : 'text-gray-300 italic'}`}>
                    {campaign.description || 'Sin descripción'}
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Contactos</span>
                    <span className="text-sm font-semibold text-gray-800">{campaign.contacts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Completadas</span>
                    <span className="text-sm font-semibold text-green-600">{campaign.completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Pendientes</span>
                    <span className="text-sm font-semibold text-yellow-600">{campaign.pending}</span>
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div
                    className="bg-[#053E68] h-2 rounded-full transition-all"
                    style={{ width: `${campaign.contacts > 0 ? (campaign.completed / campaign.contacts) * 100 : 0}%` }}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onViewContacts(campaign)}
                    className="flex-1 px-3 py-2 text-sm font-medium bg-[#053E68]/5 text-[#053E68] rounded-lg hover:bg-[#053E68]/10 transition"
                  >
                    Ver Contactos
                  </button>
                  {campaign.status !== 'active' && (
                    <button
                      onClick={() => onStartCampaign(campaign.id, campaign.name)}
                      disabled={loading || campaign.areaName?.toLowerCase() !== 'cobros'}
                      title={campaign.areaName?.toLowerCase() !== 'cobros' ? 'Solo las campañas de cobros pueden iniciarse desde aquí' : undefined}
                      className="flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="w-4 h-4" />
                      Iniciar
                    </button>
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

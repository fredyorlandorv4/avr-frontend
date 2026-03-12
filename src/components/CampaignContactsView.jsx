import { X, RefreshCw, Users } from 'lucide-react';

export default function CampaignContactsView({ campaign, contacts, calls, loading, onBack, onRefresh, onViewCallAnalysis }) {
  if (!campaign) return null;

  return (
    <div className="w-full mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition mb-2"
          >
            <X className="w-4 h-4" />
            Volver a Campañas
          </button>
          <h2 className="text-2xl font-bold text-gray-800">{campaign.name}</h2>
          <p className="text-sm text-gray-500">Contactos de la campaña</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <p className="text-sm text-gray-600 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-800">{campaign.contacts}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <p className="text-sm text-gray-600 mb-1">Completadas</p>
          <p className="text-2xl font-bold text-green-600">{campaign.completed}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <p className="text-sm text-gray-600 mb-1">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-600">{campaign.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <p className="text-sm text-gray-600 mb-1">Progreso</p>
          <p className="text-2xl font-bold text-blue-600">
            {campaign.contacts > 0 ? Math.round((campaign.completed / campaign.contacts) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-12 h-12 text-gray-400 animate-spin mb-4" />
              <p className="text-gray-500">Cargando contactos...</p>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-500">No hay contactos en esta campaña</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {contacts.map((contact) => (
                  <div key={contact.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{contact.cliente}</p>
                        <p className="text-xs text-gray-500 truncate">{contact.telefono}</p>
                        <p className="text-xs text-gray-400 truncate">Lote: {contact.lote || '-'}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        contact.called === 1 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {contact.called === 1 ? 'Llamado' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-sm font-medium text-gray-800">
                          Q{contact.total ? contact.total.toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Llamada</p>
                        <p className="text-sm font-medium text-gray-800">{contact.call_id ? `#${contact.call_id}` : '-'}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      {contact.call_id ? (
                        <button
                          onClick={() => {
                            const call = calls.find(c => c.id === contact.call_id);
                            if (call) onViewCallAnalysis(call);
                          }}
                          className="w-full px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium"
                        >
                          Ver llamada
                        </button>
                      ) : (
                        <div className="w-full px-3 py-2 text-sm bg-gray-50 text-gray-400 rounded-lg text-center">
                          Sin llamada
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Lote</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Cliente</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Teléfono</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Total</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Llamada</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr key={contact.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="py-3 px-4 text-sm font-medium text-gray-800">{contact.lote || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-800">{contact.cliente}</td>
                        <td className="py-3 px-4 text-sm text-gray-800">{contact.telefono}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            contact.called === 1 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {contact.called === 1 ? 'Llamado' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800">
                          Q{contact.total ? contact.total.toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800">
                          {contact.call_id ? `#${contact.call_id}` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {contact.call_id ? (
                            <button
                              onClick={() => {
                                const call = calls.find(c => c.id === contact.call_id);
                                if (call) onViewCallAnalysis(call);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Ver llamada
                            </button>
                          ) : (
                            <span className="text-gray-400 text-sm">Sin llamada</span>
                          )}
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

import { ArrowLeft, RefreshCw, Users } from 'lucide-react';

export default function CampaignContactsView({ campaign, contacts, calls, loading, onBack, onRefresh, onViewCallAnalysis }) {
  if (!campaign) return null;

  const isTelemarketing = (campaign.areaName || '').toLowerCase() === 'telemarketing';

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#053E68] transition mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Campañas
          </button>
          <div className="flex items-center gap-2">
            <span className="w-1 h-7 bg-[#F4CD04] rounded-full" />
            <div>
              <h2 className="text-xl font-bold text-[#053E68] leading-tight">{campaign.name}</h2>
              <p className="text-sm text-gray-400 mt-0.5">Contactos de la campaña</p>
            </div>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total</p>
          <p className="text-2xl font-bold text-[#053E68] tabular-nums">{campaign.contacts}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Completadas</p>
          <p className="text-2xl font-bold text-green-600 tabular-nums">{campaign.completed}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-600 tabular-nums">{campaign.pending}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Progreso</p>
          <p className="text-2xl font-bold text-[#053E68] tabular-nums">
            {campaign.contacts > 0 ? Math.round((campaign.completed / campaign.contacts) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-12 h-12 text-gray-400 animate-spin mb-4" />
              <p className="text-gray-500">Cargando contactos...</p>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 bg-[#053E68]/5 rounded-full mb-4">
                <Users className="w-10 h-10 text-[#053E68]" />
              </div>
              <p className="text-gray-500">No hay contactos en esta campaña</p>
            </div>
          ) : isTelemarketing ? (
            <>
              {/* Telemarketing — Mobile cards */}
              <div className="sm:hidden space-y-3">
                {contacts.map((contact, idx) => (
                  <div key={contact.firebase_id ?? idx} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{contact.client}</p>
                        <p className="text-xs text-gray-500 truncate">{contact.phone}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        contact.called === 1 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {contact.called === 1 ? 'Llamado' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="mt-3">
                      <p className="text-xs text-gray-500">ID Propiedad</p>
                      <p className="text-sm font-medium text-gray-800">{contact.property_id ?? '-'}</p>
                    </div>
                    <p className="mt-3 text-xs text-gray-400 truncate">Firebase: {contact.firebase_id || '-'}</p>
                  </div>
                ))}
              </div>

              {/* Telemarketing — Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {['Cliente', 'Teléfono', 'ID Propiedad', 'Firebase ID', 'Estado'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact, idx) => (
                      <tr key={contact.firebase_id ?? idx} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="py-3 px-4 text-sm text-gray-800">{contact.client}</td>
                        <td className="py-3 px-4 text-sm text-gray-800">{contact.phone}</td>
                        <td className="py-3 px-4 text-sm text-gray-800">{contact.property_id ?? '-'}</td>
                        <td className="py-3 px-4 text-xs text-gray-500 font-mono">{contact.firebase_id || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            contact.called === 1 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {contact.called === 1 ? 'Llamado' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
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
                          className="w-full px-3 py-2 text-sm bg-[#053E68]/5 text-[#053E68] rounded-lg hover:bg-[#053E68]/10 transition font-medium"
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
                      {['Lote', 'Cliente', 'Teléfono', 'Estado', 'Total', 'Llamada', 'Acciones'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
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
                              className="text-[#053E68] hover:underline text-sm font-medium"
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

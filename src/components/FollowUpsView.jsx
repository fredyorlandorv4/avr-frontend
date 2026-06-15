import { Clock, RefreshCw } from 'lucide-react';

function FollowUpCard({ followUp, bgColor, onToggleComplete }) {
  const notesParts = followUp.notes.split('|');
  const title = notesParts[0]?.trim() || '';
  const description = notesParts[1]?.trim() || notesParts[0]?.trim() || '';
  const scheduledDate = new Date(followUp.scheduled_date);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition p-4">
      <div className="flex items-start gap-3 mb-3">
        <input
          type="checkbox"
          checked={followUp.completed}
          onChange={() => onToggleComplete(followUp.id)}
          className="mt-1 w-5 h-5 rounded border-gray-300 cursor-pointer accent-[#053E68]"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
              ID: #{followUp.id}
            </span>
            {followUp.call_id && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#053E68]/10 text-[#053E68]">
                Llamada #{followUp.call_id}
              </span>
            )}
          </div>

          {notesParts.length > 1 ? (
            <>
              <h4 className={`font-semibold text-base mb-2 ${followUp.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {title}
              </h4>
              <p className={`text-sm mb-3 ${followUp.completed ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                {description}
              </p>
            </>
          ) : (
            <p className={`text-sm mb-3 ${followUp.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
              {followUp.notes}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {followUp.completed ? (
                <span>Completado: {new Date(followUp.completed_at).toLocaleDateString('es-GT')}</span>
              ) : (
                <span>Programado: {scheduledDate.toLocaleDateString('es-GT')}</span>
              )}
            </div>
            <span className="text-xs text-gray-400">
              Creado: {new Date(followUp.created_at).toLocaleDateString('es-GT')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FollowUpsView({ followUps, followUpStats, onToggleComplete, onRefresh }) {
  const greenFollowUps     = followUps.filter(fu => fu.status === 'green'  && !fu.completed);
  const orangeFollowUps    = followUps.filter(fu => fu.status === 'orange' && !fu.completed);
  const redFollowUps       = followUps.filter(fu => fu.status === 'red'    && !fu.completed);
  const completedFollowUps = followUps.filter(fu => fu.completed);

  const columns = [
    {
      key: 'green',
      label: 'PENDIENTES',
      subLabel: 'En tiempo',
      items: greenFollowUps,
      dotColor: 'bg-green-500',
      bgColor: 'bg-green-100 text-green-800',
      emptyMsg: 'No hay follow-ups pendientes',
    },
    {
      key: 'orange',
      label: 'PRONTO A VENCER',
      subLabel: 'Requieren atención',
      items: orangeFollowUps,
      dotColor: 'bg-orange-500',
      bgColor: 'bg-orange-100 text-orange-800',
      emptyMsg: 'No hay follow-ups próximos a vencer',
    },
    {
      key: 'red',
      label: 'VENCIDOS',
      subLabel: 'Urgentes',
      items: redFollowUps,
      dotColor: 'bg-red-500',
      bgColor: 'bg-red-100 text-red-800',
      emptyMsg: 'No hay follow-ups vencidos',
    },
    {
      key: 'completed',
      label: 'COMPLETADOS',
      subLabel: 'Finalizados',
      items: completedFollowUps,
      dotColor: 'bg-[#053E68]',
      bgColor: 'bg-[#053E68]/10 text-[#053E68]',
      emptyMsg: 'No hay follow-ups completados',
    },
  ];

  const statsCards = [
    { label: 'Pendientes',      value: followUpStats.green,     subLabel: 'En tiempo',          borderColor: 'border-green-500',  textColor: 'text-green-600',  dotColor: 'bg-green-500',   background: "bg-green-50"  },
    { label: 'Pronto a Vencer', value: followUpStats.orange,    subLabel: 'Requieren atención', borderColor: 'border-orange-500', textColor: 'text-orange-600', dotColor: 'bg-orange-500',  background: "bg-orange-50"  },
    { label: 'Vencidos',        value: followUpStats.red,       subLabel: 'Urgente',            borderColor: 'border-red-500',    textColor: 'text-red-600',    dotColor: 'bg-red-500',     background: "bg-red-50"  },
    { label: 'Completados',     value: followUpStats.completed, subLabel: 'Finalizados',        borderColor: 'border-[#053E68]',  textColor: 'text-[#053E68]',  dotColor: 'bg-[#053E68]',   background: "bg-[#053E6810]"  },
  ];

  return (
    <div className="w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-9 bg-[#F4CD04] rounded-full" />
          <div>
            <h2 className="text-xl font-bold text-[#053E68] leading-tight">Seguimiento de Follow Ups</h2>
            <p className="text-sm text-gray-400 mt-0.5">Sistema de gestión por estado</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => (
          <div key={card.label} className={`${card.background} rounded-2xl shadow-sm p-6 border ${card.textColor} ${card.borderColor}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">{card.label}</h3>
              <div className={`w-3 h-3 rounded-full ${card.dotColor}`} />
            </div>
            <p className={`text-3xl font-bold ${card.textColor}`}>{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.subLabel}</p>
          </div>
        ))}
      </div>

      {/* Desktop — 4 columns */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-6">
        {columns.map((col) => (
          <div key={col.key} className="space-y-3">
            <div className="flex items-center gap-2 px-1 pb-2.5 border-b border-gray-200">
              <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
              <h3 className="font-bold text-sm text-gray-700 tracking-wide">{col.label}</h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.bgColor}`}>{col.items.length}</span>
            </div>
            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-2">
              {col.items.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">{col.emptyMsg}</p>
                </div>
              ) : (
                col.items.map(fu => (
                  <FollowUpCard
                    key={fu.id}
                    followUp={fu}
                    bgColor={col.bgColor}
                    onToggleComplete={onToggleComplete}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile — stacked */}
      <div className="lg:hidden space-y-6">
        {columns.map((col) => (
          <div key={col.key} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
              <h3 className="font-bold text-sm text-gray-700 tracking-wide">{col.label}</h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.bgColor}`}>{col.items.length}</span>
            </div>
            {col.items.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">{col.emptyMsg}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {col.items.map(fu => (
                  <FollowUpCard
                    key={fu.id}
                    followUp={fu}
                    bgColor={col.bgColor}
                    onToggleComplete={onToggleComplete}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

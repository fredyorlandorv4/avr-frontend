import { Clock, RefreshCw } from 'lucide-react';

function FollowUpCard({ followUp, borderColor, bgColor, onToggleComplete }) {
  const notesParts = followUp.notes.split('|');
  const title = notesParts[0]?.trim() || '';
  const description = notesParts[1]?.trim() || notesParts[0]?.trim() || '';
  const scheduledDate = new Date(followUp.scheduled_date);

  return (
    <div className={`bg-white rounded-lg border-l-4 ${borderColor} shadow-sm hover:shadow-md transition p-4`}>
      <div className="flex items-start gap-3 mb-3">
        <input
          type="checkbox"
          checked={followUp.completed}
          onChange={() => onToggleComplete(followUp.id)}
          className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
              ID: #{followUp.id}
            </span>
            {followUp.call_id && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
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

function EmptyColumn({ message }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <Clock className="w-6 h-6 text-gray-400" />
      </div>
      <p className="text-gray-500 text-sm">{message}</p>
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
      headerBg: 'bg-green-50 border-green-200',
      dotColor: 'bg-green-500',
      textColor: 'text-green-800',
      subtextColor: 'text-green-700',
      borderColor: 'border-green-500',
      bgColor: 'bg-green-100 text-green-800',
      emptyMsg: 'No hay follow-ups pendientes',
    },
    {
      key: 'orange',
      label: 'PRONTO A VENCER',
      subLabel: 'Requieren atención',
      items: orangeFollowUps,
      headerBg: 'bg-orange-50 border-orange-200',
      dotColor: 'bg-orange-500',
      textColor: 'text-orange-800',
      subtextColor: 'text-orange-700',
      borderColor: 'border-orange-500',
      bgColor: 'bg-orange-100 text-orange-800',
      emptyMsg: 'No hay follow-ups próximos a vencer',
    },
    {
      key: 'red',
      label: 'VENCIDOS',
      subLabel: 'Urgentes',
      items: redFollowUps,
      headerBg: 'bg-red-50 border-red-200',
      dotColor: 'bg-red-500',
      textColor: 'text-red-800',
      subtextColor: 'text-red-700',
      borderColor: 'border-red-500',
      bgColor: 'bg-red-100 text-red-800',
      emptyMsg: 'No hay follow-ups vencidos',
    },
    {
      key: 'completed',
      label: 'COMPLETADOS',
      subLabel: 'Finalizados',
      items: completedFollowUps,
      headerBg: 'bg-blue-50 border-blue-200',
      dotColor: 'bg-blue-500',
      textColor: 'text-blue-800',
      subtextColor: 'text-blue-700',
      borderColor: 'border-blue-500',
      bgColor: 'bg-blue-100 text-blue-800',
      emptyMsg: 'No hay follow-ups completados',
    },
  ];

  const statsCards = [
    { label: 'Pendientes',      value: followUpStats.green,     subLabel: 'En tiempo',          borderColor: 'border-green-500',  textColor: 'text-green-600',  dotColor: 'bg-green-500'  },
    { label: 'Pronto a Vencer', value: followUpStats.orange,    subLabel: 'Requieren atención', borderColor: 'border-orange-500', textColor: 'text-orange-600', dotColor: 'bg-orange-500' },
    { label: 'Vencidos',        value: followUpStats.red,       subLabel: 'Urgente',            borderColor: 'border-red-500',    textColor: 'text-red-600',    dotColor: 'bg-red-500'    },
    { label: 'Completados',     value: followUpStats.completed, subLabel: 'Finalizados',        borderColor: 'border-blue-500',   textColor: 'text-blue-600',   dotColor: 'bg-blue-500'   },
  ];

  return (
    <div className="w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Seguimiento de Follow Ups</h2>
          <p className="text-sm text-gray-500 mt-1">Sistema de gestión por estado</p>
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
        {statsCards.map((card) => (
          <div key={card.label} className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${card.borderColor}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">{card.label}</h3>
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
          <div key={col.key} className="space-y-4">
            <div className={`rounded-lg p-4 border ${col.headerBg}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${col.dotColor}`} />
                <h3 className={`font-bold ${col.textColor}`}>{col.label}</h3>
              </div>
              <p className={`text-sm ${col.subtextColor}`}>{col.items.length} {col.subLabel.toLowerCase()}</p>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {col.items.length === 0 ? (
                <EmptyColumn message={col.emptyMsg} />
              ) : (
                col.items.map(fu => (
                  <FollowUpCard
                    key={fu.id}
                    followUp={fu}
                    borderColor={col.borderColor}
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
            <div className={`rounded-lg p-4 border ${col.headerBg}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${col.dotColor}`} />
                <h3 className={`font-bold ${col.textColor}`}>{col.label} ({col.items.length})</h3>
              </div>
              <p className={`text-sm ${col.subtextColor}`}>{col.subLabel}</p>
            </div>
            {col.items.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">{col.emptyMsg}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {col.items.map(fu => (
                  <FollowUpCard
                    key={fu.id}
                    followUp={fu}
                    borderColor={col.borderColor}
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

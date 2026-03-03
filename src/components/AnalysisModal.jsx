import { X, RefreshCw } from 'lucide-react';

export default function AnalysisModal({ show, call, onClose }) {
  if (!show || !call) return null;

  const analysis = call.analysis;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Análisis de Llamada</h3>
            <p className="text-sm text-gray-500 mt-1">ID: {call.call_id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {analysis ? (
            <div className="space-y-6">
              {analysis.title && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">Título</h4>
                  <p className="text-gray-700">{analysis.title}</p>
                </div>
              )}

              {analysis.summary && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">Resumen</h4>
                  <p className="text-gray-700">{analysis.summary}</p>
                </div>
              )}

              {analysis.sentiment && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">Sentimiento</h4>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    analysis.sentiment.includes('positivo') ? 'bg-green-100 text-green-800' :
                    analysis.sentiment.includes('negativo') ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {analysis.sentiment}
                  </span>
                </div>
              )}

              {analysis.main_points && analysis.main_points.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">Puntos Principales</h4>
                  <ul className="list-disc list-inside space-y-2">
                    {analysis.main_points.map((point, index) => (
                      <li key={index} className="text-gray-700">{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.action_items && analysis.action_items.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">Acciones a Realizar</h4>
                  <ul className="list-disc list-inside space-y-2">
                    {analysis.action_items.map((item, index) => (
                      <li key={index} className="text-gray-700">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.follow_up && analysis.follow_up.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">Seguimiento</h4>
                  <ul className="list-disc list-inside space-y-2">
                    {analysis.follow_up.map((item, index) => (
                      <li key={index} className="text-gray-700">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.supervisor_coaching && (
                <div className="border-t pt-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Coaching del Supervisor</h4>

                  {analysis.supervisor_coaching.quality_score && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-700">Puntuación de Calidad</span>
                        <span className="text-2xl font-bold text-blue-600">
                          {analysis.supervisor_coaching.quality_score.score}/100
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{analysis.supervisor_coaching.quality_score.rationale}</p>
                    </div>
                  )}

                  {analysis.supervisor_coaching.strengths && analysis.supervisor_coaching.strengths.length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-medium text-green-700 mb-2">Fortalezas</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.supervisor_coaching.strengths.map((item, index) => (
                          <li key={index} className="text-gray-700 text-sm">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.supervisor_coaching.areas_for_improvement && analysis.supervisor_coaching.areas_for_improvement.length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-medium text-orange-700 mb-2">Áreas de Mejora</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.supervisor_coaching.areas_for_improvement.map((item, index) => (
                          <li key={index} className="text-gray-700 text-sm">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-500">No hay análisis disponible para esta llamada</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

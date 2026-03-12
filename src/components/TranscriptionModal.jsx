import { X, RefreshCw } from 'lucide-react';

export default function TranscriptionModal({ show, call, onClose }) {
  if (!show || !call) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Transcripción de Llamada</h3>
            <p className="text-sm text-gray-500 mt-1">ID: {call.call_id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {call.transcription ? (
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{call.transcription}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-500">No hay transcripción disponible para esta llamada</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { X, RefreshCw } from 'lucide-react';

function getTranscriptionText(transcription) {
  if (transcription == null) return '';
  if (typeof transcription === 'string') return transcription;
  if (typeof transcription === 'number' || typeof transcription === 'boolean') return String(transcription);
  if (Array.isArray(transcription)) {
    return transcription
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return item.text ?? item.content ?? JSON.stringify(item);
        }
        return String(item ?? '');
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof transcription === 'object') {
    return transcription.text ?? transcription.content ?? JSON.stringify(transcription, null, 2);
  }
  return '';
}

export default function TranscriptionModal({ show, call, onClose }) {
  if (!show || !call) return null;

  const transcriptionText = getTranscriptionText(call.transcription);

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
          {transcriptionText ? (
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{transcriptionText}</p>
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

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

function splitTranscriptionEntries(transcription) {
  const entryPattern = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:\n]+):\s*/g;
  const matches = [...transcription.matchAll(entryPattern)];

  if (!matches.length) return [{ text: transcription }];

  return matches.map((match, index) => ({
    time: match[1],
    speaker: match[2].trim(),
    text: transcription
      .slice(match.index + match[0].length, matches[index + 1]?.index)
      .trim(),
  }));
}

export default function TranscriptionModal({ show, call, onClose }) {
  if (!show || !call) return null;

  const transcriptionText = getTranscriptionText(call.transcription);
  const transcriptionEntries = splitTranscriptionEntries(transcriptionText);

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
            <div className="space-y-3">
              {transcriptionEntries.map((entry, index) => (
                <div
                  key={`${entry.time || 'entry'}-${index}`}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-gray-700 leading-relaxed"
                >
                  {entry.speaker ? (
                    <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xs tabular-nums text-gray-400">[{entry.time}]</span>
                      <strong className="text-[#053E68]">{entry.speaker}:</strong>
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{entry.text}</p>
                </div>
              ))}
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

import { X } from 'lucide-react';

export default function Toast({ show, message, type, onDismiss }) {
  if (!show) return null;

  const colors = {
    success: { bg: 'bg-green-50 border-green-200', text: 'text-green-800', icon: 'text-green-600' },
    error:   { bg: 'bg-red-50 border-red-200',     text: 'text-red-800',   icon: 'text-red-600'   },
    info:    { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-800',  icon: 'text-blue-600'  },
  };
  const c = colors[type] || colors.info;

  return (
    <div
      className="fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out transform"
      style={{ animation: 'slideInRight 0.3s ease-out' }}
    >
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
      <div className={`rounded-lg shadow-lg p-4 max-w-md border ${c.bg}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {type === 'success' ? (
              <svg className={`w-5 h-5 ${c.icon}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : type === 'error' ? (
              <svg className={`w-5 h-5 ${c.icon}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className={`w-5 h-5 ${c.icon}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${c.text}`}>{message}</p>
          </div>
          <button onClick={onDismiss} className="flex-shrink-0 ml-2">
            <X className={`w-4 h-4 ${c.icon}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

import { Code2 } from 'lucide-react';

// Paleta lateral de variables clicables agrupadas por categoría

const groupBy = (arr, key) =>
  arr.reduce((acc, item) => {
    (acc[item[key]] = acc[item[key]] || []).push(item);
    return acc;
  }, {});

export default function VariablePalette({ variables, onInsert }) {
  const grupos = groupBy(variables, 'grupo');

  return (
    <div className="w-full lg:w-64 lg:flex-shrink-0 lg:overflow-y-auto bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1 h-4 bg-[#F4CD04] rounded-full" />
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Variables</h4>
      </div>
      <p className="text-[11px] text-gray-400 mb-4">
        Clic en una variable para insertarla donde esté el cursor.
      </p>

      {Object.entries(grupos).map(([grupo, vars]) => (
        <div key={grupo} className="mb-4">
          <div className="text-[10px] font-bold text-[#053E68] uppercase tracking-widest mb-2">
            {grupo}
          </div>

          <div className="space-y-1.5">
            {vars.map(v => (
              <button
                key={v.key}
                onClick={() => onInsert(v.key)}
                title={`Insertar ${v.key}`}
                className="group block w-full text-left px-2.5 py-2 bg-gray-50 border border-gray-100 rounded-lg hover:bg-[#053E68]/5 hover:border-[#053E68]/20 transition"
              >
                <span className="flex items-center gap-1.5">
                  <Code2 className="w-3 h-3 text-[#053E68]/50 flex-shrink-0" />
                  <code className="text-[11px] font-mono text-[#053E68] font-medium">{v.key}</code>
                </span>
                <span className="block text-[11px] text-gray-400 mt-0.5 pl-[18px]">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

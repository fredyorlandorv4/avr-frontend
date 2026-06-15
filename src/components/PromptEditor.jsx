import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, RefreshCw, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';
import VariablePalette from './VariablePalette.jsx';

// Datos de ejemplo para el preview
const SAMPLE_DATA = {
  '{{cliente}}':          'Juan García',
  '{{proyecto}}':         'Vista Hermosa',
  '{{saludo}}':           'buenos días',
  '{{total_general}}':    '1,700.00',
  '{{lotes_info}}':       '- Lote B-14: 2 cuotas, Q850.00/mes, total Q1,700.00',
  '{{num_lotes}}':        '1',
  '{{fecha}}':            'lunes 16 de marzo de 2026',
  '{{hora}}':             '09:30',
  '{{whatsapp_cobros}}':  '+502 4444-5555',
  '{{telefono_oficina}}': '+502 2222-3333',
};

export default function PromptEditor({ promptId, onSaved, onCancel }) {
  const { authToken, logout } = useAuth();
  const [prompt,    setPrompt]    = useState(null);
  const [template,  setTemplate]  = useState('');
  const [name,      setName]      = useState('');
  const [agentType, setAgentType] = useState('');
  const [variables, setVariables] = useState([]);
  const [preview,   setPreview]   = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    const opts = { token: authToken, onUnauthorized: logout };
    Promise.all([
      promptId ? apiFetch(`/api/v1/prompts/${promptId}`, opts) : Promise.resolve(null),
      apiFetch('/api/v1/prompts/meta/variables', opts),
    ]).then(async ([rPrompt, rVars]) => {
      const vars = rVars ? (await rVars.json()).variables ?? [] : [];
      setVariables(vars);
      if (rPrompt) {
        const p = await rPrompt.json();
        setPrompt(p);
        setTemplate(p.template || '');
        renderPreview(p.template || '', vars);
      }
    }).catch(() => setError('Error al cargar los datos.'));
  }, [promptId, authToken]);

  const renderPreview = (text, vars = variables) => {
    let result = text;
    Object.entries(SAMPLE_DATA).forEach(([k, v]) => {
      result = result.replaceAll(k, `【${v}】`);
    });
    result = result.replace(/\{\{[^}]+\}\}/g, m => `⚠️${m}⚠️`);
    setPreview(result);
  };

  const insertVariable = (varKey) => {
    const el    = textareaRef.current;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const next  = template.slice(0, start) + varKey + template.slice(end);
    setTemplate(next);
    renderPreview(next);
    setTimeout(() => {
      el.focus();
      const pos = start + varKey.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleChange = (e) => {
    setTemplate(e.target.value);
    renderPreview(e.target.value);
  };

  const handleSave = async () => {
    if (!template.trim()) { setError('El template no puede estar vacío.'); return; }
    if (!promptId && !name.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!promptId && !agentType.trim()) { setError('El tipo de agente es obligatorio.'); return; }
    setSaving(true);
    setError('');
    try {
      const body = promptId
        ? { template }
        : { name: name.trim(), agent_type: agentType.trim(), template };
      const res = await apiFetch(
        promptId ? `/api/v1/prompts/${promptId}` : '/api/v1/prompts/',
        { method: promptId ? 'PUT' : 'POST', token: authToken, onUnauthorized: logout, body }
      );
      if (!res.ok) throw new Error('Error al guardar');
      const saved = await res.json();
      onSaved?.(saved);
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (!prompt && promptId) return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
      <RefreshCw className="w-8 h-8 animate-spin" />
      <p className="mt-3 text-sm">Cargando prompt…</p>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onCancel}
            className="p-2 text-gray-500 hover:text-[#053E68] hover:bg-gray-100 rounded-lg transition flex-shrink-0"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center justify-center w-10 h-10 bg-[#053E68]/5 rounded-xl flex-shrink-0">
            <FileText className="w-5 h-5 text-[#053E68]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-[#053E68] leading-tight truncate">
              {prompt?.name || 'Nuevo prompt'}
              {prompt && <span className="text-xs font-medium text-gray-400 ml-2">v{prompt.version}</span>}
            </h3>
            <p className="text-xs text-gray-400 truncate">{prompt?.agent_type || 'Configura un nuevo template'}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando…</>
              : <><Check className="w-4 h-4" /> Guardar</>
            }
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 lg:h-[68vh]">

        {/* ── Editor principal ── */}
        <div className="flex-1 flex flex-col gap-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 min-w-0">

          {/* Campos solo visibles al crear un prompt nuevo */}
          {!promptId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Agente cobros Guatemala"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Tipo de agente (agent_type) *
                </label>
                <input
                  type="text"
                  value={agentType}
                  onChange={e => setAgentType(e.target.value)}
                  placeholder="Ej: cobros, ventas, soporte"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] transition"
                />
              </div>
            </div>
          )}

          {/* Textarea */}
          <div className="flex-1 flex flex-col min-h-[240px]">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Template
            </label>
            <textarea
              ref={textareaRef}
              value={template}
              onChange={handleChange}
              placeholder="Escribe el prompt aquí. Usa el panel de variables para insertar {{variables}}."
              className="flex-1 w-full font-mono text-[13px] leading-relaxed p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#053E68] transition resize-none bg-gray-50/50"
            />
          </div>

          {/* Preview colapsable */}
          <details className="group">
            <summary className="cursor-pointer select-none text-sm font-semibold text-[#053E68] flex items-center gap-1.5">
              <span className="transition-transform group-open:rotate-90">▸</span>
              Preview con datos de ejemplo
            </summary>
            <pre className="bg-gray-50 border border-gray-100 rounded-xl p-3 mt-2 text-xs whitespace-pre-wrap max-h-52 overflow-y-auto">
              {preview}
            </pre>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {'【valor】'} = variable reconocida &nbsp;|&nbsp; ⚠️{'{{variable}}'}⚠️ = variable no reconocida
            </p>
          </details>
        </div>

        {/* ── Paleta de variables ── */}
        <VariablePalette variables={variables} onInsert={insertVariable} />
      </div>
    </div>
  );
}

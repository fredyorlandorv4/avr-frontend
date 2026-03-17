import { useState, useEffect, useRef } from 'react';
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
    <p style={{ color: '#888', padding: '2rem', textAlign: 'center' }}>Cargando...</p>
  );

  return (
    <div style={{ display: 'flex', gap: 16, height: '78vh' }}>

      {/* ── Editor principal ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>
              {prompt?.name || 'Nuevo prompt'}
              {prompt && (
                <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>
                  v{prompt.version}
                </span>
              )}
            </h3>
            <span style={{ fontSize: 12, color: '#aaa' }}>{prompt?.agent_type}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onCancel}
              style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', background: '#fff' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '6px 14px', background: saving ? '#888' : '#0055cc',
                color: '#fff', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fff0f0', border: '1px solid #ffaaaa',
            borderRadius: 4, padding: '8px 12px', color: '#cc0000', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Campos solo visibles al crear un prompt nuevo */}
        {!promptId && (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
                Nombre *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Agente cobros Guatemala"
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
                Tipo de agente (agent_type) *
              </label>
              <input
                type="text"
                value={agentType}
                onChange={e => setAgentType(e.target.value)}
                placeholder="Ej: cobros, ventas, soporte"
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={template}
          onChange={handleChange}
          placeholder="Escribe el prompt aquí. Usa el panel de variables para insertar {{variables}}."
          style={{
            flex: 1, fontFamily: 'monospace', fontSize: 13,
            padding: 12, borderRadius: 6, border: '1px solid #ccc',
            resize: 'none', lineHeight: 1.6,
          }}
        />

        {/* Preview colapsable */}
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, userSelect: 'none' }}>
            Preview con datos de ejemplo
          </summary>
          <pre style={{
            background: '#f8f8f8', padding: 12, borderRadius: 6, marginTop: 8,
            fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 200,
            overflowY: 'auto', border: '1px solid #e0e0e0',
          }}>
            {preview}
          </pre>
          <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            {'【valor】'} = variable reconocida &nbsp;|&nbsp; ⚠️{'{{variable}}'}⚠️ = variable no reconocida
          </p>
        </details>
      </div>

      {/* ── Paleta de variables ── */}
      <VariablePalette variables={variables} onInsert={insertVariable} />
    </div>
  );
}

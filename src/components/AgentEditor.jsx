import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Check, ArrowLeft, Plus, Braces } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';

// Sin ancho: cada uso decide el suyo (w-full en los campos normales, w-16 en el número).
const baseInputCls =
  'px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] text-base transition disabled:bg-gray-100 disabled:cursor-not-allowed';
const inputCls = `w-full ${baseInputCls}`;

const EMPTY_AGENT = { nombre: '', agent_id: '', prompt: '', area_id: '', subarea: '', nota: '', status: true };

// El prompt vive en dos formatos:
//   - En el editor, numerado:  "Hola {{1}}, tu saldo es {{2}}"
//   - En la base, con nombres: "Hola {{cliente}}, tu saldo es {{total}}"
// Se traduce al cargar (toEditorPrompt) y al guardar (toStoredPrompt).
const NUM_VAR_RE = /\{\{(\d+)\}\}/g;      // marcadores del editor
const ANY_VAR_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;   // cualquier {{...}} guardado

/**
 * Prompt guardado -> prompt del editor. Cada {{...}} distinto se numera por
 * orden de aparición; las repeticiones del mismo token comparten número.
 * Un token que ya era numérico se considera una variable sin nombre.
 * @returns {{ prompt: string, variables: Array<{numero: number, nombre: string}> }}
 */
function toEditorPrompt(stored) {
  const tokens = [];   // valores únicos, en orden de aparición
  const prompt = (stored || '').replace(ANY_VAR_RE, (_match, inner) => {
    const key = inner.trim();
    let idx = tokens.indexOf(key);
    if (idx === -1) idx = tokens.push(key) - 1;
    return `{{${idx + 1}}}`;
  });

  const variables = tokens.map((key, i) => ({
    numero: i + 1,
    nombre: /^\d+$/.test(key) ? '' : key,
  }));

  return { prompt, variables };
}

/** Resalta los marcadores {{n}} para distinguirlos del texto del prompt. */
function highlightVars(text) {
  return text.split(/(\{\{\d+\}\})/g).map((chunk, i) =>
    /^\{\{\d+\}\}$/.test(chunk)
      ? <mark key={i} className="bg-[#F4CD04]/40 text-[#053E68] font-semibold rounded">{chunk}</mark>
      : <span key={i}>{chunk}</span>
  );
}

/**
 * Prompt del editor -> prompt guardado. Sustituye {{n}} por {{nombre}}.
 * Las variables sin nombre se quedan como {{n}}: no hay con qué reemplazarlas.
 */
function toStoredPrompt(prompt, variables) {
  return variables.reduce((acc, v) => {
    const nombre = v.nombre.trim();
    return nombre ? acc.replaceAll(`{{${v.numero}}}`, `{{${nombre}}}`) : acc;
  }, prompt);
}

/**
 * Pantalla de creación / edición de un agente.
 * @param {number|null} agentId - Agente a editar; null = creación.
 */
export default function AgentEditor({ agentId, onSaved, onCancel }) {
  const { authToken, logout } = useAuth();

  const [agent, setAgent]       = useState(null);
  const [areas, setAreas]       = useState([]);
  const [subareas, setSubareas] = useState([]);
  const [loading, setLoading]   = useState(true);

  const [form, setForm]     = useState(EMPTY_AGENT);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [areaSubareas, setAreaSubareas]       = useState([]);   // subáreas del área elegida
  const [loadingSubareas, setLoadingSubareas] = useState(false);

  // Solo los {{n}} se guardan (viven dentro del prompt); los nombres son ayuda de edición.
  const [variables, setVariables] = useState([]);   // [{ numero, nombre }]
  const promptRef    = useRef(null);
  const highlightRef = useRef(null);   // capa de resaltado bajo el textarea

  const selectedArea = areas.find((a) => String(a.id) === String(form.area_id)) || null;
  const needsSubarea = !!selectedArea?.subareas;

  // Subáreas de un área concreta: el endpoint recibe el area_id y devuelve { uuid, name }.
  const loadSubareasForArea = useCallback(async (area) => {
    if (!area) { setAreaSubareas([]); return; }
    setLoadingSubareas(true);
    try {
      const res = await apiFetch(`/api/v1/subareas/area/${area.id}`, { token: authToken, onUnauthorized: logout });
      setAreaSubareas(res.ok ? await res.json() : []);
    } catch (err) {
      if (err.message !== 'Unauthorized') console.error('Error loading subareas:', err);
      setAreaSubareas([]);
    } finally {
      setLoadingSubareas(false);
    }
  }, [authToken, logout]);

  // Carga inicial: áreas, subáreas y —si es edición— el agente.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const reqs = [
          apiFetch('/api/v1/areas',    { token: authToken, onUnauthorized: logout }),
          apiFetch('/api/v1/subareas', { token: authToken, onUnauthorized: logout }),
        ];
        if (agentId) reqs.push(apiFetch(`/api/v1/agents/${agentId}`, { token: authToken, onUnauthorized: logout }));

        const [areasRes, subareasRes, agentRes] = await Promise.all(reqs);
        if (cancelled) return;

        if (areasRes.ok)    setAreas(await areasRes.json());
        if (subareasRes.ok) setSubareas(await subareasRes.json());

        if (agentId) {
          if (agentRes.ok) setAgent(await agentRes.json());
          else setError('No se encontró el agente.');
        }
      } catch (err) {
        if (!cancelled && err.message !== 'Unauthorized') {
          setError('Error de conexión. Verifica que la API esté corriendo.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [agentId, authToken, logout]);

  // Precarga del formulario una vez que hay datos.
  useEffect(() => {
    if (!agent) { setForm(EMPTY_AGENT); setAreaSubareas([]); return; }

    // area_uuid puede apuntar a un área o a una subárea.
    let parent = areas.find((x) => x.uuid === agent.area_uuid);
    let subUuid = '';
    if (!parent) {
      const sub = subareas.find((s) => s.uuid === agent.area_uuid);
      if (sub) {
        parent = areas.find((x) => (x.area || '').trim().toLowerCase() === (sub.area || '').trim().toLowerCase());
        subUuid = sub.uuid;
      }
    }

    // El prompt guardado trae {{nombre}}; el editor trabaja con {{n}}.
    const { prompt, variables: storedVars } = toEditorPrompt(agent.prompt);
    // Se siembran antes de que el efecto derive las filas: así conserva los nombres.
    setVariables(storedVars);

    setForm({
      nombre:   agent.nombre || '',
      agent_id: agent.agent_id || '',
      prompt,
      area_id:  parent ? String(parent.id) : '',
      subarea:  subUuid,
      nota:     agent.nota || '',
      status:   !!agent.status,
    });
    if (parent?.subareas) loadSubareasForArea(parent);
  }, [agent, areas, subareas, loadSubareasForArea]);

  // El prompt es la fuente de verdad: las filas salen de los {{n}} que contiene.
  // Así, borrar un {{n}} a mano quita su fila, y los nombres ya escritos se conservan.
  useEffect(() => {
    const numeros = [...new Set([...form.prompt.matchAll(NUM_VAR_RE)].map((m) => Number(m[1])))]
      .sort((a, b) => a - b);
    setVariables((prev) =>
      numeros.map((numero) => ({
        numero,
        nombre: prev.find((v) => v.numero === numero)?.nombre ?? '',
      }))
    );
  }, [form.prompt]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Al cambiar el área: reinicia la subárea y, si el área tiene subáreas, las carga.
  const onAreaChange = (value) => {
    const area = areas.find((a) => String(a.id) === String(value)) || null;
    setForm((f) => ({ ...f, area_id: value, subarea: '' }));
    setAreaSubareas([]);
    if (area?.subareas) loadSubareasForArea(area);
  };

  // Inserta {{n}} donde esté el cursor; si el prompt no tiene foco, al final.
  const addVariable = () => {
    const numero = variables.length ? Math.max(...variables.map((v) => v.numero)) + 1 : 1;
    const token  = `{{${numero}}}`;
    const el     = promptRef.current;
    const pos    = el && document.activeElement === el ? el.selectionStart : form.prompt.length;

    setField('prompt', form.prompt.slice(0, pos) + token + form.prompt.slice(pos));

    // Devuelve el cursor justo después del marcador recién insertado.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos + token.length, pos + token.length);
    });
  };

  const setVariableNombre = (numero, nombre) =>
    setVariables((vs) => vs.map((v) => (v.numero === numero ? { ...v, nombre } : v)));

  const handleSave = async () => {
    setError('');
    if (!form.nombre.trim())   { setError('El nombre es obligatorio.'); return; }
    if (!form.agent_id.trim()) { setError('El agent_id es obligatorio.'); return; }
    if (!form.prompt.trim())   { setError('El prompt es obligatorio.'); return; }
    if (!form.area_id)         { setError('Selecciona un área.'); return; }
    if (needsSubarea && !form.subarea) { setError('Selecciona una subárea.'); return; }

    // Los nombres viajan dentro del prompt, así que tienen que poder distinguirse
    // entre sí y de un marcador numérico al volver a leerlos.
    const nombres = variables.map((v) => v.nombre.trim()).filter(Boolean);
    if (nombres.some((n) => /^\d+$/.test(n))) {
      setError('El nombre de una variable no puede ser solo números.'); return;
    }
    if (nombres.some((n) => /[{}]/.test(n))) {
      setError('El nombre de una variable no puede contener llaves.'); return;
    }
    if (new Set(nombres).size !== nombres.length) {
      setError('Hay variables con el mismo nombre.'); return;
    }

    // area_uuid = uuid de la subárea si el área tiene subáreas; si no, uuid del área.
    const body = {
      nombre:    form.nombre.trim(),
      agent_id:  form.agent_id.trim(),
      prompt:    toStoredPrompt(form.prompt, variables).trim(),
      area_uuid: needsSubarea ? form.subarea : (selectedArea?.uuid || ''),
      nota:      form.nota.trim() || null,
    };
    // El estado solo se puede cambiar al editar (AgentCreate no lo acepta).
    if (agentId) body.status = form.status;

    setSaving(true);
    try {
      const res = agentId
        ? await apiFetch(`/api/v1/agents/${agentId}`, { method: 'PUT', token: authToken, onUnauthorized: logout, body })
        : await apiFetch('/api/v1/agents', { method: 'POST', token: authToken, onUnauthorized: logout, body });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSaved();
      } else {
        setError(data.detail || 'Error al guardar el agente.');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') setError('Error de conexión. Verifica que la API esté corriendo.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
      <RefreshCw className="w-10 h-10 text-gray-400 animate-spin mb-4" />
      <p className="text-gray-500">Cargando agente...</p>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            title="Volver"
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#053E68] transition disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="w-1 h-9 bg-[#F4CD04] rounded-full" />
          <div>
            <h2 className="text-xl font-bold text-[#053E68] leading-tight">
              {agent ? 'Editar agente' : 'Nuevo agente'}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {agent ? `Editando "${agent.nombre}"` : 'Configura el agente y su prompt'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition text-sm font-medium disabled:opacity-50"
          >
            {saving
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
              : <><Check className="w-4 h-4" /> {agent ? 'Guardar' : 'Crear'}</>}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Datos del agente */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre *</label>
            <input className={inputCls} value={form.nombre} disabled={saving} maxLength={15}
              onChange={(e) => setField('nombre', e.target.value)} placeholder="Ej: Karina" />
            <p className="text-xs text-gray-400 mt-1.5">Máximo 15 caracteres.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Agent ID *</label>
            <input className={inputCls} value={form.agent_id} disabled={saving} maxLength={50}
              autoComplete="off"
              onChange={(e) => setField('agent_id', e.target.value)} placeholder="Ej: agent_cobros_01" />
            <p className="text-xs text-gray-400 mt-1.5">Identificador único, máximo 50 caracteres.</p>
          </div>
        </div>

        {/* Área y subárea comparten fila: la subárea aparece al lado, no desplaza a la nota. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Área *</label>
            <select className={inputCls} value={form.area_id} disabled={saving}
              onChange={(e) => onAreaChange(e.target.value)}>
              <option value="">-- Selecciona un área --</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.area}</option>)}
            </select>
          </div>

          {/* Si el área tiene subáreas, hay que elegir una de ellas. */}
          {needsSubarea && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Subárea *</label>
              <select className={inputCls} value={form.subarea} disabled={loadingSubareas || saving}
                onChange={(e) => setField('subarea', e.target.value)}>
                <option value="">
                  {loadingSubareas ? 'Cargando subáreas...' : '-- Selecciona una subárea --'}
                </option>
                {areaSubareas.map((s) => <option key={s.uuid} value={s.uuid}>{s.name}</option>)}
              </select>
              {!loadingSubareas && areaSubareas.length === 0 && (
                <p className="text-xs text-gray-400 mt-1.5">Esta área no tiene subáreas disponibles.</p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nota</label>
            <input className={inputCls} value={form.nota} disabled={saving} maxLength={150}
              onChange={(e) => setField('nota', e.target.value)}
              placeholder="Nota interna (opcional)" />
            <p className="text-xs text-gray-400 mt-1.5">Máximo 150 caracteres.</p>
          </div>

          {/* El estado solo se puede cambiar al editar. */}
          {agent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
              <select className={inputCls} value={form.status ? 'true' : 'false'} disabled={saving}
                onChange={(e) => setField('status', e.target.value === 'true')}>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Prompt (60%) + Variables (40%). El alto de la fila es fijo: así ambas
          tarjetas miden lo mismo y la lista de variables puede desbordar y scrollear. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:h-[72vh]">

        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col min-h-0">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Prompt *</label>

          {/* Un textarea no puede colorear parte de su texto. Por eso debajo va una
              capa con el mismo texto resaltado y el textarea encima con el texto
              transparente (solo se ve su cursor). Ambos comparten tipografía,
              padding y scroll: si se desalinean, es que alguna clase dejó de coincidir. */}
          <div
            className={`relative flex-1 min-h-[60vh] lg:min-h-0 rounded-lg border transition
              ${saving ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-200 focus-within:border-[#053E68]'}`}
          >
            <div
              ref={highlightRef}
              aria-hidden="true"
              style={{ scrollbarGutter: 'stable' }}
              className="absolute inset-0 overflow-hidden pointer-events-none px-4 py-2.5
                font-mono text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-700"
            >
              {highlightVars(form.prompt)}
              {'​'}
            </div>
            <textarea
              ref={promptRef}
              style={{ scrollbarGutter: 'stable' }}
              className="absolute inset-0 w-full h-full resize-none bg-transparent text-transparent caret-[#053E68]
                px-4 py-2.5 border-0 rounded-lg focus:outline-none overflow-y-auto
                font-mono text-sm leading-relaxed break-words
                placeholder:text-gray-400 disabled:cursor-not-allowed"
              value={form.prompt}
              disabled={saving}
              onChange={(e) => setField('prompt', e.target.value)}
              onScroll={(e) => { if (highlightRef.current) highlightRef.current.scrollTop = e.target.scrollTop; }}
              placeholder="Instrucciones del agente de voz..."
            />
          </div>

          <p className="text-xs text-gray-400 mt-1.5">
            {form.prompt.length} caracteres. Sin límite de longitud.
          </p>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Variables</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {variables.length} variable{variables.length !== 1 ? 's' : ''} en el prompt
              </p>
            </div>
            <button
              onClick={addVariable}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] transition text-sm font-medium disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Agregar
            </button>
          </div>

          {variables.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center py-12">
              <div className="p-4 bg-[#053E68]/5 rounded-full mb-4">
                <Braces className="w-8 h-8 text-[#053E68]" />
              </div>
              <p className="text-gray-600 font-medium mb-1">Sin variables</p>
              <p className="text-gray-400 text-sm">Agrega la primera y aparecerá en el prompt</p>
            </div>
          ) : (
            // Si hay muchas variables, la lista scrollea dentro de la tarjeta
            // en lugar de estirarla más que el prompt. El min-h-0 es lo que
            // permite que el hijo flex encoja y llegue a desbordar.
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 -mx-1 px-1">
              {/* Sticky: el encabezado no se va al scrollear la lista. */}
              <div className="sticky top-0 z-10 bg-white flex gap-2 pb-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider px-1">
                <span className="w-16 shrink-0 text-center">Número</span>
                <span className="flex-1">Nombre</span>
              </div>
              {variables.map((v) => (
                <div key={v.numero} className="flex gap-2">
                  {/* Mismo amarillo que el resaltado del prompt, para atarlos visualmente.
                      Sin clases disabled:*, que chocarían con el fondo. */}
                  <input
                    className="w-16 shrink-0 px-2 py-2.5 border border-gray-200 rounded-lg text-center
                      font-mono text-base font-semibold bg-[#F4CD04]/40 text-[#053E68] cursor-not-allowed"
                    value={v.numero}
                    disabled
                    readOnly
                  />
                  <input
                    className={`${baseInputCls} flex-1 min-w-0`}
                    value={v.nombre}
                    disabled={saving}
                    onChange={(e) => setVariableNombre(v.numero, e.target.value)}
                    placeholder="Nombre de la variable"
                  />
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4">
            En el prompt cada variable se ve como <code className="font-mono">{'{{n}}'}</code> y se guarda
            como <code className="font-mono">{'{{nombre}}'}</code>. Si borras el marcador del prompt, su fila desaparece.
          </p>
        </div>
      </div>
    </div>
  );
}

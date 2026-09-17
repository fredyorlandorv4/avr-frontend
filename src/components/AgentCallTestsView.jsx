import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Loader2, PhoneCall, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'busy', 'no_answer', 'cancelled', 'queue_failed']);
const STATUS_LABELS = {
  queued: 'En cola', initiated: 'Iniciando', ringing: 'Timbrando', answered: 'Contestada',
  completed: 'Completada', failed: 'Fallida', busy: 'Ocupado', no_answer: 'Sin respuesta',
  cancelled: 'Cancelada', queue_failed: 'Error al encolar',
};

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#053E68] text-sm transition disabled:bg-gray-100';

function apiMessage(status, detail) {
  const message = typeof detail === 'string' ? detail : Array.isArray(detail)
    ? detail.map((item) => item?.msg).filter(Boolean).join('. ')
    : '';
  if (message) return message;
  return ({ 403: 'No tienes permisos para realizar pruebas de agentes.', 409: 'El agente no está listo o ya existe una llamada activa a este teléfono.', 422: 'Revisa los datos ingresados.', 503: 'La cola o el servicio de llamadas no está disponible.' }[status]) || `Error de API (${status}).`;
}

function initialValues(fields = []) {
  return fields.reduce((values, field) => {
    values[field.path] = field.input_type === 'object_list'
      ? (Array.isArray(field.default) ? field.default : [])
      : (field.default ?? '');
    return values;
  }, {});
}

function setPath(target, path, value) {
  const keys = path.split('.');
  let cursor = target;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) cursor[key] = value;
    else cursor = cursor[key] ||= {};
  });
}

function requestBody(fields, values) {
  const body = { phone: null, client_name: null, project_id: null, data: {} };
  fields.forEach((field) => {
    let value = values[field.path];
    if (field.input_type === 'number' && value !== '' && value != null) value = Number.parseInt(value, 10);
    if (field.input_type === 'money' && value !== '' && value != null) value = Number(value);
    if (value === '') value = null;
    setPath(body, field.path, value);
  });
  return body;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('es-GT') : '—';
}

function DynamicField({ field, value, onChange, disabled, error }) {
  if (field.input_type === 'object_list') {
    const rows = Array.isArray(value) ? value : [];
    const updateRow = (index, itemField, itemValue) => {
      const next = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [itemField.path.split('.').at(-1)]: itemValue } : row);
      onChange(next);
    };
    return <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div><label className="block text-sm font-medium text-gray-700">{field.label}{field.required ? ' *' : ''}</label>{field.description && <p className="text-xs text-gray-400 mt-1">{field.description}</p>}</div>
      {rows.map((row, index) => <div key={index} className="rounded-lg bg-gray-50 p-3 space-y-3 relative">
        <button type="button" disabled={disabled} onClick={() => onChange(rows.filter((_, i) => i !== index))} className="absolute right-2 top-2 p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
        {field.item_fields.map((itemField) => <div key={itemField.path} className="pr-8"><label className="block text-xs font-medium text-gray-600 mb-1">{itemField.label}{itemField.required ? ' *' : ''}</label><input className={inputCls} disabled={disabled} type={itemField.input_type === 'money' || itemField.input_type === 'number' ? 'number' : itemField.input_type === 'email' ? 'email' : 'text'} step={itemField.input_type === 'money' ? '0.01' : undefined} value={row[itemField.path.split('.').at(-1)] ?? itemField.default ?? ''} onChange={(e) => updateRow(index, itemField, e.target.value)} /></div>)}
      </div>)}
      <button type="button" disabled={disabled} onClick={() => onChange([...rows, {}])} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#053E68] hover:text-[#06497c]"><Plus className="w-4 h-4" />Agregar fila</button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>;
  }
  const type = field.input_type === 'email' ? 'email' : field.input_type === 'number' || field.input_type === 'money' ? 'number' : 'text';
  return <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}{field.required ? ' *' : ''}</label>
    <input className={`${inputCls} ${error ? 'border-red-400' : ''}`} type={type} step={field.input_type === 'money' ? '0.01' : field.input_type === 'number' ? '1' : undefined} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    {error ? <p className="text-xs text-red-600 mt-1.5">{error}</p> : field.description && <p className="text-xs text-gray-400 mt-1.5">{field.description}</p>}
  </div>;
}

export default function AgentCallTestsView() {
  const { authToken, logout } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [test, setTest] = useState(null);
  const [values, setValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeCall, setActiveCall] = useState(null);

  const loadAgents = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await apiFetch('/api/v1/agent-call-tests/agents', { token: authToken, onUnauthorized: logout });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setAgents(Array.isArray(data.agents) ? data.agents : []);
      else setError(apiMessage(res.status, data.detail));
    } catch (err) { if (err.message !== 'Unauthorized') setError('No se pudieron cargar los agentes.'); }
    finally { setLoading(false); }
  }, [authToken, logout]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  useEffect(() => {
    if (!activeCall?.status_url || !activeCall.polling) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await apiFetch(activeCall.status_url, { token: authToken, onUnauthorized: logout });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) setActiveCall((current) => current && ({ ...current, ...data, polling: !TERMINAL_STATUSES.has(data.status) }));
        else setActiveCall((current) => current && ({ ...current, status: 'queue_failed', polling: false, error: apiMessage(res.status, data.detail) }));
      } catch (err) { if (!cancelled && err.message !== 'Unauthorized') setActiveCall((current) => current && ({ ...current, status: 'queue_failed', polling: false, error: 'No se pudo consultar el estado de la llamada.' })); }
    };
    poll();
    const timer = window.setInterval(poll, 2500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeCall?.status_url, activeCall?.polling, authToken, logout]);

  const openTest = (agent) => {
    if (activeCall?.polling) return;
    setTest(agent); setValues(initialValues(agent.fields)); setFieldErrors({}); setValidation(null); setConfirming(false);
  };
  const changeValue = (path, value) => { setValues((current) => ({ ...current, [path]: value })); setValidation(null); setFieldErrors((current) => ({ ...current, [path]: undefined })); };
  const testBody = useMemo(() => test ? requestBody(test.fields || [], values) : null, [test, values]);

  const validate = async () => {
    const required = (test.fields || []).reduce((errors, field) => {
      const value = values[field.path];
      if (field.required && (value === '' || value == null || (Array.isArray(value) && !value.length))) errors[field.path] = 'Este campo es obligatorio.';
      return errors;
    }, {});
    if (Object.keys(required).length) { setFieldErrors(required); return; }
    setValidating(true); setError(''); setFieldErrors({});
    try {
      const res = await apiFetch(`/api/v1/agent-call-tests/agents/${test.agent_id}/validate`, { method: 'POST', token: authToken, onUnauthorized: logout, body: testBody });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setValidation({ ...data, phone: data.phone || data.normalized_phone || testBody.phone });
      else { setValidation(null); setError(apiMessage(res.status, data.detail)); }
    } catch (err) { if (err.message !== 'Unauthorized') setError('No se pudo validar la llamada de prueba.'); }
    finally { setValidating(false); }
  };

  const queueCall = async () => {
    if (!validation || submitting) return;
    setSubmitting(true); setError('');
    try {
      const res = await apiFetch(`/api/v1/agent-call-tests/agents/${test.agent_id}/calls`, { method: 'POST', token: authToken, onUnauthorized: logout, body: { ...testBody, phone: validation.phone || testBody.phone, confirm_call: true } });
      const data = await res.json().catch(() => ({}));
      if (res.status === 202) { setActiveCall({ ...data, status: 'queued', polling: true }); setConfirming(false); setTest(null); }
      else setError(apiMessage(res.status, data.detail));
    } catch (err) { if (err.message !== 'Unauthorized') setError('No se pudo encolar la llamada.'); }
    finally { setSubmitting(false); }
  };

  const isBusy = activeCall?.polling || submitting;
  return <div className="max-w-[1280px] mx-auto space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h2 className="text-xl font-bold text-[#053E68]">Pruebas de Agentes</h2><p className="text-sm text-gray-400 mt-1">Las llamadas se encolan y originan exclusivamente desde el backend.</p></div><button onClick={loadAgents} disabled={loading || isBusy} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm font-medium"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button></div>
    {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>}
    {activeCall && <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-[#053E68]">Prueba: {activeCall.agent_name}</p><p className="text-sm text-gray-500">{activeCall.phone}</p></div><span className={`px-3 py-1 rounded-full text-xs font-semibold ${activeCall.polling ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{STATUS_LABELS[activeCall.status] || activeCall.status}</span></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm"><p><span className="text-gray-400">UUID:</span> {activeCall.call_uuid || '—'}</p><p><span className="text-gray-400">Creada:</span> {formatDate(activeCall.created_at)}</p><p><span className="text-gray-400">Contestada:</span> {formatDate(activeCall.answered_at)}</p><p><span className="text-gray-400">Finalizada:</span> {formatDate(activeCall.completed_at || activeCall.finished_at)}</p></div>{activeCall.error && <p className="text-sm text-red-600 mt-3">{activeCall.error}</p>}</section>}
    {loading ? <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#053E68]" /></div> : <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">{agents.map((agent) => <article key={agent.agent_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"><div className="flex justify-between gap-4"><div><h3 className="font-bold text-lg text-[#053E68]">{agent.agent_name}</h3><p className="text-sm text-gray-400">{agent.area || '—'} · {agent.subarea || 'Sin subárea'}</p></div><span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${agent.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{agent.active ? 'Activo' : 'Inactivo'}</span></div><div className="text-sm text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-2"><p><b>Proveedor:</b> {agent.voice_provider === 'openai_live' ? 'OpenAI GPT-Live' : 'ElevenLabs'}</p><p><b>Modelo:</b> {agent.voice_model || '—'}</p><p><b>DID:</b> {agent.did || '—'}</p></div>{agent.ready ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full"><CheckCircle2 className="w-4 h-4" />Listo para probar</span> : <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><p className="font-medium">No listo para probar</p><ul className="list-disc ml-5 mt-1">{(agent.blockers || []).map((item, i) => <li key={i}>{item}</li>)}</ul></div>}{(agent.warnings || []).length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><div className="flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><ul className="list-disc ml-3">{agent.warnings.map((item, i) => <li key={i}>{item}</li>)}</ul></div></div>}<button disabled={!agent.ready || isBusy} onClick={() => openTest(agent)} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#053E68] text-white rounded-lg hover:bg-[#06497c] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"><PhoneCall className="w-4 h-4" />Generar llamada de prueba</button></article>)}</div>}
    {test && createPortal(<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"><div className="p-5 border-b flex justify-between gap-4"><div><h3 className="font-bold text-lg text-[#053E68]">Prueba de {test.agent_name}</h3><p className="text-sm text-gray-400">Completa los datos definidos por el backend.</p></div><button disabled={validating || submitting} onClick={() => setTest(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div><div className="p-5 overflow-y-auto space-y-4">{(test.fields || []).map((field) => <DynamicField key={field.path} field={field} value={values[field.path]} onChange={(value) => changeValue(field.path, value)} disabled={validating || submitting} error={fieldErrors[field.path]} />)}{validation && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">Teléfono normalizado: <b>{validation.phone}</b></div>}</div><div className="p-5 border-t flex flex-wrap justify-end gap-3"><button disabled={validating || submitting} onClick={validate} className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">{validating ? 'Validando…' : 'Validar datos'}</button><button disabled={!validation || validating || submitting} onClick={() => setConfirming(true)} className="px-4 py-2 text-sm rounded-lg bg-[#053E68] text-white hover:bg-[#06497c] disabled:opacity-50">Confirmar llamada</button></div></div></div>, document.body)}
    {confirming && createPortal(<div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"><div className="flex gap-3"><AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" /><div><h3 className="font-bold text-[#053E68]">¿Realizar llamada real?</h3><p className="text-sm text-gray-600 mt-2">Esta acción realizará una llamada telefónica real. El agente puede ejecutar tools que modifiquen información en el CRM. ¿Deseas continuar?</p></div></div><div className="flex justify-end gap-3 mt-6"><button disabled={submitting} onClick={() => setConfirming(false)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancelar</button><button disabled={submitting} onClick={queueCall} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50">{submitting ? 'Encolando…' : 'Sí, realizar llamada'}</button></div></div></div>, document.body)}
  </div>;
}

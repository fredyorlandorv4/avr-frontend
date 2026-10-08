import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Phone, Send, WalletCards, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useArea } from '../context/AreaContext.jsx';
import { groupOverdueInstallments } from '../utils/overdueInstallments.js';

const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

const value = (source, keys, fallback = '') => {
  for (const key of keys) {
    const found = source?.[key];
    if (found !== undefined && found !== null && found !== '') return found;
  }
  return fallback;
};

const amount = (source, keys) => Number(value(source, keys, 0)) || 0;
const clientIdentity = value => String(value || '').trim().toLocaleLowerCase('es-GT');

const normalizeClients = (payload) => {
  const clients = Array.isArray(payload)
    ? payload
    : (payload?.clientes || payload?.items || payload?.results || payload?.data || []);

  return clients.map((client, clientIndex) => {
    const lots = value(client, ['lotes', 'proyectos_lotes', 'projects'], []);
    const normalizedLots = Array.isArray(lots) ? lots.map((lot, lotIndex) => {
      const installments = groupOverdueInstallments(value(lot, ['cuotas_atrasadas', 'cuotas', 'installments'], []));
      return {
        id: String(value(lot, ['id', 'lote_id', 'lote', 'codigo_lote'], lotIndex)),
        project: value(lot, ['proyecto', 'nombre_proyecto', 'project'], 'Proyecto sin nombre'),
        lot: value(lot, ['lote', 'nombre_lote', 'codigo_lote'], 'Lote sin nombre'),
        overdueInstallments: installments.length,
        pendingTotal: amount(lot, ['total_pendiente_lote', 'total_pendiente', 'subtotal']),
        installments,
      };
    }) : [];
    return {
      id: String(value(client, ['id', 'cliente_id', 'codigo_cliente'], clientIndex)),
      name: value(client, ['nombre_cliente', 'cliente', 'nombre', 'name'], 'Cliente sin nombre'),
      company: value(client, ['empresa', 'company']),
      code: value(client, ['codigo_cliente', 'client_code']),
      phone: value(client, ['telefono_principal', 'telefono', 'phone'], 'Sin teléfono'),
      overdueInstallments: normalizedLots.reduce((total, lot) => total + lot.overdueInstallments, 0),
      pendingTotal: amount(client, ['total_pendiente', 'saldo_total']),
      lots: normalizedLots,
    };
  });
};

function messageFor(response, detail) {
  if (response.status === 403) return 'No tiene permisos para consultar la cartera vencida.';
  if (response.status === 503) return 'La cartera externa no está disponible. Intente actualizar más tarde.';
  return detail || `No se pudo cargar la cartera vencida (${response.status}).`;
}

export default function OverduePortfolioView() {
  const { authToken, logout, isSystem, areaId } = useAuth();
  const { areas } = useArea();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [expandedLots, setExpandedLots] = useState(new Set());
  const [selectedClientIds, setSelectedClientIds] = useState(new Set());
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [subareas, setSubareas] = useState([]);
  const [selectedSubareaId, setSelectedSubareaId] = useState('');
  const [creating, setCreating] = useState(false);
  const [campaignError, setCampaignError] = useState('');
  const [messageSelection, setMessageSelection] = useState(null);
  const [sendingMessages, setSendingMessages] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [messageSuccess, setMessageSuccess] = useState('');

  const load = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/v1/cobros/cartera-vencida', { token: authToken, onUnauthorized: logout });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(messageFor(response, typeof body.detail === 'string' ? body.detail : ''));
      }
      setClients(normalizeClients(await response.json()));
      setExpandedClients(new Set());
      setExpandedLots(new Set());
      setSelectedClientIds(new Set());
    } catch (loadError) {
      if (loadError.message !== 'Unauthorized') setError(loadError.message || 'No se pudo cargar la cartera vencida.');
    } finally {
      setLoading(false);
    }
  }, [authToken, logout]);

  useEffect(() => { load(); }, [load]);

  const selectedClients = clients.filter((client) => selectedClientIds.has(client.id));
  const cobrosArea = areas.find((area) => String(area.area || '').trim().toLowerCase() === 'cobros');
  const campaignAreaId = isSystem ? cobrosArea?.id : areaId;

  useEffect(() => {
    if (!showCampaignForm) return;
    const loadFormOptions = async () => {
      try {
        const [projectsResponse, subareasResponse] = await Promise.all([
          apiFetch('/api/v1/projects', { token: authToken, onUnauthorized: logout }),
          apiFetch('/api/v1/subareas', { token: authToken, onUnauthorized: logout }),
        ]);
        if (projectsResponse.ok) {
          const payload = await projectsResponse.json();
          const availableProjects = Array.isArray(payload) ? payload : (payload.items || payload.results || []);
          setProjects(availableProjects);
          const activeClients = clients.filter((client) => selectedClientIds.has(client.id));
          const projectNames = new Set(activeClients.flatMap((client) => client.lots.map((lot) => lot.project)));
          if (projectNames.size === 1) {
            const matchingProject = availableProjects.find((project) => project.name === [...projectNames][0]);
            if (matchingProject) setSelectedProjectId(String(matchingProject.id));
          }
        }
        if (subareasResponse.ok) {
          const payload = await subareasResponse.json();
          setSubareas(Array.isArray(payload) ? payload : []);
        }
      } catch (formError) {
        if (formError.message !== 'Unauthorized') setCampaignError('No se pudieron cargar las opciones de la campaña.');
      }
    };
    loadFormOptions();
  }, [showCampaignForm, authToken, logout, clients, selectedClientIds]);

  const toggle = (setter, id) => setter((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleClient = (clientId) => toggle(setSelectedClientIds, clientId);
  const selectedAreaSubareas = subareas.filter((subarea) => String(subarea.area || '').trim().toLowerCase() === 'cobros');
  const campaignAreaHasSubareas = isSystem ? Boolean(cobrosArea?.subareas) : selectedAreaSubareas.length > 0;

  const openCampaignForm = () => {
    setCampaignError('');
    setCampaignName('');
    setSelectedProjectId('');
    setSelectedSubareaId('');
    setShowCampaignForm(true);
  };

  const createCampaign = async () => {
    if (!campaignName.trim()) { setCampaignError('Ingrese un nombre para la campaña.'); return; }
    if (!selectedProjectId) { setCampaignError('Seleccione el proyecto asociado.'); return; }
    if (!campaignAreaId) { setCampaignError('No se encontró el área de Cobros para crear la campaña.'); return; }
    if (campaignAreaHasSubareas && !selectedSubareaId) { setCampaignError('Seleccione una subárea de Cobros.'); return; }

    const rows = selectedClients.flatMap((client) => client.lots.map((lot) => ({
      lote: lot.lot,
      cliente: client.name,
      telefono: client.phone === 'Sin teléfono' ? '' : client.phone,
      total: lot.pendingTotal,
    })));
    if (!rows.length) { setCampaignError('Los clientes seleccionados no tienen lotes vencidos para incluir.'); return; }

    setCreating(true);
    setCampaignError('');
    try {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Contactos');
      const file = new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'contactos-sap.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('campaign_name', campaignName.trim());
      formData.append('project_id', selectedProjectId);
      formData.append('area_id', String(campaignAreaId));
      if (campaignAreaHasSubareas) formData.append('subarea_id', selectedSubareaId);

      const response = await apiFetch('/api/v1/campaigns/upload', {
        method: 'POST', token: authToken, onUnauthorized: logout, body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.detail === 'string' ? payload.detail : 'No se pudo crear la campaña.');
      navigate('/campaigns');
    } catch (createError) {
      if (createError.message !== 'Unauthorized') setCampaignError(createError.message || 'No se pudo crear la campaña.');
    } finally {
      setCreating(false);
    }
  };

  const prepareMessageSend = async () => {
    if (!selectedClients.length) return;
    setMessageError(''); setMessageSuccess('');
    try {
      const response = await apiFetch('/api/v1/cobros/reminders/candidates', { token: authToken, onUnauthorized: logout });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.detail === 'string' ? payload.detail : payload.detail?.message || 'No se pudieron consultar los candidatos para Mensajería.');
      const selectedCodes = new Set(selectedClients.map(client => clientIdentity(client.code)).filter(Boolean));
      const selectedNames = new Set(selectedClients.map(client => clientIdentity(client.name)).filter(Boolean));
      const matching = (Array.isArray(payload) ? payload : []).filter(candidate => (
        selectedCodes.has(clientIdentity(candidate.customer_code))
        || selectedNames.has(clientIdentity(candidate.customer_name))
      ));
      const ready = matching.filter(candidate => candidate.send_ready);
      if (!ready.length) {
        const reasons = [...new Set(matching.map(candidate => candidate.unavailable_reason).filter(Boolean))];
        throw new Error(reasons.length ? `Ningún cliente seleccionado está listo para envío: ${reasons.join('. ')}` : 'Los clientes seleccionados no tienen mensajes disponibles para la fecha programada.');
      }
      setMessageSelection({ ready, unavailable: matching.length - ready.length });
    } catch (requestError) {
      if (requestError.message !== 'Unauthorized') setMessageError(requestError.message || 'No se pudieron preparar los mensajes.');
    }
  };

  const sendSelectedMessages = async () => {
    if (!messageSelection?.ready?.length || sendingMessages) return;
    setSendingMessages(true); setMessageError('');
    try {
      const candidatesByDate = messageSelection.ready.reduce((groups, candidate) => {
        const dueDate = candidate.due_date;
        groups.set(dueDate, [...(groups.get(dueDate) || []), candidate.delivery_key]);
        return groups;
      }, new Map());
      const results = [];
      for (const [dueDate, deliveryKeys] of candidatesByDate) {
        const response = await apiFetch('/api/v1/cobros/reminders/send', {
          method: 'POST', token: authToken, onUnauthorized: logout,
          body: { due_date: dueDate, delivery_keys: deliveryKeys },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof payload.detail === 'string' ? payload.detail : payload.detail?.message || 'No se pudieron encolar los mensajes.');
        results.push(payload);
      }
      const count = results.reduce((total, result) => total + (result.selected_count || 0), 0);
      setMessageSuccess(`${count} mensaje${count === 1 ? '' : 's'} encolado${count === 1 ? '' : 's'} para envío.`);
      setMessageSelection(null);
      setSelectedClientIds(new Set());
    } catch (requestError) {
      if (requestError.message !== 'Unauthorized') setMessageError(requestError.message || 'No se pudieron encolar los mensajes.');
    } finally { setSendingMessages(false); }
  };

  return <div className="max-w-[1400px] mx-auto space-y-5">
    <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#053E68]">Consulta SAP</h2>
          <p className="text-sm text-gray-500 mt-1">{loading ? 'Consultando cartera externa...' : `${clients.length} ${clients.length === 1 ? 'cliente con saldo vencido' : 'clientes con saldo vencido'}`}</p>
        </div>
        <div className="flex flex-wrap gap-2"><button onClick={load} disabled={loading || sendingMessages} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button><button onClick={openCampaignForm} disabled={loading || selectedClientIds.size === 0 || sendingMessages} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#053E68] text-white text-sm font-medium hover:bg-[#06497c] disabled:opacity-50"><WalletCards className="w-4 h-4" />Crear Campaña{selectedClientIds.size ? ` (${selectedClientIds.size})` : ''}</button><button onClick={prepareMessageSend} disabled={loading || selectedClientIds.size === 0 || sendingMessages} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B5A8E] px-4 py-2 text-sm font-medium text-white hover:bg-[#053E68] disabled:opacity-50"><Send className="w-4 h-4" />Enviar Mensaje{selectedClientIds.size ? ` (${selectedClientIds.size})` : ''}</button></div>
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {messageError && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{messageError}</p>}
      {messageSuccess && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{messageSuccess}</p>}
    </section>

    {loading ? <section className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">Cargando cartera vencida...</section>
      : !error && clients.length === 0 ? <section className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">No hay saldos vencidos para mostrar.</section>
      : <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-[#053E68] text-white"><tr>{['', 'Cliente', 'Teléfono principal', 'Cuotas atrasadas', 'Total pendiente', ''].map((header, index) => <th key={`${header}-${index}`} className="px-4 py-3 font-semibold whitespace-nowrap">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{clients.map((client) => {
        const clientExpanded = expandedClients.has(client.id);
        return <><tr key={client.id} className="hover:bg-gray-50"><td className="px-4 py-4"><input type="checkbox" checked={selectedClientIds.has(client.id)} onChange={() => toggleClient(client.id)} aria-label={`Seleccionar ${client.name}`} className="h-4 w-4 accent-[#053E68]" /></td><td className="px-4 py-4"><p className="font-semibold text-[#053E68]">{client.name}</p><p className="text-xs text-gray-500 mt-0.5">{[client.company, client.code].filter(Boolean).join(' · ') || 'Sin empresa o código registrado'}</p></td><td className="px-4 py-4 text-gray-700 whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><Phone className="w-4 h-4 text-gray-400" />{client.phone}</span></td><td className="px-4 py-4 font-medium text-center">{client.overdueInstallments}</td><td className="px-4 py-4 font-semibold text-[#053E68] whitespace-nowrap">{currency.format(client.pendingTotal)}</td><td className="px-4 py-4"><button onClick={() => toggle(setExpandedClients, client.id)} aria-label={`Ver lotes de ${client.name}`} className="p-1.5 rounded hover:bg-[#053E68]/10 text-[#053E68]">{clientExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}</button></td></tr>
          {clientExpanded && <tr key={`${client.id}-lots`}><td colSpan="6" className="p-4 bg-gray-50"><div className="space-y-3">
            {client.lots.map((lot) => {
              const lotId = `${client.id}:${lot.id}`;
              const lotExpanded = expandedLots.has(lotId);
              return <div key={lotId} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                <button onClick={() => toggle(setExpandedLots, lotId)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50">
                  {lotExpanded ? <ChevronDown className="w-4 h-4 text-[#053E68] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#053E68] shrink-0" />}
                  <div className="min-w-0 flex-1"><p className="font-medium text-gray-800">{lot.project}</p><p className="text-sm text-gray-500">{lot.lot}</p></div>
                  <div className="hidden sm:grid grid-cols-2 gap-x-6 text-sm shrink-0"><span className="text-gray-500">Cuotas atrasadas</span><span className="font-medium text-right">{lot.overdueInstallments}</span><span className="text-gray-500">Pendiente</span><span className="font-semibold text-right text-[#053E68]">{currency.format(lot.pendingTotal)}</span></div>
                </button>
                {lotExpanded && <div className="overflow-x-auto border-t border-gray-100"><table className="w-full text-sm text-left"><thead className="bg-[#053E68] text-white"><tr>{['Cuota', 'Concepto', 'Fecha compromiso', 'Antigüedad', 'Total a pagar'].map((header) => <th key={header} className="px-4 py-3 font-semibold whitespace-nowrap">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{lot.installments.length ? lot.installments.map((installment) => <tr key={installment.key}><td className="px-4 py-3">{installment.number}</td><td className="px-4 py-3">{installment.concept}</td><td className="px-4 py-3 whitespace-nowrap">{installment.dueDate || '—'}</td><td className="px-4 py-3">{installment.age}</td><td className="px-4 py-3 font-medium whitespace-nowrap">{currency.format(installment.total)}</td></tr>) : <tr><td colSpan="5" className="px-4 py-7 text-center text-gray-400">No hay cuotas vencidas para este lote.</td></tr>}</tbody></table></div>}
              </div>;
            })}
            {!client.lots.length && <p className="py-4 text-center text-sm text-gray-400">No hay lotes vencidos para este cliente.</p>}
          </div></td></tr>}</>;
      })}</tbody></table></div></section>}
    {showCampaignForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#053E68]/30 px-4"><div role="dialog" aria-modal="true" aria-labelledby="campaign-title" className="w-full max-w-lg rounded-xl bg-white shadow-xl"><div className="flex items-center justify-between border-b border-gray-100 px-6 py-4"><div><h3 id="campaign-title" className="font-bold text-[#053E68]">Crear campaña de Cobros</h3><p className="text-sm text-gray-500 mt-1">{selectedClients.length} clientes seleccionados</p></div><button onClick={() => !creating && setShowCampaignForm(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" aria-label="Cerrar"><X className="w-5 h-5" /></button></div><div className="space-y-4 p-6"><label className="block text-sm font-medium text-gray-700">Nombre de la campaña<input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} disabled={creating} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:border-[#053E68]" /></label><label className="block text-sm font-medium text-gray-700">Proyecto asociado<select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} disabled={creating} className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus:border-[#053E68]"><option value="">Seleccione un proyecto</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>{campaignAreaHasSubareas && <label className="block text-sm font-medium text-gray-700">Subárea<select value={selectedSubareaId} onChange={(event) => setSelectedSubareaId(event.target.value)} disabled={creating} className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus:border-[#053E68]"><option value="">Seleccione una subárea</option>{selectedAreaSubareas.map((subarea) => <option key={subarea.id} value={subarea.id}>{subarea.name}</option>)}</select></label>}{campaignError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{campaignError}</p>}</div><div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4"><button onClick={() => setShowCampaignForm(false)} disabled={creating} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button><button onClick={createCampaign} disabled={creating} className="inline-flex items-center gap-2 rounded-lg bg-[#053E68] px-4 py-2 text-sm font-medium text-white hover:bg-[#06497c] disabled:opacity-50">{creating && <RefreshCw className="w-4 h-4 animate-spin" />}{creating ? 'Creando...' : 'Crear Campaña'}</button></div></div></div>}
    {messageSelection && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#053E68]/30 px-4"><div role="dialog" aria-modal="true" aria-labelledby="send-message-title" className="w-full max-w-md rounded-xl bg-white shadow-xl"><div className="flex items-start justify-between border-b border-gray-100 px-6 py-4"><div><h3 id="send-message-title" className="font-bold text-[#053E68]">¿Enviar mensajes?</h3><p className="mt-1 text-sm text-gray-500">Se enviarán recordatorios reales por WhatsApp.</p></div><button disabled={sendingMessages} onClick={() => setMessageSelection(null)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" aria-label="Cerrar"><X className="w-5 h-5" /></button></div><div className="space-y-2 p-6 text-sm text-slate-600"><p><b className="text-slate-800">{messageSelection.ready.length}</b> mensajes listos para encolar.</p>{messageSelection.unavailable > 0 && <p className="rounded-lg bg-amber-50 p-3 text-amber-800">{messageSelection.unavailable} cliente{messageSelection.unavailable === 1 ? '' : 's'} seleccionado{messageSelection.unavailable === 1 ? '' : 's'} no está{messageSelection.unavailable === 1 ? '' : 'n'} listo{messageSelection.unavailable === 1 ? '' : 's'} y no se incluirá{messageSelection.unavailable === 1 ? '' : 'n'}.</p>}</div><div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4"><button disabled={sendingMessages} onClick={() => setMessageSelection(null)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">Cancelar</button><button disabled={sendingMessages} onClick={sendSelectedMessages} className="inline-flex items-center gap-2 rounded-lg bg-[#0B5A8E] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Send className="w-4 h-4" />{sendingMessages ? 'Encolando…' : 'Sí, enviar'}</button></div></div></div>}
  </div>;
}

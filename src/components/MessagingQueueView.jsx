import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link2, MessageSquare, RefreshCw, X } from "lucide-react";
import { apiFetch } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { messagingType, matchesMessagingType } from "../utils/messagingType.js";
import { MESSAGING_PAGE_SIZE, messagingDateRange, messagingPage } from "../utils/messagingPagination.js";
import MessagingDateFilter from "./MessagingDateFilter.jsx";
import { messageLots, messageStatus, messageTypeLabel, filterAndSortMessages, messageDate, messageCountry, messageSender } from "../utils/messagingTable.js";

const todayInGuatemala = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const keyOf = (company, project) =>
  `${String(company || "")
    .trim()
    .toLowerCase()}|${String(project || "")
    .trim()
    .toLowerCase()}`;
const listFrom = (value) =>
  Array.isArray(value) ? value : value?.items || value?.results || value?.data || [];
const runDateOf = (run) =>
  String(run.run_date || run.queried_at || run.created_at || "").slice(0, 10);
const lotsOf = delivery => messageLots(delivery) || "—";
const statusOf = messageStatus;
const canCancel = delivery => delivery.status === 'pending' || (delivery.status === 'sending' && Number(delivery.attempts) === 0);
const displayDate = (delivery) => {
  const value = messageDate(delivery);
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-GT", { timeZone: "America/Guatemala" });
};

function DeliveryProgress({ delivery, onCancel, cancelling }) {
  const status = statusOf(delivery).key;
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (status !== 'sending') return undefined;
    const interval = window.setInterval(() => setProgress(value => Math.min(95, value + 1 + Math.ceil(Math.random() * 3))), 650);
    return () => window.clearInterval(interval);
  }, [status]);
  const percent = status === 'sent' || status === 'failed' || status === 'cancelled' ? 100 : status === 'queued' ? 0 : progress;
  const color = status === 'sent' ? 'bg-emerald-500' : status === 'failed' ? 'bg-red-500' : status === 'cancelled' ? 'bg-slate-400' : status === 'sending' ? 'animate-pulse bg-gradient-to-r from-blue-600 via-sky-400 to-blue-600' : 'bg-blue-500';
  return <div className="flex min-w-36 items-center gap-2">
    <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Progreso del envío" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${percent}%` }} />
    </div>
    <span className="w-9 text-right text-xs tabular-nums text-slate-600">{percent}%</span>
    {canCancel(delivery) && <button type="button" onClick={() => onCancel(delivery)} disabled={cancelling} aria-label={`Cancelar envío a ${delivery.nombre_cliente}`} title="Cancelar envío" className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"><X className="h-4 w-4" /></button>}
  </div>;
}

function InstanceLinkModal({ instances, selected, qr, message, busy, onSelect, onClose }) {
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="Vinculación de instancias" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-[#053E68]">Vinculación</h2><button type="button" onClick={onClose} aria-label="Cerrar vinculación"><X className="h-5 w-5" /></button></div>
      <p className="mt-2 text-sm text-slate-600">Selecciona una instancia y escanea el QR desde WhatsApp.</p>
      <div className="mt-4 max-h-40 space-y-2 overflow-y-auto">{instances.length ? instances.map(name => <button key={name} type="button" onClick={() => onSelect(name)} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${selected === name ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>{name}</button>) : <p className="text-sm text-slate-500">No hay instancias disponibles para esta cartera.</p>}</div>
      {selected && <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-600">{qr ? <img src={qr} alt={`QR para vincular ${selected}`} className="h-60 w-60 object-contain" /> : busy ? 'Cargando QR…' : message || 'Esperando QR de Evolution API…'}</div>}
    </div>
  </div>, document.body);
}

function Pagination({ page, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / MESSAGING_PAGE_SIZE));
  const current = Math.min(page, pages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-600">
      <span>{total ? `${(current - 1) * MESSAGING_PAGE_SIZE + 1}–${Math.min(current * MESSAGING_PAGE_SIZE, total)} de ${total}` : "0 registros"}</span>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange(current - 1)} disabled={current <= 1} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40">Anterior</button>
        <span>Página {current} de {pages}</span>
        <button type="button" onClick={() => onChange(current + 1)} disabled={current >= pages} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40">Siguiente</button>
      </div>
    </div>
  );
}

function MessageDetail({ delivery, imageUrl, onClose }) {
  const { authToken, logout } = useAuth();
  const [imageSource, setImageSource] = useState("");
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    if (!imageUrl) return undefined;
    let active = true;
    let objectUrl;
    apiFetch(imageUrl, { token: authToken, onUnauthorized: logout })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          if (active) setImageError(typeof payload.detail === "string" ? payload.detail : `No se pudo cargar la imagen (HTTP ${response.status}).`);
          return;
        }
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setImageSource(objectUrl);
      })
      .catch((error) => {
        if (active) setImageError(error.message === "Unauthorized" ? "La sesión expiró al cargar la imagen." : "No se pudo conectar para cargar la imagen.");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl, authToken, logout]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-detail-title"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2
              id="message-detail-title"
              className="text-xl font-bold text-[#053E68]"
            >
              Mensaje para {delivery.nombre_cliente}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {delivery.proyecto} · {lotsOf(delivery)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar mensaje"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid gap-5 overflow-y-auto p-6 md:grid-cols-[220px_1fr]">
          <div>
            {imageSource ? (
              <img
                src={imageSource}
                alt={delivery.image_is_snapshot ? "Imagen adjunta a este envío" : "Imagen de la configuración actual"}
                className="max-h-72 w-full rounded-lg border border-slate-200 bg-white object-contain"
              />
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                {imageError || (imageUrl ? "Cargando imagen…" : "No se conserva una imagen para este envío.")}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="mb-4 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p>Estado: <b>{statusOf(delivery).label}</b></p>
              <p>Destino: {delivery.telefono || "Sin teléfono registrado"}</p>
              <p>Instancia: {delivery.evolution_instance || "Sin instancia registrada"}</p>
              <p className="break-all">ID de Evolution: {delivery.evolution_message_id || "Todavía no registrado"}</p>
              {delivery.sent_at && <p>Fecha de envío: {new Date(delivery.sent_at).toLocaleString("es-GT", { timeZone: "America/Guatemala" })}</p>}
              {delivery.status === "accepted" && <p className="text-xs text-slate-500">Evolution aceptó el envío. No hay confirmación de entrega o lectura registrada.</p>}
              {delivery.error_message && <p className="text-red-700">Error: {delivery.error_message}</p>}
              {!delivery.image_is_snapshot && imageSource && <p className="text-xs text-slate-500">Imagen de la configuración actual. Este histórico no conserva una copia de la imagen enviada.</p>}
            </div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Mensaje completo
            </h3>
            <div className="min-h-48 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
              {delivery.message || "El mensaje todavía no ha sido generado."}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function MessagingQueueView() {
  const { authToken, logout, sapSources } = useAuth();
  const [runs, setRuns] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sort, setSort] = useState({ key: "", direction: "" });
  const [dateStart, setDateStart] = useState(todayInGuatemala);
  const [dateEnd, setDateEnd] = useState("");
  const [messagePage, setMessagePage] = useState(1);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [qr, setQr] = useState('');
  const [qrMessage, setQrMessage] = useState('');
  const [qrBusy, setQrBusy] = useState(false);
  const requestInFlight = useRef(false);
  const requestSequence = useRef(0);
  const { from, to, invalid: invalidRange } = messagingDateRange(dateStart, dateEnd, todayInGuatemala());

  const load = useCallback(
    async (quiet = false) => {
      if (!authToken || invalidRange || (quiet && requestInFlight.current)) return;
      const sequence = ++requestSequence.current;
      requestInFlight.current = true;
      if (!quiet) setLoading(true);
      try {
        const [runsResponse, projectsResponse] = await Promise.all([
          apiFetch(`/api/v1/cobros/reminders/runs?${new URLSearchParams({ date_from: from, date_to: to })}`, {
            token: authToken,
            onUnauthorized: logout,
          }),
          apiFetch("/api/v1/cobros/reminders/projects", {
            token: authToken,
            onUnauthorized: logout,
          }),
        ]);
        if (!runsResponse.ok || !projectsResponse.ok)
          throw new Error("No se pudieron consultar los mensajes programados.");
        const [runsPayload, configuredProjects] = await Promise.all([
          runsResponse.json(),
          projectsResponse.json(),
        ]);
        const periodRuns = listFrom(runsPayload);
        const periodDeliveries = [];
        let nextRun = 0;
        const loadDeliveries = async () => {
          while (nextRun < periodRuns.length) {
            const run = periodRuns[nextRun++];
            let offset = 0;
            while (true) {
              const response = await apiFetch(
                `/api/v1/cobros/reminders/runs/${run.id}/deliveries?limit=500&offset=${offset}`,
                { token: authToken, onUnauthorized: logout },
              );
              if (!response.ok)
                throw new Error("No se pudieron cargar las entregas del período.");
              const page = listFrom(await response.json());
              periodDeliveries.push(...page);
              if (page.length < 500) break;
              offset += page.length;
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(4, periodRuns.length) }, loadDeliveries));
        if (sequence !== requestSequence.current) return;
        periodDeliveries.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")) || Number(b.id) - Number(a.id));
        setRuns(periodRuns);
        setDeliveries(periodDeliveries);
        setProjects(
          listFrom(configuredProjects),
        );
        setError("");
      } catch (requestError) {
        if (sequence === requestSequence.current && requestError.message !== "Unauthorized") {
          if (!quiet) {
            setRuns([]);
            setDeliveries([]);
          }
          setError(
            requestError.message || "No se pudieron cargar los mensajes.",
          );
        }
      } finally {
        if (sequence === requestSequence.current) {
          requestInFlight.current = false;
          setLoading(false);
        }
      }
    },
    [authToken, logout, from, to, invalidRange],
  );

  useEffect(() => {
    load();
    const interval = to >= todayInGuatemala() ? window.setInterval(() => load(true), 5000) : null;
    return () => {
      requestSequence.current += 1;
      requestInFlight.current = false;
      if (interval) window.clearInterval(interval);
    };
  }, [load, to]);

  const imagesByProject = useMemo(
    () =>
      new Map(
        projects.map((project) => [
          keyOf(project.company_name, project.project_name),
          project.image_url,
        ]),
      ),
    [projects],
  );
  const imageUrl = selected
    ? selected.image_url ||
      (selected.project_config_id ? `/api/v1/cobros/reminders/projects/${selected.project_config_id}/image` : null) ||
      imagesByProject.get(keyOf(selected.empresa, selected.proyecto)) ||
      (selected.empresa
        ? `/api/v1/cobros/reminders/project-image?${new URLSearchParams({ company_name: selected.empresa, project_name: selected.proyecto || "" })}`
        : null)
    : null;
  const closeDetail = useCallback(() => setSelected(null), []);
  const enrichedDeliveries = useMemo(() => {
    const runsById = new Map(runs.map((run) => [String(run.id), run]));
    const projectsById = new Map(projects.map(project => [String(project.id), project]));
    return deliveries.map((delivery) => ({
      ...delivery,
      runDate: runDateOf(runsById.get(String(delivery.run_id)) || {}),
      tipo_cartera: runsById.get(String(delivery.run_id))?.tipo_cartera || "lotes",
      displayProject: runsById.get(String(delivery.run_id))?.tipo_cartera === 'edificios' ? projectsById.get(String(delivery.project_config_id))?.project_name || delivery.proyecto : delivery.proyecto,
      displayType: messagingType(delivery, runDateOf(runsById.get(String(delivery.run_id)) || {})),
    }));
  }, [deliveries, runs, projects]);
  const visibleDeliveries = useMemo(() => {
    const items = enrichedDeliveries.filter((delivery) => matchesMessagingType(delivery.displayType, typeFilter));
    return filterAndSortMessages(items, { search, status: statusFilter, project: projectFilter, source: sourceFilter, sortKey: sort.key, sortDirection: sort.direction });
  }, [enrichedDeliveries, typeFilter, search, statusFilter, projectFilter, sourceFilter, sort]);
  const projectOptions = useMemo(() => [...new Set(enrichedDeliveries.map(item => item.displayProject).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [enrichedDeliveries]);
  const statusOptions = useMemo(() => [...new Map(deliveries.map(item => { const status = statusOf(item); return [status.key, status]; })).values()], [deliveries]);
  const changeSort = key => {
    setSort(current => current.key !== key ? { key, direction: 'desc' } : current.direction === 'desc' ? { key, direction: 'asc' } : { key: '', direction: '' });
    setMessagePage(1);
  };
  const { current: messagePageNumber, items: pageDeliveries } = messagingPage(visibleDeliveries, messagePage);

  const responseError = async response => {
    const payload = await response.json().catch(() => ({}));
    return typeof payload.detail === 'string' ? payload.detail : payload.detail?.message || `Error HTTP ${response.status}`;
  };
  const cancelDelivery = async delivery => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const response = await apiFetch(`/api/v1/cobros/reminders/runs/${delivery.run_id}/deliveries/${delivery.id}/cancel`, { method: 'POST', token: authToken, onUnauthorized: logout });
      if (!response.ok) throw new Error(await responseError(response));
      setNotice('Envío cancelado. La cola continuará con el siguiente mensaje.');
      await load(true);
    } catch (requestError) {
      if (requestError.message !== 'Unauthorized') setNotice(requestError.message);
      await load(true);
    } finally { setCancelling(false); }
  };
  const cancelFiltered = async () => {
    if (cancelling) return;
    const ids = visibleDeliveries.filter(canCancel).map(item => item.id);
    if (!ids.length) return;
    setCancelling(true);
    try {
      let cancelled = 0;
      for (let offset = 0; offset < ids.length; offset += 10000) {
        const response = await apiFetch('/api/v1/cobros/reminders/deliveries/cancel', { method: 'POST', body: ids.slice(offset, offset + 10000), token: authToken, onUnauthorized: logout });
        if (!response.ok) throw new Error(await responseError(response));
        cancelled += (await response.json()).cancelled || 0;
      }
      setNotice(`${cancelled} mensaje${cancelled === 1 ? '' : 's'} cancelado${cancelled === 1 ? '' : 's'}.`);
      await load(true);
    } catch (requestError) { if (requestError.message !== 'Unauthorized') setNotice(requestError.message); }
    finally { setCancelling(false); }
  };
  const openLinking = async () => {
    setLinkOpen(true);
    setInstances([]);
    setSelectedInstance('');
    setQr('');
    try {
      const response = await apiFetch('/api/v1/cobros/reminders/instances', { token: authToken, onUnauthorized: logout });
      if (!response.ok) throw new Error(await responseError(response));
      setInstances(await response.json());
    } catch (requestError) { if (requestError.message !== 'Unauthorized') setNotice(requestError.message); }
  };
  useEffect(() => {
    if (!linkOpen || !selectedInstance) return undefined;
    let active = true;
    let inFlight = false;
    const fetchQr = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await apiFetch(`/api/v1/cobros/reminders/instances/${encodeURIComponent(selectedInstance)}/connect`, { token: authToken, onUnauthorized: logout });
        if (!response.ok) throw new Error(await responseError(response));
        const payload = await response.json();
        if (active) { setQr(payload.qr || ''); setQrMessage(payload.message || ''); }
      } catch (requestError) {
        if (active && requestError.message !== 'Unauthorized') { setQrMessage(requestError.message); setNotice(requestError.message); }
      } finally { inFlight = false; if (active) setQrBusy(false); }
    };
    setQrBusy(true);
    fetchQr();
    const timer = window.setInterval(fetchQr, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [linkOpen, selectedInstance, authToken, logout]);

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#053E68] to-[#0B5A8E] px-6 py-5 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-white/15 p-3">
            <MessageSquare className="h-6 w-6 text-[#F4CD04]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Mensajería</h2>
            <p className="mt-1 text-sm text-blue-100">
              Mensajes del período seleccionado
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
        <button type="button" onClick={openLinking} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20"><Link2 className="h-4 w-4" />Vinculación</button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && <div role="status" className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Cerrar aviso"><X className="h-4 w-4" /></button></div>}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="text-sm font-medium text-slate-700">Fecha de ejecución</span>
        <MessagingDateFilter from={from} to={to} today={todayInGuatemala()} onApply={(start, end) => { setDateStart(start); setDateEnd(end); setMessagePage(1); }} />
        <p className="text-sm text-slate-500">Selecciona un día o un rango para consultar el historial.</p>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="font-semibold text-[#053E68]">
              Mensajes programados y enviados
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Doble clic en un mensaje para ver el texto completo y la imagen.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={cancelFiltered} disabled={cancelling || !visibleDeliveries.some(canCancel)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40">Cancelar Envío</button>
            <label className="text-sm text-slate-600">
              Tipo de mensaje{" "}
              <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setMessagePage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <option value="all">Todos</option>
                <option value="collection">Cobros</option>
                <option value="reminder">Recordatorios</option>
              </select>
            </label>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {visibleDeliveries.length} registros
            </span>
          </div>
        </div>
        <div className="grid gap-3 border-b border-slate-100 px-6 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <input aria-label="Buscar por lote, cliente o código" placeholder="Buscar lote, cliente o código" value={search} onChange={event => { setSearch(event.target.value); setMessagePage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" />
          <select aria-label="Filtrar por estado" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setMessagePage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="">Todos los estados</option>{statusOptions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
          <select aria-label="Filtrar por proyecto" value={projectFilter} onChange={event => { setProjectFilter(event.target.value); setMessagePage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="">Todos los proyectos</option>{projectOptions.map(project => <option key={project} value={project}>{project}</option>)}</select>
          <select aria-label="Filtrar por cartera" value={sourceFilter} onChange={event => { setSourceFilter(event.target.value); setMessagePage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="">Todas las carteras</option>{sapSources.includes('lotes') && <option value="lotes">Lotes</option>}{sapSources.includes('edificios') && <option value="edificios">Edificios</option>}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-[2200px] min-w-full table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col className="w-[180px]" />
              <col className="w-[150px]" />
              <col className="w-[230px]" />
              <col className="w-[160px]" />
              <col className="w-[110px]" />
              <col className="w-[170px]" />
              <col className="w-[160px]" />
              <col className="w-[160px]" />
              <col className="w-[150px]" />
              <col className="w-[180px]" />
              <col className="w-[130px]" />
              <col className="w-[210px]" />
              <col className="w-[210px]" />
            </colgroup>
            <thead className="bg-[#053E68] text-white">
              <tr>
                {[["Fecha y Hora", "date"], ["Código de Cliente", "code"], ["Cliente", "client"], ["Teléfono", "phone"], ["País", "country"], ["Proyecto", "project"], ["Manzana/Lote", "lot"], ["Usuario Envío", "sender"], ["Tipo", "type"], ["Mensaje", "message"], ["Estado", "status"], ["Progreso", "progress"], ["Error", "error"]].map(
                  ([header, key]) => (
                    <th key={key} aria-sort={key === 'progress' ? undefined : sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="border-b border-r border-white/20 px-4 py-3 text-left align-middle font-semibold">
                      {key === 'progress' ? header : <button type="button" onClick={() => changeSort(key)} className="text-left">{header}{sort.key === key ? (sort.direction === 'desc' ? ' ↓' : ' ↑') : ''}</button>}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="border-slate-200 [&_td]:border-b [&_td]:border-r [&_td]:border-inherit [&_td]:align-middle">
              {invalidRange ? (
                <tr><td colSpan="13" className="px-4 py-12 text-center text-slate-500">Selecciona un rango válido.</td></tr>
              ) : loading ? (
                <tr>
                  <td
                    colSpan="13"
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    Cargando mensajes…
                  </td>
                </tr>
              ) : visibleDeliveries.length ? (
                pageDeliveries.map((delivery) => {
                  const status = statusOf(delivery);
                  return (
                    <tr key={delivery.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{displayDate(delivery)}</td>
                      <td className="px-4 py-3 text-slate-700">{delivery.codigo_cliente || "—"}</td>
                      <td
                        className="truncate px-4 py-3 font-medium text-slate-800"
                        title={delivery.nombre_cliente}
                      >
                        {delivery.nombre_cliente || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{delivery.telefono || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{messageCountry(delivery) || "—"}</td>
                      <td
                        className="truncate px-4 py-3 text-slate-700"
                        title={delivery.displayProject}
                      >
                        {delivery.displayProject || "—"}
                      </td>
                      <td
                        className="truncate px-4 py-3 text-slate-700"
                        title={lotsOf(delivery)}
                      >
                        {lotsOf(delivery)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{messageSender(delivery) || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {messageTypeLabel(delivery.displayType)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onDoubleClick={() => setSelected(delivery)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelected(delivery);
                            }
                          }}
                          title="Doble clic para ver el mensaje completo"
                          className="block w-full truncate rounded py-1 text-left text-slate-700 hover:bg-blue-50 hover:text-[#053E68]"
                        >
                          {delivery.message || "Mensaje aún no generado"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3"><DeliveryProgress delivery={delivery} onCancel={cancelDelivery} cancelling={cancelling} /></td>
                      <td className="min-w-48 whitespace-pre-wrap break-words px-4 py-3 text-red-700">{delivery.error_message || ""}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="13"
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    {deliveries.length && (typeFilter !== "all" || search || statusFilter || projectFilter || sourceFilter)
                      ? "No hay mensajes que coincidan con los filtros."
                      : runs.length
                      ? "No hay mensajes registrados para estas ejecuciones."
                      : "No hay mensajes para el período seleccionado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!invalidRange && !loading && <Pagination page={messagePageNumber} total={visibleDeliveries.length} onChange={setMessagePage} />}
      </section>
      {selected && (
        <MessageDetail
          key={`${selected.id}:${imageUrl}`}
          delivery={selected}
          imageUrl={imageUrl}
          onClose={closeDetail}
        />
      )}
      {linkOpen && <InstanceLinkModal instances={instances} selected={selectedInstance} qr={qr} message={qrMessage} busy={qrBusy} onSelect={name => { setSelectedInstance(name); setQr(''); setQrMessage(''); }} onClose={() => setLinkOpen(false)} />}
    </div>
  );
}

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Phone,
  Send,
  WalletCards,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useArea } from "../context/AreaContext.jsx";
import {
  campaignDebtColumns,
  groupOverdueInstallments,
} from "../utils/overdueInstallments.js";
import { portfolioClientId } from "../utils/accessScopes.js";
import { portfolioCurrency, formatPortfolioMoney } from "../utils/portfolioMoney.js";

const value = (source, keys, fallback = "") => {
  for (const key of keys) {
    const found = source?.[key];
    if (found !== undefined && found !== null && found !== "") return found;
  }
  return fallback;
};

const amount = (source, keys) => Number(value(source, keys, 0)) || 0;
const searchable = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const guatemalaToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  );
};

const daysUntilPayment = (dueDate) => {
  const match = String(dueDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const dueAt = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Math.round((dueAt - guatemalaToday()) / 86_400_000);
};

const normalizeClients = (payload) => {
  const clients = Array.isArray(payload)
    ? payload
    : payload?.clientes ||
      payload?.items ||
      payload?.results ||
      payload?.data ||
      [];

  return clients.map((client, clientIndex) => {
    const lots = value(client, ["lotes", "proyectos_lotes", "projects"], []);
    const normalizedLots = Array.isArray(lots)
      ? lots.map((lot, lotIndex) => {
          const installments = groupOverdueInstallments(
            value(lot, ["cuotas_atrasadas", "cuotas", "installments"], []),
          );
          return {
            id: String(
              value(lot, ["id", "lote_id", "lote", "codigo_lote"], lotIndex),
            ),
            project: value(
              lot,
              ["proyecto", "nombre_proyecto", "project"],
              "Proyecto sin nombre",
            ),
            lot: value(
              lot,
              ["lote", "nombre_lote", "codigo_lote"],
              "Lote sin nombre",
            ),
            overdueInstallments: installments.length,
            pendingTotal: amount(lot, [
              "total_pendiente_lote",
              "total_pendiente",
              "subtotal",
            ]),
            installments,
          };
        })
      : [];
    return {
      source: client.tipo_cartera || 'lotes',
      currency: portfolioCurrency(client),
      id: portfolioClientId(client, clientIndex),
      name: value(
        client,
        ["nombre_cliente", "cliente", "nombre", "name"],
        "Cliente sin nombre",
      ),
      company: value(client, ["empresa", "company"]),
      code: value(client, ["codigo_cliente", "client_code"]),
      phone: value(
        client,
        ["telefono_principal", "telefono", "phone"],
        "Sin teléfono",
      ),
      overdueInstallments: normalizedLots.reduce(
        (total, lot) => total + lot.overdueInstallments,
        0,
      ),
      pendingTotal: amount(client, ["total_pendiente", "saldo_total"]),
      lots: normalizedLots,
    };
  });
};

function messageFor(response, detail) {
  if (response.status === 403)
    return "No tiene permisos para consultar la cartera vencida.";
  if (response.status === 503)
    return "La cartera externa no está disponible. Intente actualizar más tarde.";
  return detail || `No se pudo cargar la cartera vencida (${response.status}).`;
}

function messageSelectionsFor(clients, selectedClientIds, projectFilter) {
  const selectionsByKey = new Map();

  clients
    .filter((client) => selectedClientIds.has(client.id))
    .forEach((client) => {
      client.lots
        .filter((lot) => !projectFilter || lot.project === projectFilter)
        .forEach((lot) => {
          if (!client.company || !lot.project || (!client.code && !client.name)) return;
          const selection = {
            company_name: client.company,
            project_name: lot.project,
            ...(client.code ? { customer_code: client.code } : { customer_name: client.name }),
          };
          selectionsByKey.set(`${client.company}:${client.code || client.name}:${lot.project}`, selection);
        });
    });

  return [...selectionsByKey.values()];
}

export default function OverduePortfolioView() {
  const { authToken, logout, isSystem, areaId, sapSources } = useAuth();
  const { areas } = useArea();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [expandedLots, setExpandedLots] = useState(new Set());
  const [selectedClientIds, setSelectedClientIds] = useState(new Set());
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [subareas, setSubareas] = useState([]);
  const [selectedSubareaId, setSelectedSubareaId] = useState("");
  const [creating, setCreating] = useState(false);
  const [campaignError, setCampaignError] = useState("");
  const [messageSelection, setMessageSelection] = useState(null);
  const [sendingMessages, setSendingMessages] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [messageSuccess, setMessageSuccess] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [portfolioFilter, setPortfolioFilter] = useState('todo');
  const selectAllRef = useRef(null);
  const loadSequence = useRef(0);

  const load = useCallback(async (idsToPreserve = null) => {
    if (!authToken) return;
    const preserveSelection = idsToPreserve instanceof Set;
    const previousSelectedIds = preserveSelection
      ? new Set(idsToPreserve)
      : new Set();
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    setClients([]);
    if (!preserveSelection) setSelectedClientIds(new Set());
    try {
      const response = await apiFetch(`/api/v1/cobros/cartera-vencida?tipo=${portfolioFilter}`, {
        token: authToken,
        onUnauthorized: logout,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          messageFor(
            response,
            typeof body.detail === "string" ? body.detail : "",
          ),
        );
      }
      const payload = await response.json();
      if (sequence !== loadSequence.current) return;
      const refreshedClients = normalizeClients(payload);
      const availableClientIds = new Set(refreshedClients.map((client) => client.id));
      const retainedClientIds = new Set(
        [...previousSelectedIds].filter((id) => availableClientIds.has(id)),
      );
      setClients(refreshedClients);
      setExpandedClients(new Set());
      setExpandedLots(new Set());
      setSelectedClientIds(retainedClientIds);
      return {
        clients: refreshedClients,
        selectedClientIds: retainedClientIds,
        removedCount: previousSelectedIds.size - retainedClientIds.size,
      };
    } catch (loadError) {
      if (sequence === loadSequence.current && loadError.message !== "Unauthorized")
        setError(loadError.message || "No se pudo cargar la cartera vencida.");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [authToken, logout, portfolioFilter]);

  useEffect(() => {
    load();
    return () => { loadSequence.current += 1; };
  }, [load]);

  const selectedClients = clients.filter((client) =>
    selectedClientIds.has(client.id),
  );
  const projectOptions = useMemo(
    () =>
      [
        ...new Set(
          clients
            .flatMap((client) => client.lots.map((lot) => lot.project))
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "es-GT")),
    [clients],
  );
  const visibleClients = useMemo(() => {
    const query = searchable(clientQuery.trim());
    return clients.filter((client) => {
      const matchesText =
        !query ||
        [client.name, client.phone, client.code].some((item) =>
          searchable(item).includes(query),
        );
      const matchesProject =
        !projectFilter ||
        client.lots.some((lot) => lot.project === projectFilter);
      const matchesPaymentStatus =
        paymentFilter === "all" ||
        client.lots.some((lot) =>
          lot.installments.some((installment) => {
            const days = daysUntilPayment(installment.dueDate);
            return paymentFilter === "upcoming"
              ? days !== null && days >= 0 && days <= 3
              : days !== null && days < 0;
          }),
        );
      return matchesText && matchesProject && matchesPaymentStatus;
    });
  }, [clients, clientQuery, projectFilter, paymentFilter]);
  const allVisibleSelected =
    visibleClients.length > 0 &&
    visibleClients.every((client) => selectedClientIds.has(client.id));
  const someVisibleSelected = visibleClients.some((client) =>
    selectedClientIds.has(client.id),
  );

  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate =
        someVisibleSelected && !allVisibleSelected;
  }, [someVisibleSelected, allVisibleSelected]);
  const cobrosArea = areas.find(
    (area) =>
      String(area.area || "")
        .trim()
        .toLowerCase() === "cobros",
  );
  const campaignAreaId = isSystem ? cobrosArea?.id : areaId;

  useEffect(() => {
    if (!showCampaignForm) return;
    const loadFormOptions = async () => {
      try {
        const [projectsResponse, subareasResponse] = await Promise.all([
          apiFetch("/api/v1/projects", {
            token: authToken,
            onUnauthorized: logout,
          }),
          apiFetch("/api/v1/subareas", {
            token: authToken,
            onUnauthorized: logout,
          }),
        ]);
        if (projectsResponse.ok) {
          const payload = await projectsResponse.json();
          const availableProjects = Array.isArray(payload)
            ? payload
            : payload.items || payload.results || [];
          setProjects(availableProjects);
          const activeClients = clients.filter((client) =>
            selectedClientIds.has(client.id),
          );
          const projectNames = new Set(
            activeClients.flatMap((client) =>
              client.lots.map((lot) => lot.project),
            ),
          );
          if (projectNames.size === 1) {
            const matchingProject = availableProjects.find(
              (project) => project.name === [...projectNames][0],
            );
            if (matchingProject)
              setSelectedProjectId(String(matchingProject.id));
          }
        }
        if (subareasResponse.ok) {
          const payload = await subareasResponse.json();
          setSubareas(Array.isArray(payload) ? payload : []);
        }
      } catch (formError) {
        if (formError.message !== "Unauthorized")
          setCampaignError("No se pudieron cargar las opciones de la campaña.");
      }
    };
    loadFormOptions();
  }, [showCampaignForm, authToken, logout, clients, selectedClientIds]);

  const toggle = (setter, id) =>
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleClient = (clientId) => toggle(setSelectedClientIds, clientId);
  const toggleVisibleClients = () =>
    setSelectedClientIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected)
        visibleClients.forEach((client) => next.delete(client.id));
      else visibleClients.forEach((client) => next.add(client.id));
      return next;
    });
  const selectedAreaSubareas = subareas.filter(
    (subarea) =>
      String(subarea.area || "")
        .trim()
        .toLowerCase() === "cobros",
  );
  const campaignAreaHasSubareas = isSystem
    ? Boolean(cobrosArea?.subareas)
    : selectedAreaSubareas.length > 0;

  const openCampaignForm = () => {
    setCampaignError("");
    setCampaignName("");
    setSelectedProjectId("");
    setSelectedSubareaId("");
    setShowCampaignForm(true);
  };

  const createCampaign = async () => {
    if (selectedClients.some(client => client.currency === 'USD')) {
      setCampaignError('Las campañas de cobros actuales trabajan en quetzales. No se pueden incluir registros en dólares de Edificios.');
      return;
    }
    if (!campaignName.trim()) {
      setCampaignError("Ingrese un nombre para la campaña.");
      return;
    }
    if (!selectedProjectId) {
      setCampaignError("Seleccione el proyecto asociado.");
      return;
    }
    if (!campaignAreaId) {
      setCampaignError(
        "No se encontró el área de Cobros para crear la campaña.",
      );
      return;
    }
    if (campaignAreaHasSubareas && !selectedSubareaId) {
      setCampaignError("Seleccione una subárea de Cobros.");
      return;
    }

    // El endpoint de carga valida los encabezados de la primera fila. Usamos una
    // matriz para conservar exactamente los nombres y el orden que espera.
    const campaignHeaders = [
      "Lote",
      "Cliente",
      "Tel",
      "Mes 1",
      "Mes 2",
      "Mes 3",
      "TOTAL",
    ];
    const rows = selectedClients.flatMap((client) =>
      client.lots.map((lot) => {
        const debt = campaignDebtColumns(lot);
        return [
          lot.lot,
          client.name,
          client.phone === "Sin teléfono" ? "" : client.phone,
          debt["Mes 1"],
          debt["Mes 2"],
          debt["Mes 3"],
          debt.TOTAL,
        ];
      }),
    );
    if (!rows.length) {
      setCampaignError(
        "Los clientes seleccionados no tienen lotes vencidos para incluir.",
      );
      return;
    }

    setCreating(true);
    setCampaignError("");
    try {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([campaignHeaders, ...rows]),
        "Contactos",
      );
      const file = new File(
        [XLSX.write(workbook, { bookType: "xlsx", type: "array" })],
        "contactos-sap.xlsx",
        {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      );
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaign_name", campaignName.trim());
      formData.append("project_id", selectedProjectId);
      formData.append("area_id", String(campaignAreaId));
      if (campaignAreaHasSubareas)
        formData.append("subarea_id", selectedSubareaId);

      const response = await apiFetch("/api/v1/campaigns/upload", {
        method: "POST",
        token: authToken,
        onUnauthorized: logout,
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof payload.detail === "string"
            ? payload.detail
            : "No se pudo crear la campaña.",
        );
      navigate("/campaigns");
    } catch (createError) {
      if (createError.message !== "Unauthorized")
        setCampaignError(createError.message || "No se pudo crear la campaña.");
    } finally {
      setCreating(false);
    }
  };

  const prepareMessageSend = () => {
    if (!selectedClients.length) return;
    if (selectedClients.some(client => client.source === 'edificios')) {
      setMessageError('El envío de mensajes desde esta pantalla está disponible para Lotes. Selecciona registros de Lotes para continuar.');
      return;
    }
    setMessageError("");
    setMessageSuccess("");
    const selections = messageSelectionsFor(
      clients,
      selectedClientIds,
      projectFilter,
    );
    if (!selections.length) {
      setMessageError("Los clientes seleccionados no tienen empresa, proyecto o identificación suficientes para preparar el cobro.");
      return;
    }
    setMessageSelection({ ready: selections });
  };

  const sendSelectedMessages = async () => {
    if (!messageSelection?.ready?.length || sendingMessages) return;
    setSendingMessages(true);
    setMessageError("");
    try {
      const response = await apiFetch("/api/v1/cobros/reminders/send", {
        method: "POST",
        token: authToken,
        onUnauthorized: logout,
        body: { collection_selections: messageSelection.ready },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = payload.detail;
        const code = typeof detail === "object" ? detail?.code : detail;
        if (code === "collection_candidates_changed") {
          const refreshed = await load(selectedClientIds);
          const refreshedSelections = refreshed
            ? messageSelectionsFor(
                refreshed.clients,
                refreshed.selectedClientIds,
                projectFilter,
              )
            : [];

          if (!refreshedSelections.length) {
            setMessageSelection(null);
            setMessageError(
              "La cartera cambió. No se enviarán mensajes porque ninguno de los clientes seleccionados cuenta con cuotas atrasadas en este momento.",
            );
            return;
          }

          setMessageSelection({
            ready: refreshedSelections,
            notice: refreshed.removedCount > 0
              ? "Algunos clientes no recibirán mensajes porque ya no cuentan con cuotas atrasadas."
              : "",
          });
          return;
        }
        if (code === "selected_reminders_not_ready") {
          const unavailable = detail?.unavailable || detail?.not_ready || detail?.reminders || [];
          const reasons = Array.isArray(unavailable)
            ? unavailable.map((item) => [
                item.customer_name || item.customer_code || item.name || "Cliente",
                item.unavailable_reason || item.reason || item.detail,
              ].filter(Boolean).join(": ")).filter(Boolean)
            : [];
          throw new Error(
            reasons.length
              ? `No se pueden enviar algunos mensajes: ${reasons.join(". ")}`
              : detail?.message || "Algunos clientes no tienen teléfono válido o una configuración activa de imagen e instancia.",
          );
        }
        throw new Error(
          typeof detail === "string"
            ? detail
            : detail?.message || payload.message || "No se pudieron encolar los mensajes.",
        );
      }
      const count =
        payload.selected_count ??
        payload.queued_count ??
        messageSelection.ready.length;
      setMessageSuccess(
        `${count} mensaje${count === 1 ? "" : "s"} encolado${count === 1 ? "" : "s"} para envío.`,
      );
      setMessageSelection(null);
      setSelectedClientIds(new Set());
    } catch (requestError) {
      if (requestError.message !== "Unauthorized")
        setMessageError(
          requestError.message || "No se pudieron encolar los mensajes.",
        );
    } finally {
      setSendingMessages(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      <section className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#053E68]">Consulta SAP</h2>
            <p className="text-sm text-gray-500 mt-1">
              {loading
                ? "Consultando cartera externa..."
                : `${visibleClients.length} de ${clients.length} ${clients.length === 1 ? "cliente con saldo vencido" : "clientes con saldo vencido"}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => load(selectedClientIds)}
              disabled={loading || sendingMessages}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Actualizar
            </button>
            <button
              onClick={openCampaignForm}
              disabled={
                loading || selectedClientIds.size === 0 || sendingMessages
              }
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#053E68] text-white text-sm font-medium hover:bg-[#06497c] disabled:opacity-50"
            >
              <WalletCards className="w-4 h-4" />
              Crear Campaña
              {selectedClientIds.size ? ` (${selectedClientIds.size})` : ""}
            </button>
            <button
              onClick={prepareMessageSend}
              disabled={
                loading || selectedClientIds.size === 0 || sendingMessages
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B5A8E] px-4 py-2 text-sm font-medium text-white hover:bg-[#053E68] disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Enviar Mensaje
              {selectedClientIds.size ? ` (${selectedClientIds.size})` : ""}
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {messageError && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {messageError}
          </p>
        )}
        {messageSuccess && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {messageSuccess}
          </p>
        )}
        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <label className="text-sm font-medium text-gray-700">Cartera<select value={portfolioFilter} onChange={event => { setPortfolioFilter(event.target.value); setSelectedClientIds(new Set()); setProjectFilter(''); }} disabled={loading || sendingMessages} className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#053E68]"><option value="todo">Todo</option>{sapSources.includes('lotes') && <option value="lotes">Lotes</option>}{sapSources.includes('edificios') && <option value="edificios">Edificios</option>}</select></label>
          <label className="text-sm font-medium text-gray-700">
            Buscar cliente o número
            <input
              type="search"
              value={clientQuery}
              onChange={(event) => setClientQuery(event.target.value)}
              placeholder="Nombre, teléfono o código"
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-[#053E68]"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Proyecto
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#053E68]"
            >
              <option value="">Todos los proyectos</option>
              {projectOptions.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Estado de pago
            <select
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#053E68]"
            >
              <option value="all">Todos</option>
              <option value="upcoming">Por Vencer</option>
              <option value="overdue">Vencidos</option>
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <section className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          Cargando cartera vencida...
        </section>
      ) : !error && clients.length === 0 ? (
        <section className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">
          No hay saldos vencidos para mostrar.
        </section>
      ) : (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#053E68] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleClients}
                      disabled={visibleClients.length === 0}
                      aria-label={
                        allVisibleSelected
                          ? "Deseleccionar todos los registros visibles"
                          : "Seleccionar todos los registros visibles"
                      }
                      className="h-4 w-4 accent-[#053E68] disabled:cursor-not-allowed"
                    />
                  </th>
                  {[
                    "Cliente",
                    "Teléfono principal",
                    "Cuotas atrasadas",
                    "Total pendiente",
                    "",
                  ].map((header, index) => (
                    <th
                      key={`${header}-${index}`}
                      className="px-4 py-3 font-semibold whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleClients.map((client) => {
                  const clientExpanded = expandedClients.has(client.id);
                  return (
                    <Fragment key={client.id}>
                      <tr key={client.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedClientIds.has(client.id)}
                            onChange={() => toggleClient(client.id)}
                            aria-label={`Seleccionar ${client.name}`}
                            className="h-4 w-4 accent-[#053E68]"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-[#053E68]">
                            {client.name}
                          </p>
                          <span className="text-xs text-[#0B5F8F]">{client.source === 'edificios' ? 'Edificios' : 'Lotes'}</span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[client.company, client.code]
                              .filter(Boolean)
                              .join(" · ") || "Sin empresa o código registrado"}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="w-4 h-4 text-gray-400" />
                            {client.phone}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-center">
                          {client.overdueInstallments}
                        </td>
                        <td className="px-4 py-4 font-semibold text-[#053E68] whitespace-nowrap">
                          {formatPortfolioMoney(client.pendingTotal, client.currency)}
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() =>
                              toggle(setExpandedClients, client.id)
                            }
                            aria-label={`Ver unidades de ${client.name}`}
                            className="p-1.5 rounded hover:bg-[#053E68]/10 text-[#053E68]"
                          >
                            {clientExpanded ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {clientExpanded && (
                        <tr key={`${client.id}-lots`}>
                          <td colSpan="6" className="p-4 bg-gray-50">
                            <div className="space-y-3">
                              {client.lots.map((lot) => {
                                const lotId = JSON.stringify([client.id, lot.project, lot.id]);
                                const lotExpanded = expandedLots.has(lotId);
                                return (
                                  <div
                                    key={lotId}
                                    className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                                  >
                                    <button
                                      onClick={() =>
                                        toggle(setExpandedLots, lotId)
                                      }
                                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
                                    >
                                      {lotExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-[#053E68] shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-[#053E68] shrink-0" />
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium text-gray-800">
                                          {lot.project}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                          {lot.lot}
                                        </p>
                                      </div>
                                      <div className="hidden sm:grid grid-cols-2 gap-x-6 text-sm shrink-0">
                                        <span className="text-gray-500">
                                          Cuotas atrasadas
                                        </span>
                                        <span className="font-medium text-right">
                                          {lot.overdueInstallments}
                                        </span>
                                        <span className="text-gray-500">
                                          Pendiente
                                        </span>
                                        <span className="font-semibold text-right text-[#053E68]">
                                          {formatPortfolioMoney(lot.pendingTotal, client.currency)}
                                        </span>
                                      </div>
                                    </button>
                                    {lotExpanded && (
                                      <div className="overflow-x-auto border-t border-gray-100">
                                        <table className="w-full text-sm text-left">
                                          <thead className="bg-[#053E68] text-white">
                                            <tr>
                                              {[
                                                "Cuota",
                                                "Concepto",
                                                "Fecha compromiso",
                                                "Antigüedad",
                                                "Total a pagar",
                                              ].map((header) => (
                                                <th
                                                  key={header}
                                                  className="px-4 py-3 font-semibold whitespace-nowrap"
                                                >
                                                  {header}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                            {lot.installments.length ? (
                                              lot.installments.map(
                                                (installment) => (
                                                  <tr key={installment.key}>
                                                    <td className="px-4 py-3">
                                                      {installment.number}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                      {installment.concept}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                      {installment.dueDate ||
                                                        "—"}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                      {installment.age}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                                                      {formatPortfolioMoney(installment.total, client.currency)}
                                                    </td>
                                                  </tr>
                                                ),
                                              )
                                            ) : (
                                              <tr>
                                                <td
                                                  colSpan="5"
                                                  className="px-4 py-7 text-center text-gray-400"
                                                >
                                                  No hay cuotas vencidas para
                                                  esta unidad.
                                                </td>
                                              </tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {!client.lots.length && (
                                <p className="py-4 text-center text-sm text-gray-400">
                                  No hay unidades con saldo pendiente para este cliente.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {visibleClients.length === 0 && (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-4 py-12 text-center text-gray-500"
                    >
                      No hay clientes que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {showCampaignForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#053E68]/30 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-title"
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 id="campaign-title" className="font-bold text-[#053E68]">
                  Crear campaña de Cobros
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedClients.length} clientes seleccionados
                </p>
              </div>
              <button
                onClick={() => !creating && setShowCampaignForm(false)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <label className="block text-sm font-medium text-gray-700">
                Nombre de la campaña
                <input
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  disabled={creating}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:border-[#053E68]"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Proyecto asociado
                <select
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  disabled={creating}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus:border-[#053E68]"
                >
                  <option value="">Seleccione un proyecto</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              {campaignAreaHasSubareas && (
                <label className="block text-sm font-medium text-gray-700">
                  Subárea
                  <select
                    value={selectedSubareaId}
                    onChange={(event) =>
                      setSelectedSubareaId(event.target.value)
                    }
                    disabled={creating}
                    className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 focus:outline-none focus:border-[#053E68]"
                  >
                    <option value="">Seleccione una subárea</option>
                    {selectedAreaSubareas.map((subarea) => (
                      <option key={subarea.id} value={subarea.id}>
                        {subarea.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {campaignError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {campaignError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setShowCampaignForm(false)}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={createCampaign}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-[#053E68] px-4 py-2 text-sm font-medium text-white hover:bg-[#06497c] disabled:opacity-50"
              >
                {creating && <RefreshCw className="w-4 h-4 animate-spin" />}
                {creating ? "Creando..." : "Crear Campaña"}
              </button>
            </div>
          </div>
        </div>
      )}
      {messageSelection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#053E68]/30 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-message-title"
            className="w-full max-w-md rounded-xl bg-white shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3
                  id="send-message-title"
                  className="font-bold text-[#053E68]"
                >
                  ¿Enviar mensajes?
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Se enviarán recordatorios reales por WhatsApp.
                </p>
              </div>
              <button
                disabled={sendingMessages}
                onClick={() => setMessageSelection(null)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 p-6 text-sm text-slate-600">
              <p>
                <b className="text-slate-800">
                  {messageSelection.ready.length}
                </b>{" "}
                mensajes listos para encolar.
              </p>
              {messageSelection.notice && (
                <p className="rounded-lg bg-amber-50 p-3 text-amber-800">
                  {messageSelection.notice}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                disabled={sendingMessages}
                onClick={() => setMessageSelection(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancelar
              </button>
              <button
                disabled={sendingMessages}
                onClick={sendSelectedMessages}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0B5A8E] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sendingMessages ? "Encolando…" : "Sí, enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

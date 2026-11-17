import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileDown, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';
import { downloadBuildingStatement } from '../utils/buildingStatementPdf.js';
import { buildingCompanyKey, buildingProjectsByCompany } from '../utils/buildingProjectMatch.js';

const URL = '/api/v1/cobros/building-statements';

export default function BuildingStatementModal({ onClose }) {
  const { authToken, logout } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState('');
  const [error, setError] = useState('');
  const [sapInfo, setSapInfo] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch(`${URL}/clients`, { token: authToken, onUnauthorized: logout }).then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail?.message || body.detail || 'No se pudieron cargar los clientes de edificios.');
        return body.clients || [];
      }),
      apiFetch('/api/v1/cobros/reminders/projects', { token: authToken, onUnauthorized: logout })
        .then((response) => response.ok ? response.json() : [])
        .catch(() => []),
    ])
      .then(([items, configs]) => {
        const projects = buildingProjectsByCompany(configs);
        if (active) setClients(items.map((client) => ({
          ...client,
          building_name: projects.get(buildingCompanyKey(client.project)) || client.project,
        })));
      })
      .catch((requestError) => {
        if (active && requestError.message !== 'Unauthorized') setError(requestError.message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authToken, logout]);

  const generate = async (client) => {
    setError('');
    setGenerating(`${client.project}:${client.customer_code}`);
    try {
      const query = new URLSearchParams({ project: client.project, customer_code: client.customer_code });
      const response = await apiFetch(`${URL}?${query}`, { token: authToken, onUnauthorized: logout });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail?.message || body.detail || 'No se pudo consultar el estado de cuenta.');
      setSapInfo(body);
      await downloadBuildingStatement({
        ...body,
        issuer: { ...body.issuer, company: client.project },
        customer: { ...body.customer, project: client.building_name },
      });
    } catch (requestError) {
      if (requestError.message !== 'Unauthorized') setError(requestError.message);
    } finally {
      setGenerating('');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <section role="dialog" aria-modal="true" aria-label="Generar Estado de Cuenta" className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-gray-200 p-5">
          <div>
            <h3 className="text-xl font-bold text-[#053E68]">Generar Estado de Cuenta</h3>
            <p className="mt-1 text-sm text-gray-600">Primeros 20 clientes de edificios, ordenados por nombre.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="!p-2 text-gray-600 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </header>
        <div className="overflow-y-auto p-5">
          {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {sapInfo && <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p><b>Campos de SAP:</b> No. recibo {sapInfo.sap_fields?.receipt_number ? 'disponible' : 'no disponible'}; fecha de pago {sapInfo.sap_fields?.payment_date ? 'disponible' : 'no disponible'}; no. contrato {sapInfo.sap_fields?.contract_number ? 'disponible' : 'no disponible'}.</p>
            <details className="mt-2"><summary className="cursor-pointer font-medium">Ver columnas recibidas del procedimiento</summary><p className="mt-1 break-all text-xs">{sapInfo.sap_columns?.join(', ') || 'Sin columnas'}</p></details>
          </div>}
          {loading ? <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin" /></div> :
            clients.length === 0 ? <p className="p-8 text-center text-gray-600">No se encontraron clientes de edificios en SAP.</p> :
              <div className="space-y-2">{clients.map((client) => {
                const key = `${client.project}:${client.customer_code}`;
                return <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{client.customer_name}</p>
                    <p className="text-sm text-gray-600">{client.customer_code} · {client.project} · {client.building_name} · {client.units.join(', ') || 'Sin unidad'}</p>
                  </div>
                  <button type="button" disabled={Boolean(generating)} onClick={() => generate(client)} className="inline-flex items-center gap-2 rounded-lg bg-[#053E68] px-3 py-2 text-sm font-medium text-white hover:bg-[#06497c] disabled:opacity-50">
                    {generating === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    Descargar PDF
                  </button>
                </div>;
              })}</div>}
        </div>
        <p className="border-t border-gray-200 px-5 py-3 text-xs text-gray-500">El PDF usa datos consultados en SAP. Los números de recibo se muestran únicamente si SAP los proporciona.</p>
      </section>
    </div>,
    document.body,
  );
}

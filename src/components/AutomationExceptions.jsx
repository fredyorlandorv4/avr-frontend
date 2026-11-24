import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AutomationExceptions() {
  const { authToken, logout } = useAuth();
  const [clients, setClients] = useState([]);
  const [sources, setSources] = useState([]);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('todo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiFetch('/api/v1/cobros/automation/exceptions', { token: authToken, onUnauthorized: logout })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : data.detail?.message || 'No se pudo consultar la cartera SAP.');
        if (active) {
          setClients(data.clients);
          setSources(data.sources);
          setSource('todo');
        }
      })
      .catch((err) => { if (active && err.message !== 'Unauthorized') setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authToken, logout, attempt]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return clients.filter((client) =>
      (source === 'todo' || client.source === source) &&
      [client.name, client.project, client.phone].some((value) => (value || '').toLocaleLowerCase('es').includes(term))
    );
  }, [clients, query, source]);

  const toggle = async (client) => {
    setPending((current) => ({ ...current, [client.key]: true }));
    setError('');
    try {
      const response = await apiFetch(`/api/v1/cobros/automation/exceptions/${client.key}`, {
        method: 'PUT', token: authToken, onUnauthorized: logout,
        body: { source: client.source, enabled: !client.enabled },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'No se pudo guardar la excepción.');
      setClients((current) => current.map((item) => item.key === client.key ? { ...item, enabled: data.enabled } : item));
    } catch (err) {
      if (err.message !== 'Unauthorized') setError(err.message);
    } finally {
      setPending((current) => ({ ...current, [client.key]: false }));
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end gap-4 border-b border-slate-100 p-6">
        <label className="min-w-64 flex-1 text-sm font-medium text-slate-700">
          Buscar cliente
          <span className="relative mt-2 block">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre, proyecto o teléfono"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#0B5A8E]" />
          </span>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Cartera
          <select value={source} onChange={(event) => setSource(event.target.value)}
            className="mt-2 block rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
            <option value="todo">Todas las autorizadas</option>
            {sources.includes('lotes') && <option value="lotes">Lotes</option>}
            {sources.includes('edificios') && <option value="edificios">Edificios</option>}
          </select>
        </label>
        <button type="button" onClick={() => setAttempt((value) => value + 1)} disabled={loading}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium disabled:opacity-50">
          Actualizar
        </button>
      </div>
      {error && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" aria-label="Cargando clientes" /></div> :
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>{['Nombre', 'Proyecto', 'Teléfono', 'Excepción'].map((label) => <th key={label} scope="col" className="px-6 py-3">{label}</th>)}</tr>
            </thead>
            <tbody>
              {visible.map((client) => <tr key={client.key} className="border-b border-slate-100 last:border-0">
                <td className="px-6 py-4 font-medium">{client.name}<span className="block text-xs text-slate-500">{client.source === 'lotes' ? 'Lotes' : 'Edificios'}</span></td>
                <td className="px-6 py-4">{client.project || '—'}</td>
                <td className="px-6 py-4">{client.phone || '—'}</td>
                <td className="px-6 py-4"><input type="checkbox" checked={client.enabled} disabled={Boolean(pending[client.key])}
                  onChange={() => toggle(client)} aria-label={`Excepción de ${client.name}, ${client.project}`} className="h-4 w-4 accent-[#0B5A8E]" /></td>
              </tr>)}
            </tbody>
          </table>
          {!visible.length && !error && <p className="p-10 text-center text-sm text-slate-500">No se encontraron clientes.</p>}
        </div>}
    </section>
  );
}

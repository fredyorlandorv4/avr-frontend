import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import PromptEditor from './PromptEditor.jsx';

const th = { padding: '10px 12px', fontWeight: 600, fontSize: 13, textAlign: 'left', borderBottom: '1px solid #e0e0e0' };
const td = { padding: '10px 12px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid #f0f0f0' };
const btnSecondary = {
  marginRight: 6, padding: '4px 10px', fontSize: 12,
  background: 'transparent', border: '1px solid #ddd',
  borderRadius: 4, cursor: 'pointer',
};

export default function PromptsView() {
  const [prompts,  setPrompts]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(null);   // id del prompt en edición (null = lista)
  const [error,    setError]    = useState('');

  const load = () => {
    setLoading(true);
    apiFetch('/api/v1/prompts/')
      .then(data => setPrompts(Array.isArray(data) ? data : (data.items || data.results || data.data || [])))
      .catch(() => setError('Error al cargar los prompts.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Eliminar el prompt "${name}"?`)) return;
    try {
      await apiFetch(`/api/v1/prompts/${id}`, { method: 'DELETE' });
      load();
    } catch {
      setError('Error al eliminar el prompt.');
    }
  };

  const handleToggleActive = async (p) => {
    try {
      await apiFetch(`/api/v1/prompts/${p.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ active: !p.active }),
      });
      load();
    } catch {
      setError('Error al cambiar el estado del prompt.');
    }
  };

  if (editing !== null) return (
    <div style={{ padding: 24 }}>
      <PromptEditor
        promptId={editing === 'new' ? null : editing}
        onSaved={() => { setEditing(null); load(); }}
        onCancel={() => setEditing(null)}
      />
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Prompts de agentes</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
            Gestiona los templates de prompts para los agentes de voz
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          style={{
            padding: '8px 16px', background: '#0055cc',
            color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
          }}
        >
          + Nuevo prompt
        </button>
      </div>

      {error && (
        <div style={{ background: '#fff0f0', border: '1px solid #ffaaaa',
          borderRadius: 4, padding: '8px 12px', color: '#cc0000', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#888', fontSize: 13 }}>Cargando prompts...</p>
      ) : prompts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          <p style={{ fontSize: 15, margin: 0 }}>No hay prompts configurados</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Crea el primero con el botón de arriba</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <thead style={{ background: '#f5f5f5' }}>
              <tr>
                <th style={th}>Nombre</th>
                <th style={th}>Tipo (agent_type)</th>
                <th style={th}>Versión</th>
                <th style={th}>Estado</th>
                <th style={th}>Última edición</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {prompts.map(p => (
                <tr key={p.id} style={{ transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ ...td, fontWeight: 500 }}>{p.name}</td>
                  <td style={td}><code style={{ fontSize: 12, background: '#f0f0f0', padding: '2px 6px', borderRadius: 3 }}>{p.agent_type}</code></td>
                  <td style={td}>v{p.version}</td>
                  <td style={td}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: 12,
                      background: p.active ? '#e6f4ea' : '#fce8e6',
                      color:      p.active ? '#137333' : '#c5221f',
                    }}>
                      {p.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ ...td, color: '#888' }}>
                    {p.updated_at
                      ? new Date(p.updated_at).toLocaleDateString('es-GT')
                      : '—'}
                  </td>
                  <td style={td}>
                    <button onClick={() => setEditing(p.id)} style={btnSecondary}>
                      Editar
                    </button>
                    <button onClick={() => handleToggleActive(p)} style={btnSecondary}>
                      {p.active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      style={{ ...btnSecondary, color: '#c5221f', borderColor: '#f4b8b8' }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

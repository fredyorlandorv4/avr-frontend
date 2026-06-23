import { useAuth } from '../context/AuthContext.jsx';
import { useArea } from '../context/AreaContext.jsx';

/**
 * Selector de área para filtrar datos. Sólo visible para usuarios del área "system".
 * El estado vive en AreaContext, así que el filtro es consistente
 * entre Dashboard, Monitor de Llamadas y Campañas.
 */
export default function AreaFilter({ className = '' }) {
  const { isSystem } = useAuth();
  const { areas, selectedAreaId, selectArea } = useArea();

  if (!isSystem) return null;

  return (
    <select
      value={selectedAreaId ?? ''}
      onChange={(e) => selectArea(e.target.value)}
      className={`text-sm rounded-lg border border-gray-200 text-gray-700 bg-white px-2.5 py-2 outline-none focus:border-[#053E68] transition ${className}`}
      title="Filtrar por área"
    >
      <option value="">Todas las áreas</option>
      {areas.map((a) => (
        <option key={a.id} value={a.id}>{a.area}</option>
      ))}
    </select>
  );
}

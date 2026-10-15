import { useAuth } from '../context/AuthContext.jsx';
import { useArea } from '../context/AreaContext.jsx';

const selectCls =
  'text-sm rounded-lg border border-gray-200 text-gray-700 bg-white px-2.5 py-2 outline-none focus:border-[#053E68] transition';

/**
 * Selector de alcance de datos. El estado vive en AreaContext, así que el filtro
 * es consistente entre Dashboard, Monitor de Llamadas y Campañas.
 *
 * - Área: administradores o usuarios con varias áreas asignadas.
 * - Subárea: sólo si el área en contexto maneja subáreas. Permite ver el área
 *   completa o sin categorizar únicamente si tiene acceso al área completa.
 */
export default function AreaFilter({ className = '' }) {
  const { isAdmin } = useAuth();
  const {
    areas, selectedAreaId, selectArea,
    availableSubareas, hasSubareas, categoria, selectCategoria, fullAreaAccess,
  } = useArea();

  // Un usuario no-system cuya área no tiene subáreas no tiene nada que elegir.
  if (!isAdmin && areas.length < 2 && !hasSubareas) return null;

  return (
    <>
      {(isAdmin || areas.length > 1) && (
        <select
          value={selectedAreaId ?? ''}
          onChange={(e) => selectArea(e.target.value)}
          className={`${selectCls} ${className}`}
          title="Filtrar por área"
        >
          {isAdmin && <option value="">Todas las áreas</option>}
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.area}</option>
          ))}
        </select>
      )}

      {hasSubareas && (
        <select
          value={categoria}
          onChange={(e) => selectCategoria(e.target.value)}
          className={`${selectCls} ${className}`}
          title="Ver el área completa, una subárea, o lo no categorizado"
        >
          {fullAreaAccess && <option value="all">Área completa</option>}
          {availableSubareas.map((s) => (
            <option key={s.id} value={String(s.id)}>{s.name}</option>
          ))}
          {fullAreaAccess && <option value="none">Sin categorizar</option>}
        </select>
      )}
    </>
  );
}

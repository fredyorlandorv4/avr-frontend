import { useAuth } from '../context/AuthContext.jsx';
import { useArea } from '../context/AreaContext.jsx';

const selectCls =
  'text-sm rounded-lg border border-gray-200 text-gray-700 bg-white px-2.5 py-2 outline-none focus:border-[#053E68] transition';

/**
 * Selector de alcance de datos. El estado vive en AreaContext, así que el filtro
 * es consistente entre Dashboard, Monitor de Llamadas y Campañas.
 *
 * - Área: sólo para usuarios del área "system". El resto siempre ve la suya.
 * - Subárea: sólo si el área en contexto maneja subáreas. Permite ver el área
 *   completa, una subárea concreta, o lo que no está categorizado.
 */
export default function AreaFilter({ className = '' }) {
  const { isSystem } = useAuth();
  const {
    areas, selectedAreaId, selectArea,
    availableSubareas, hasSubareas, categoria, selectCategoria,
  } = useArea();

  // Un usuario no-system cuya área no tiene subáreas no tiene nada que elegir.
  if (!isSystem && !hasSubareas) return null;

  return (
    <>
      {isSystem && (
        <select
          value={selectedAreaId ?? ''}
          onChange={(e) => selectArea(e.target.value)}
          className={`${selectCls} ${className}`}
          title="Filtrar por área"
        >
          <option value="">Todas las áreas</option>
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
          <option value="all">Área completa</option>
          {availableSubareas.map((s) => (
            <option key={s.id} value={String(s.id)}>{s.name}</option>
          ))}
          <option value="none">Sin categorizar</option>
        </select>
      )}
    </>
  );
}

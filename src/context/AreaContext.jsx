import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import { apiFetch } from '../api.js';
import { resolveAreaSelection, permittedSubareas } from '../utils/accessScopes.js';

const AreaContext = createContext(null);

export function AreaProvider({ children }) {
  const { authToken, isLoggedIn, isAdmin, areaName, areaId, accessScopes, logout } = useAuth();

  const [allAreas, setAreas] = useState([]);
  const areas = useMemo(() => isAdmin ? allAreas : allAreas.filter(area => accessScopes.some(scope => scope.area_id === area.id)), [isAdmin, allAreas, accessScopes]);
  const [subareas, setSubareas] = useState([]);
  // Admin: null = todas. Resto: se resuelve una de sus áreas autorizadas.
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  // Categorización dentro del área en contexto:
  // 'all' = área completa | 'none' = sin categorizar | <id> = esa subárea.
  const [rawCategoria, setCategoria] = useState('all');

  // El backend devuelve el catálogo limitado a las asignaciones del usuario.
  useEffect(() => {
    if (!isLoggedIn || !authToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/v1/areas', { token: authToken, onUnauthorized: logout });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAreas(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (err.message !== 'Unauthorized') console.error('Error loading areas:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn, authToken, isAdmin, logout]);

  // Las subáreas las necesitan todos: definen si el área en contexto se puede
  // desglosar. El listado completo es el único que trae el id ({id, uuid, name, area}).
  useEffect(() => {
    if (!isLoggedIn || !authToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/v1/subareas', { token: authToken, onUnauthorized: logout });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSubareas(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (err.message !== 'Unauthorized') console.error('Error loading subareas:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn, authToken, logout]);

  // Al cerrar sesión, limpiar la selección.
  useEffect(() => {
    if (!isLoggedIn) { setSelectedAreaId(null); setCategoria('all'); }
  }, [isLoggedIn]);

  // El área "system" es un comodín que equivale a "todas". Se detecta por nombre.
  const systemAreaId = areas.find(
    (a) => (a.area || '').trim().toLowerCase() === 'system'
  )?.id ?? null;

  // Área efectiva del filtro:
  //  - no administrador: una de sus áreas asignadas.
  //  - administrador: lo que elija; "system" o sin selección => null (todas).
  const effectiveAreaId = !isAdmin
    ? resolveAreaSelection(accessScopes, selectedAreaId, areaId)
    : (selectedAreaId == null || selectedAreaId === systemAreaId ? null : selectedAreaId);

  // Área en contexto: la seleccionada dentro del alcance autorizado.
  // Sin área en contexto (administrador viendo "todas") no hay subáreas que ofrecer.
  const contextAreaName = isAdmin
    ? (areas.find((a) => a.id === effectiveAreaId)?.area || '')
    : (areas.find(a => a.id === effectiveAreaId)?.area || areaName || '');

  const selectedScope = accessScopes.find(item => item.area_id === effectiveAreaId);
  const fullAreaAccess = isAdmin || (selectedScope != null && selectedScope.subarea_ids == null);

  const availableSubareas = useMemo(
    () => permittedSubareas(subareas, effectiveAreaId, selectedScope, isAdmin),
    [subareas, effectiveAreaId, selectedScope, isAdmin],
  );
  const hasSubareas = !!contextAreaName && availableSubareas.length > 0;

  // La categorización se deriva, no se resetea: una subárea sólo es válida si
  // pertenece al área en contexto. Si cambia el área, la elección anterior deja
  // de pertenecer a la lista y cae sola a "área completa".
  const categoria = !fullAreaAccess
    ? (availableSubareas.some(s => String(s.id) === rawCategoria) ? rawCategoria : String(availableSubareas[0]?.id || selectedScope?.subarea_ids?.[0] || ''))
    :
    hasSubareas &&
    (rawCategoria === 'none' || availableSubareas.some((s) => String(s.id) === rawCategoria))
      ? rawCategoria
      : 'all';

  const selectArea = useCallback((val) => {
    setSelectedAreaId(val === '' || val == null ? null : Number(val));
  }, []);

  const selectCategoria = useCallback((val) => setCategoria(val || 'all'), []);

  // Contrato con el backend: area_id (SIEMPRE el área) + subarea (id | 'none').
  //   (vacío, vacío) = todo      | (X, vacío)  = área X completa
  //   (X, <id>)      = subárea   | (X, 'none') = área X sin categorizar
  // El área viaja siempre, así "sin categorizar" no pierde el área desde la que se pide.
  // Memoizado: se consume en deps de useCallback/useEffect y un objeto nuevo por
  // render dispararía recargas en bucle.
  const scope = useMemo(() => ({
    areaId: effectiveAreaId,
    subarea: hasSubareas && categoria !== 'all' ? categoria : null,
  }), [hasSubareas, categoria, effectiveAreaId]);

  const value = useMemo(() => ({
    areas, allSubareas: subareas, selectedAreaId: isAdmin ? selectedAreaId : effectiveAreaId, selectArea, effectiveAreaId, fullAreaAccess,
    availableSubareas, hasSubareas, categoria, selectCategoria,
    scope,
  }), [areas, subareas, isAdmin, selectedAreaId, selectArea, effectiveAreaId, fullAreaAccess,
       availableSubareas, hasSubareas, categoria, selectCategoria, scope]);

  return <AreaContext.Provider value={value}>{children}</AreaContext.Provider>;
}

export function useArea() {
  return useContext(AreaContext);
}

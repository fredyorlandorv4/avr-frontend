import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import { apiFetch } from '../api.js';

const AreaContext = createContext(null);

export function AreaProvider({ children }) {
  const { authToken, isLoggedIn, isAdmin, areaName, logout } = useAuth();

  const [areas, setAreas] = useState([]);
  const [subareas, setSubareas] = useState([]);
  // Área seleccionada en el filtro (solo usuarios "system"). null = todas las áreas.
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  // Categorización dentro del área en contexto:
  // 'all' = área completa | 'none' = sin categorizar | <id> = esa subárea.
  const [rawCategoria, setCategoria] = useState('all');

  // Los administradores pueden consultar todas las áreas; los demás conservan
  // el alcance de su área asignada, que el backend aplica en cada consulta.
  useEffect(() => {
    if (!isLoggedIn || !authToken || !isAdmin) return;
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
  //  - no administrador: null (el backend fuerza su propia área).
  //  - administrador: lo que elija; "system" o sin selección => null (todas).
  const effectiveAreaId = !isAdmin
    ? null
    : (selectedAreaId == null || selectedAreaId === systemAreaId ? null : selectedAreaId);

  // Área en contexto: la elegida por el administrador, o la propia para el resto.
  // Sin área en contexto (administrador viendo "todas") no hay subáreas que ofrecer.
  const contextAreaName = isAdmin
    ? (areas.find((a) => a.id === effectiveAreaId)?.area || '')
    : (areaName || '');

  const availableSubareas = useMemo(
    () => subareas.filter(
      (s) => (s.area || '').trim().toLowerCase() === contextAreaName.trim().toLowerCase()
    ),
    [subareas, contextAreaName],
  );
  const hasSubareas = !!contextAreaName && availableSubareas.length > 0;

  // La categorización se deriva, no se resetea: una subárea sólo es válida si
  // pertenece al área en contexto. Si cambia el área, la elección anterior deja
  // de pertenecer a la lista y cae sola a "área completa".
  const categoria =
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
    areas, selectedAreaId, selectArea, effectiveAreaId,
    availableSubareas, hasSubareas, categoria, selectCategoria,
    scope,
  }), [areas, selectedAreaId, selectArea, effectiveAreaId,
       availableSubareas, hasSubareas, categoria, selectCategoria, scope]);

  return <AreaContext.Provider value={value}>{children}</AreaContext.Provider>;
}

export function useArea() {
  return useContext(AreaContext);
}

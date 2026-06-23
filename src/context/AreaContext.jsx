import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { apiFetch } from '../api.js';

const AreaContext = createContext(null);

export function AreaProvider({ children }) {
  const { authToken, isLoggedIn, isSystem, logout } = useAuth();

  const [areas, setAreas] = useState([]);
  // Área seleccionada en el filtro (solo usuarios "system"). null = todas las áreas.
  const [selectedAreaId, setSelectedAreaId] = useState(null);

  // Solo los usuarios del área "system" pueden filtrar, así que solo ellos necesitan
  // la lista de áreas. El resto siempre ve su propia área (la fuerza el backend).
  useEffect(() => {
    if (!isLoggedIn || !authToken || !isSystem) return;
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
  }, [isLoggedIn, authToken, isSystem, logout]);

  // Al cerrar sesión, limpiar la selección.
  useEffect(() => {
    if (!isLoggedIn) setSelectedAreaId(null);
  }, [isLoggedIn]);

  // El área "system" es un comodín que equivale a "todas". Se detecta por nombre.
  const systemAreaId = areas.find(
    (a) => (a.area || '').trim().toLowerCase() === 'system'
  )?.id ?? null;

  // Área efectiva del filtro:
  //  - usuario NO system: null (no envía nada; el backend fuerza su propia área).
  //  - usuario system: lo que elija; "system" o sin selección => null (todas).
  const effectiveAreaId = !isSystem
    ? null
    : (selectedAreaId == null || selectedAreaId === systemAreaId ? null : selectedAreaId);

  const selectArea = useCallback((val) => {
    setSelectedAreaId(val === '' || val == null ? null : Number(val));
  }, []);

  return (
    <AreaContext.Provider value={{ areas, selectedAreaId, selectArea, effectiveAreaId }}>
      {children}
    </AreaContext.Provider>
  );
}

export function useArea() {
  return useContext(AreaContext);
}

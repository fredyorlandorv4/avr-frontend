import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('authToken'));
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
  const [role, setRole] = useState(() => localStorage.getItem('role') || '');
  const [areaId, setAreaId] = useState(() => {
    const stored = localStorage.getItem('areaId');
    return stored !== null && stored !== '' ? Number(stored) : null;
  });
  const [areaName, setAreaName] = useState(() => localStorage.getItem('areaName') || '');
  // Si el usuario pertenece al área "system" puede filtrar/ver cualquier área.
  const [isSystem, setIsSystem] = useState(() => localStorage.getItem('isSystem') === 'true');
  const [access, setAccess] = useState(() => {
    try { return JSON.parse(localStorage.getItem('accessProfile') || 'null'); } catch { return null; }
  });

  const isAdmin = role === 'admin';

  const login = useCallback((token, uname, userRole = '', userAreaId = null, userIsSystem = false, userAreaName = '', profile = null) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('username', uname);
    localStorage.setItem('role', userRole);
    localStorage.setItem('areaId', userAreaId != null ? String(userAreaId) : '');
    localStorage.setItem('areaName', userAreaName || '');
    localStorage.setItem('isSystem', userIsSystem ? 'true' : 'false');
    setAuthToken(token);
    setIsLoggedIn(true);
    setUsername(uname);
    setRole(userRole);
    setAreaId(userAreaId != null ? Number(userAreaId) : null);
    setAreaName(userAreaName || '');
    setIsSystem(!!userIsSystem);
    setAccess(profile);
    localStorage.setItem('accessProfile', JSON.stringify(profile));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('areaId');
    localStorage.removeItem('areaName');
    localStorage.removeItem('isSystem');
    localStorage.removeItem('accessProfile');
    setAuthToken(null);
    setIsLoggedIn(false);
    setUsername('');
    setRole('');
    setAreaId(null);
    setAreaName('');
    setIsSystem(false);
    setAccess(null);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    apiFetch('/api/v1/auth/me', { token: authToken, onUnauthorized: logout }).then(async response => {
      if (!response.ok) return;
      const profile = await response.json();
      if (active) { setAccess(profile); localStorage.setItem('accessProfile', JSON.stringify(profile)); }
    }).catch(() => {});
    return () => { active = false; };
  }, [authToken, logout]);

  const accessScopes = access?.access_scopes ?? (areaId != null ? [{ area_id: areaId, subarea_ids: null }] : []);
  const sapSources = isAdmin ? ['lotes', 'edificios'] : (access?.sap_sources || []);

  return (
    <AuthContext.Provider value={{ authToken, isLoggedIn, username, role, areaId, areaName, isSystem, isAdmin, accessScopes, sapSources, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

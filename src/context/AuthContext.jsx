import { createContext, useContext, useState, useCallback } from 'react';

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

  const isAdmin = role === 'admin';

  const login = useCallback((token, uname, userRole = '', userAreaId = null, userIsSystem = false, userAreaName = '') => {
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
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('areaId');
    localStorage.removeItem('areaName');
    localStorage.removeItem('isSystem');
    setAuthToken(null);
    setIsLoggedIn(false);
    setUsername('');
    setRole('');
    setAreaId(null);
    setAreaName('');
    setIsSystem(false);
  }, []);

  return (
    <AuthContext.Provider value={{ authToken, isLoggedIn, username, role, areaId, areaName, isSystem, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

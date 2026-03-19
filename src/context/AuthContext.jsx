import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('authToken'));
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
  const [role, setRole] = useState(() => localStorage.getItem('role') || '');

  const isAdmin = role === 'admin';

  const login = useCallback((token, uname, userRole = '') => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('username', uname);
    localStorage.setItem('role', userRole);
    setAuthToken(token);
    setIsLoggedIn(true);
    setUsername(uname);
    setRole(userRole);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    setAuthToken(null);
    setIsLoggedIn(false);
    setUsername('');
    setRole('');
  }, []);

  return (
    <AuthContext.Provider value={{ authToken, isLoggedIn, username, role, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('authToken'));
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');

  const login = useCallback((token, uname) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('username', uname);
    setAuthToken(token);
    setIsLoggedIn(true);
    setUsername(uname);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    setAuthToken(null);
    setIsLoggedIn(false);
    setUsername('');
  }, []);

  return (
    <AuthContext.Provider value={{ authToken, isLoggedIn, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

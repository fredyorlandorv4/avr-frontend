import { useState } from 'react';
import { Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';

export default function LoginPage() {
  const { login } = useAuth();
  const [usernameField, setUsernameField] = useState('');
  const [passwordField, setPasswordField] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!usernameField || !passwordField) {
      setLoginError('Por favor ingresa usuario y contraseña');
      return;
    }

    setLoading(true);
    setLoginError('');

    try {
      const response = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: { username: usernameField, password: passwordField },
      });

      const data = await response.json();

      if (response.ok) {
        login(data.access_token, usernameField, data.role || '');
      } else {
        setLoginError(data.detail || 'Usuario o contraseña incorrectos');
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      setLoginError('Error de conexión. Verifica que la API esté corriendo.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4 overflow-auto">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mb-4">
              <Phone className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">AVR System</h1>
            <p className="text-blue-200">Agent Voice Response</p>
          </div>

          <div className="space-y-6">
            {loginError && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-200 text-sm">{loginError}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-blue-100 mb-2">Usuario</label>
              <input
                type="text"
                value={usernameField}
                onChange={(e) => setUsernameField(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Ingresa tu usuario"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-100 mb-2">Contraseña</label>
              <input
                type="password"
                value={passwordField}
                onChange={(e) => setPasswordField(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Ingresa tu contraseña"
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transform hover:scale-105 transition duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Iniciando...' : 'Iniciar Sesión'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

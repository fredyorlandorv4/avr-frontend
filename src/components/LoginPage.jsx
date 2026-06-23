import { useState } from 'react';
import { Phone, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api.js';

export default function LoginPage() {
  const { login } = useAuth();
  const [usernameField, setUsernameField] = useState('');
  const [passwordField, setPasswordField] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        login(data.access_token, usernameField, data.role || '', data.area_id ?? null, data.is_system ?? false, data.area_name || '');
      } else {
        setLoginError(data.detail || 'Usuario o contraseña incorrectos');
      }

    } catch {
      setLoginError('Error de conexión. Verifica que la API esté corriendo.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen">
    <div className="min-h-screen flex mx-auto max-w-[2000px] shadow-xl overflow-hidden">

      {/* ── Left panel: branding ───────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] bg-[#053E68] flex-col justify-between relative overflow-hidden">

        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#F4CD04] rounded-full opacity-[0.07]" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-[#F4CD04] rounded-full opacity-[0.06] translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] border border-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[48rem] h-[48rem] border border-white/[0.03] rounded-full" />

        {/* Yellow accent strip */}
        <div className="absolute left-0 top-0 h-full w-1 bg-[#F4CD04]" />

        {/* Top badge */}
        <div className="relative z-10 p-10">
          <span className="inline-flex items-center gap-2 bg-white/10 text-[#F4CD04] text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full border border-white/10">
            <span className="w-1.5 h-1.5 bg-[#F4CD04] rounded-full animate-pulse" />
            Plataforma activa
          </span>
        </div>

        {/* Center content */}
        <div className="relative z-10 px-14">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-10">
            <div className="flex items-center justify-center w-16 h-16 bg-[#F4CD04] rounded-2xl">
              <Phone className="w-8 h-8 text-[#053E68]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">RV4 - Call System</h1>
              <p className="text-blue-300 text-sm">Potenciando la Automatización</p>
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-5xl font-extrabold text-white leading-tight mb-6">
            Gestión de<br />
            <span className="text-[#F4CD04]">llamadas</span><br />
            inteligente.
          </h2>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-8 bg-[#F4CD04]" />
            <p className="text-blue-200 text-sm leading-relaxed">
              Automatiza campañas, visualiza métricas <br /> y gestiona seguimientos desde un solo lugar.
            </p>
          </div>

        </div>

        {/* Bottom */}
        <div className="relative z-10 p-10">
          <p className="text-blue-400/60 text-xs">© 2026 RV4 · Todos los derechos reservados</p>
        </div>
      </div>

      {/* ── Right panel: form (mobile: immersive blue · desktop: white) ────── */}
      <div className="flex-1 flex flex-col justify-center bg-[#053E68] lg:bg-white px-8 py-12 relative overflow-hidden">

        {/* Mobile-only decorative accents */}
        <div className="lg:hidden absolute left-0 top-0 h-full w-1 bg-[#F4CD04]" />
        <div className="lg:hidden absolute -top-20 -right-16 w-72 h-72 bg-[#F4CD04] rounded-full opacity-[0.08]" />
        <div className="lg:hidden absolute -bottom-24 -left-16 w-72 h-72 bg-[#F4CD04] rounded-full opacity-[0.06]" />

        <div className="relative z-10 w-full max-w-[380px] mx-auto">

          {/* Mobile-only logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="flex items-center justify-center w-14 h-14 bg-[#F4CD04] rounded-2xl flex-shrink-0">
              <Phone className="w-7 h-7 text-[#053E68]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">RV4 - Call System</h1>
              <p className="text-blue-300 text-xs">Potenciando la automatización</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-white lg:text-[#053E68] mb-1">Bienvenido</h2>
            <p className="text-blue-200 lg:text-gray-400 text-sm">Ingresa tus credenciales para continuar</p>
          </div>

          {/* Error */}
          {loginError && (
            <div className="mb-5 flex items-start gap-3 bg-red-500/15 lg:bg-red-50 border border-red-400/40 lg:border-red-200 rounded-xl p-4">
              <div className="w-1.5 h-1.5 bg-red-400 lg:bg-red-500 rounded-full mt-1.5 shrink-0" />
              <p className="text-red-200 lg:text-red-600 text-sm">{loginError}</p>
            </div>
          )}

          {/* Fields */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-blue-200 lg:text-gray-500">
                Usuario
              </label>
              <input
                type="text"
                value={usernameField}
                onChange={(e) => setUsernameField(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-3.5 rounded-xl outline-none transition-all border-2
                           bg-white/10 border-white/20 text-white placeholder-blue-300/60
                           focus:bg-white/15 focus:border-[#F4CD04]
                           lg:bg-gray-50 lg:border-gray-100 lg:text-gray-800 lg:placeholder-gray-300 lg:focus:bg-white lg:focus:border-[#053E68]"
                placeholder="Tu nombre de usuario"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-blue-200 lg:text-gray-500">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordField}
                  onChange={(e) => setPasswordField(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3.5 pr-12 rounded-xl outline-none transition-all border-2
                             bg-white/10 border-white/20 text-white placeholder-blue-300/60
                             focus:bg-white/15 focus:border-[#F4CD04]
                             lg:bg-gray-50 lg:border-gray-100 lg:text-gray-800 lg:placeholder-gray-300 lg:focus:bg-white lg:focus:border-[#053E68]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-300 lg:text-gray-400"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#F4CD04] outline-none text-[#053E68] font-bold py-4 rounded-xl shadow-lg shadow-black/10 lg:shadow-md lg:shadow-[#F4CD04]/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Iniciando sesión...</>
                : <><span>Iniciar Sesión</span><ArrowRight className="w-5 h-5" /></>
              }
            </button>

          </div>

          {/* Footer */}
          <p className="text-center text-blue-300/60 lg:text-gray-300 text-xs mt-10">
            © 2026 RV4 · Call System
          </p>
        </div>
      </div>

    </div>
    </div>
  );
}

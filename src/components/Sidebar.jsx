import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Activity, Phone, BarChart3, Target, Clock, Users, Settings, LogOut, Briefcase, FileText, Sparkles, FlaskConical, WalletCards, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const ADMIN_ONLY = new Set(['prompts', 'agent-call-tests', 'users']);
const ADMIN_OR_SUPERVISOR = new Set(['overdue-portfolio']);
// El área de marketing (telemarketing) no accede a proyectos.
const TELEMARKETING_HIDDEN = new Set(['projects']);

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',           path: '/dashboard', Icon: Activity  },
  { id: 'calls',     label: 'Monitor de Llamadas', path: '/calls',     Icon: Phone     },
  { id: 'call-analysis', label: 'Análisis de llamadas', path: '/call-analysis', Icon: Sparkles },
  { id: 'reports',   label: 'Reportes',            path: '/reports',   Icon: BarChart3 },
  { id: 'messaging', label: 'Mensajería', path: '/messaging', Icon: MessageSquare },
  { id: 'overdue-portfolio', label: 'Consulta SAP', path: '/consulta-sap', Icon: WalletCards },
  { id: 'campaigns', label: 'Campañas',            path: '/campaigns', Icon: Target    },
  { id: 'followups', label: 'Follow Ups',          path: '/followups', Icon: Clock     },
  { id: 'projects',  label: 'Proyectos',           path: '/projects',  Icon: Briefcase },
  { id: 'prompts',   label: 'Prompts',             path: '/prompts',   Icon: FileText  },
  { id: 'agent-call-tests', label: 'Pruebas de Agentes', path: '/agent-call-tests', Icon: FlaskConical },
  { id: 'users',     label: 'Usuarios',            path: '/users',     Icon: Users     },
];

export default function Sidebar({ sidebarOpen, onClose }) {

  const { logout, isAdmin, username, role, areaName, isSystem } = useAuth();
  const { pathname } = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(() => pathname === '/settings' || pathname === '/settings/messaging');

  useEffect(() => {
    if (pathname === '/settings' || pathname === '/settings/messaging') setSettingsOpen(true);
  }, [pathname]);

  const capitalizeFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const panelLabel = (isSystem || !areaName) ? 'Panel de Gestiones' : capitalizeFirst(areaName);

  const isTelemarketing = (areaName || '').toLowerCase() === 'telemarketing';

  const visibleItems = NAV_ITEMS.filter(({ id }) => {
    if (ADMIN_ONLY.has(id) && !isAdmin) return false;
    if (ADMIN_OR_SUPERVISOR.has(id) && !['admin', 'supervisor'].includes(role)) return false;
    if (id === 'messaging' && !(isAdmin || (role === 'supervisor' && (areaName || '').trim().toLowerCase() === 'cobros'))) return false;
    if (isTelemarketing && TELEMARKETING_HIDDEN.has(id)) return false;
    return true;
  });

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 fixed lg:static top-0 left-0 h-screen w-64 bg-[#053E68] transition-transform duration-300 z-30 flex flex-col overflow-y-auto overscroll-contain`}>

        {/* User info — mobile only, at the very top */}
        {username && (
          <div className="lg:hidden flex items-center gap-3 px-5 py-5 border-b border-white/10">
            <div className="flex items-center justify-center w-10 h-10 bg-[#F4CD04] rounded-full flex-shrink-0">
              <span className="text-[#053E68] font-bold uppercase">
                {username.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{username}</p>
              <p className="text-xs text-blue-300 capitalize">{role || 'usuario'}</p>
            </div>
          </div>
        )}

        {/* Logo — desktop only */}
        <div className="hidden lg:flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="flex items-center justify-center w-11 h-11 bg-[#F4CD04] rounded-xl flex-shrink-0">
            <Phone className="w-6 h-6 text-[#053E68]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-tight">RV4 - Call System</h1>
            <p className="text-xs text-blue-300">{panelLabel}</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 pt-5">
          {visibleItems.map(({ id, label, path, Icon }) => (
            <NavLink
              key={id}
              to={path}
              onClick={onClose}
              className={({ isActive }) =>
                `group w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-[#F4CD04] text-[#053E68]'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {isAdmin && (
            <div>
              <button
                type="button"
                onClick={() => setSettingsOpen(open => !open)}
                className={`group w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  pathname === '/settings' || pathname === '/settings/messaging'
                    ? 'bg-white/10 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
                aria-expanded={settingsOpen}
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 text-left">Configuración</span>
                {settingsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {settingsOpen && (
                <div className="mt-1 ml-4 pl-3 space-y-1 border-l border-white/20">
                  <NavLink
                    to="/settings"
                    onClick={onClose}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-[#F4CD04] text-[#053E68] font-semibold' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}
                  >
                    <Users className="w-4 h-4" />
                    Áreas y Subáreas
                  </NavLink>
                  <NavLink
                    to="/settings/messaging"
                    onClick={onClose}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-[#F4CD04] text-[#053E68] font-semibold' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Mensajería
                  </NavLink>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm text-[#ff0000] bg-[#ff000020] hover:border-[#ff000090]"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}

import { NavLink } from 'react-router-dom';
import { Activity, Phone, BarChart3, Target, Clock, Users, Settings, LogOut, Briefcase, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const ADMIN_ONLY = new Set(['reports', 'prompts', 'users', 'settings']);

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',           path: '/dashboard', Icon: Activity  },
  { id: 'calls',     label: 'Monitor de Llamadas', path: '/calls',     Icon: Phone     },
  { id: 'reports',   label: 'Reportes',            path: '/reports',   Icon: BarChart3 },
  { id: 'campaigns', label: 'Campañas',            path: '/campaigns', Icon: Target    },
  { id: 'followups', label: 'Follow Ups',          path: '/followups', Icon: Clock     },
  { id: 'projects',  label: 'Proyectos',           path: '/projects',  Icon: Briefcase },
  { id: 'prompts',   label: 'Prompts',             path: '/prompts',   Icon: FileText  },
  { id: 'users',     label: 'Usuarios',            path: '/users',     Icon: Users     },
  { id: 'settings',  label: 'Configuración',       path: '/settings',  Icon: Settings  },
];

export default function Sidebar({ sidebarOpen, onClose }) {

  const { logout, isAdmin, username, role } = useAuth();

  const visibleItems = NAV_ITEMS.filter(({ id }) => !ADMIN_ONLY.has(id) || isAdmin);

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
            <p className="text-xs text-blue-300">Panel de Gestiones</p>
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

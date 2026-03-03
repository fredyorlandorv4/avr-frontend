import { Activity, Phone, BarChart3, Target, Clock, Users, Settings, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',           Icon: Activity  },
  { id: 'calls',     label: 'Monitor de Llamadas', Icon: Phone     },
  { id: 'reports',   label: 'Reportes',            Icon: BarChart3 },
  { id: 'campaigns', label: 'Campañas',            Icon: Target    },
  { id: 'followups', label: 'Follow Ups',          Icon: Clock     },
  { id: 'users',     label: 'Usuarios',            Icon: Users     },
  { id: 'settings',  label: 'Configuración',       Icon: Settings  },
];

export default function Sidebar({ activeTab, sidebarOpen, onTabChange, onClose }) {
  const { logout } = useAuth();

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 fixed lg:static top-0 left-0 h-screen w-64 bg-white border-r shadow-lg lg:shadow-none transition-transform duration-300 z-30 overflow-y-auto overscroll-contain`}>

        {/* Logo — desktop only */}
        <div className="hidden lg:flex items-center gap-2 p-6 border-b">
          <Phone className="w-8 h-8 text-blue-600 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-gray-800">AVR System</h1>
            <p className="text-xs text-gray-500">Agent Voice Response</p>
          </div>
        </div>

        <nav className="p-4 space-y-2 lg:pt-4 pt-20 pb-8">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                activeTab === id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </button>
          ))}

          <div className="pt-4 border-t mt-4">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-red-600 hover:bg-red-50 transition"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              Cerrar Sesión
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Phone, Bell, Menu, X, BarChart3, Users } from 'lucide-react';

import { useAuth } from './context/AuthContext.jsx';
import { useArea } from './context/AreaContext.jsx';
import { apiFetch } from './api.js';

import LoginPage from './components/LoginPage.jsx';
import Sidebar from './components/Sidebar.jsx';
import Toast from './components/Toast.jsx';
import TranscriptionModal from './components/TranscriptionModal.jsx';
import AnalysisModal from './components/AnalysisModal.jsx';
import DashboardView from './components/DashboardView.jsx';
import CallsMonitorView from './components/CallsMonitorView.jsx';
import CampaignListView from './components/CampaignListView.jsx';
import CreateCampaignView from './components/CreateCampaignView.jsx';
import CampaignContactsView from './components/CampaignContactsView.jsx';
import FollowUpsView from './components/FollowUpsView.jsx';
import ProjectsView from './components/ProjectsView.jsx';
import PromptsView from './components/PromptsView.jsx';
import AgentEditor from './components/AgentEditor.jsx';
import UsersView from './components/UsersView.jsx';
import SettingsView from './components/SettingsView.jsx';

const PATH_LABELS = {
  '/dashboard':     'Dashboard',
  '/calls':         'Monitor de Llamadas',
  '/reports':       'Reportes',
  '/campaigns':     'Campañas',
  '/campaigns/new': 'Nueva Campaña',
  '/followups':     'Follow Ups',
  '/projects':      'Proyectos',
  '/prompts':       'Prompts',
  '/prompts/new':   'Nuevo Agente',
  '/users':         'Usuarios',
  '/settings':      'Configuración',
};

// ─── Helpers de fecha (rango por defecto de los filtros) ─────────────────────

const isoDay = (d) => d.toISOString().slice(0, 10);
const todayIso = () => isoDay(new Date());

// Una semana atrás (7 días).
const weekAgoIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return isoDay(d);
};

// ─── Auth guards ─────────────────────────────────────────────────────────────

function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <Navigate to="/dashboard" replace /> : children;
}

// ─── Layout (fixed chrome: sidebar + headers — content goes in <Outlet />) ─────

function Layout() {
  const { logout, username, role } = useAuth();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageTitle = (() => {
    if (pathname.startsWith('/campaigns/') && pathname.endsWith('/contacts')) return 'Contactos de Campaña';
    if (pathname.startsWith('/prompts/') && pathname.endsWith('/edit')) return 'Editar Agente';
    return PATH_LABELS[pathname] ?? 'RV4 - Call System';
  })();

  return (
    <div className="h-screen overflow-hidden bg-gray-200">
      <div className="h-full flex overflow-hidden bg-gray-50 mx-auto max-w-[2000px] shadow-xl">
        <Sidebar sidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-100 shrink-0 z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(v => !v)}
                className="p-2 text-[#053E68] hover:bg-gray-100 rounded-xl transition"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-9 h-9 bg-[#053E68] rounded-xl flex-shrink-0">
                  <Phone className="w-5 h-5 text-[#F4CD04]" />
                </div>
                <h1 className="text-base font-bold text-[#053E68] leading-tight">RV4 - Call System</h1>
              </div>
            </div>
            <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F4CD04] rounded-xl ring-2 ring-white" />
            </button>
          </div>
        </header>

        {/* Desktop header */}
        <header className="hidden lg:block bg-white border-b border-gray-100 shrink-0 z-10">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <div>
              <h2 className="text-2xl font-bold text-[#053E68]">{pageTitle}</h2>
              <div className="h-1 w-10 bg-[#F4CD04] rounded-xl mt-1.5" />
            </div>
            <div className="flex items-center gap-3">
              <button className="relative p-2.5 text-gray-500 hover:bg-gray-100 rounded-xl transition">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F4CD04] rounded-xl ring-2 ring-white" />
              </button>
              <div className="h-8 w-px bg-gray-200" />
              <div className="flex items-center gap-3 pl-1">
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#053E68] leading-tight">{username || 'Usuario'}</p>
                  <p className="text-xs text-gray-400 capitalize">{role || 'usuario'}</p>
                </div>
                <div className="flex items-center justify-center w-10 h-10 bg-[#053E68] rounded-xl flex-shrink-0">
                  <span className="text-[#F4CD04] font-bold uppercase">
                    {(username || 'U').charAt(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable content region */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
        </div>
      </div>
    </div>
  );
}

// ─── Placeholder for "coming soon" admin sections ─────────────────────────────

function ComingSoon({ Icon, title }) {
  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="relative w-full max-w-md overflow-hidden bg-white border border-gray-100 rounded-3xl shadow-sm px-8 py-12 text-center">
        {/* Decorative blobs */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#F4CD04] rounded-full opacity-[0.07]" />
        <div className="absolute -bottom-20 -left-16 w-52 h-52 bg-[#053E68] rounded-full opacity-[0.05]" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Icon badge */}
          <div className="relative mb-6">
            <div className="flex items-center justify-center w-20 h-20 bg-[#053E68]/5 rounded-2xl">
              <Icon className="w-10 h-10 text-[#053E68]" />
            </div>
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#F4CD04] rounded-full ring-4 ring-white" />
          </div>

          {/* Badge */}
          <span className="inline-flex items-center gap-2 bg-[#F4CD04]/15 text-[#8a6d00] text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-4">
            <span className="w-1.5 h-1.5 bg-[#F4CD04] rounded-full" />
            En construcción
          </span>

          <h3 className="text-2xl font-bold text-[#053E68] mb-2">{title}</h3>
          <p className="text-gray-400 text-sm max-w-xs">
            Estamos trabajando en esta sección. Estará disponible muy pronto.
          </p>

          {/* Progress hint */}
          <div className="mt-7 w-40 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full w-2/5 bg-[#F4CD04] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign sub-page wrappers ───────────────────────────────────────────────

function CreateCampaignPage({ loadCampaigns }) {
  const navigate = useNavigate();
  return (
    <CreateCampaignView
      onCancel={() => navigate('/campaigns')}
      onSuccess={() => { loadCampaigns(); navigate('/campaigns'); }}
    />
  );
}

function AgentEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  return (
    <div className="max-w-[1280px] mx-auto">
      <AgentEditor
        agentId={id ? parseInt(id) : null}
        onSaved={() => navigate('/prompts')}
        onCancel={() => navigate('/prompts')}
      />
    </div>
  );
}

function CampaignContactsPage({ campaigns, campaignContacts, calls, loading, loadCampaignContacts, onViewCallAnalysis }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation();
  const campaignId = parseInt(id);
  const campaign = state?.campaign ?? campaigns.find(c => c.id === campaignId);

  useEffect(() => {
    if (campaignId) loadCampaignContacts(campaignId, campaign?.areaName);
  }, [campaignId, campaign?.areaName]);

  return (
    <CampaignContactsView
      campaign={campaign}
      contacts={campaignContacts}
      calls={calls}
      loading={loading}
      onBack={() => navigate('/campaigns')}
      onRefresh={() => loadCampaignContacts(campaignId, campaign?.areaName)}
      onViewCallAnalysis={onViewCallAnalysis}
    />
  );
}

// ─── App shell (holds shared state + data loaders, defines routes) ────────────

function AppShell() {
  const { authToken, isLoggedIn, logout, isAdmin, isSystem, areaName } = useAuth();
  const { areas, scope } = useArea();

  // Restricciones del área de marketing (telemarketing): no crea campañas
  // por Excel ni accede a proyectos. Sí accede a follow-ups.
  const isTelemarketing = (areaName || '').toLowerCase() === 'telemarketing';
  const canCreateCampaigns = !isTelemarketing;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Alcance a aplicar en las consultas: area_id es el área; subarea es el id de
  // la subárea, o 'none' para ver sólo lo que no está en ninguna subárea.
  const areaParam =
    (scope.areaId != null ? `&area_id=${scope.areaId}` : '') +
    (scope.subarea ? `&subarea=${scope.subarea}` : '');

  const [loading, setLoading]   = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast]       = useState({ show: false, message: '', type: '' });

  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal]           = useState(false);
  const [selectedCall, setSelectedCall]                     = useState(null);

  // El monitor de llamadas gestiona su propia data; aquí `calls` sólo sirve como
  // fallback (vacío) para enlazar contactos con su llamada en la vista de contactos.
  const [calls]                                 = useState([]);
  const [campaigns, setCampaigns]               = useState([]);
  // Filtro de fechas de campañas (sobre la fecha de creación): último mes.
  const [campaignDateStart, setCampaignDateStart] = useState(weekAgoIso);
  const [campaignDateEnd,   setCampaignDateEnd]   = useState(todayIso);

  // El rango se mantiene válido en el estado, no confiando en el min/max del
  // input (el navegador sólo los usa como pista: se pueden teclear igual).
  // Si una fecha cruza a la otra, se arrastra la otra con ella.
  const changeCampaignStart = useCallback((value) => {
    setCampaignDateStart(value);
    if (value) setCampaignDateEnd((end) => (end && value > end ? value : end));
  }, []);
  const changeCampaignEnd = useCallback((value) => {
    setCampaignDateEnd(value);
    if (value) setCampaignDateStart((start) => (start && value < start ? value : start));
  }, []);
  const resetCampaignDates = useCallback(() => {
    setCampaignDateStart(weekAgoIso());
    setCampaignDateEnd(todayIso());
  }, []);
  const [campaignContacts, setCampaignContacts] = useState([]);
  const [followUps, setFollowUps]               = useState([]);
  const [followUpStats, setFollowUpStats]       = useState({ total: 0, green: 0, orange: 0, red: 0, completed: 0 });

  // Filtro de área SOLO para follow-ups (usuarios "system"). A diferencia del filtro
  // global, aquí no existe la opción "todas": siempre se ve un área concreta para no
  // saturar las tarjetas con etiquetas de área. El resto de usuarios ve su propia área
  // (la fuerza el backend), así que no necesitan selector.
  // Se excluye "system" (equivale a "todas"); cobros y telemarketing sí aparecen.
  const followUpAreas = areas.filter(
    (a) => (a.area || '').trim().toLowerCase() !== 'system'
  );
  const [followUpAreaId, setFollowUpAreaId] = useState(null);

  // Al cargar la lista de áreas (usuario system), seleccionar la primera por defecto.
  useEffect(() => {
    if (isSystem && followUpAreaId == null && followUpAreas.length > 0) {
      setFollowUpAreaId(followUpAreas[0].id);
    }
  }, [isSystem, followUpAreaId, followUpAreas]);

  const followUpAreaParam = (isSystem && followUpAreaId != null) ? `&area_id=${followUpAreaId}` : '';

  // --- Helpers ---

  const showToast = useCallback((message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 4000);
  }, []);

  // --- Data loaders ---
  // El monitor de llamadas (CallsMonitorView) se auto-carga con sus propios
  // filtros y paginación (server-side), así que aquí ya no se cargan las llamadas.

  const loadCampaigns = useCallback(async () => {
    if (!authToken) return;
    try {
      const dateParams =
        (campaignDateStart ? `&fecha_inicio=${campaignDateStart}` : '') +
        (campaignDateEnd   ? `&fecha_fin=${campaignDateEnd}`     : '');
      const res = await apiFetch(`/api/v1/campaigns?skip=0&limit=100${areaParam}${dateParams}`, {
        token: authToken,
        onUnauthorized: logout,
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.map(c => ({
          id:          c.id,
          name:        c.name,
          title:       c.title        || '',
          description: c.description  || '',
          projectName: c.project_name || c.project?.name || '',
          areaName:    c.area_name || c.area?.area || '',
          status:      c.status,
          contacts:    c.total_contacts   || 0,
          completed:   c.called_contacts  || 0,
          pending:     Math.max(0, (c.total_contacts || 0) - (c.called_contacts || 0)),
          created:     c.created_at ? new Date(c.created_at).toLocaleDateString('es-GT') : '-',
        })));
      } else {
        const detail = await res.json().catch(() => null);
        const msg = detail?.detail;
        showToast(
          typeof msg === 'string' ? msg : `Error al cargar campañas (${res.status})`,
          'error',
        );
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        console.error('Error loading campaigns:', err);
        showToast('No se pudieron cargar las campañas', 'error');
      }
    }
  }, [authToken, logout, areaParam, campaignDateStart, campaignDateEnd, showToast]);

  const loadCampaignContacts = useCallback(async (campaignId, areaName = '') => {
    if (!authToken || !campaignId) return;
    const isTelemarketing = (areaName || '').toLowerCase() === 'telemarketing';
    const url = isTelemarketing
      ? `/api/v1/campaigns/telemarketing/${campaignId}`
      : `/api/v1/campaigns/contacts_by_campaing/${campaignId}`;
    setLoading(true);
    try {
      const res = await apiFetch(url, {
        token: authToken,
        onUnauthorized: logout,
      });
      if (res.ok) {
        const data = await res.json();
        const contacts = Array.isArray(data)
          ? data
          : (data.contacts || data.items || data.results || data.data || []);
        setCampaignContacts(contacts);
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') console.error('Error loading campaign contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [authToken, logout]);

  const loadFollowUps = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await apiFetch(`/api/v1/follow-ups?skip=0&limit=100${followUpAreaParam}`, {
        token: authToken,
        onUnauthorized: logout,
      });
      if (res.ok) setFollowUps(await res.json());
    } catch (err) {
      if (err.message !== 'Unauthorized') console.error('Error loading follow-ups:', err);
    }
  }, [authToken, logout, followUpAreaParam]);

  const loadFollowUpStats = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await apiFetch(`/api/v1/follow-ups/stats?${followUpAreaParam.replace(/^&/, '')}`, {
        token: authToken,
        onUnauthorized: logout,
      });
      if (res.ok) setFollowUpStats(await res.json());
    } catch (err) {
      if (err.message !== 'Unauthorized') console.error('Error loading follow-up stats:', err);
    }
  }, [authToken, logout, followUpAreaParam]);

  const startCampaign = useCallback(async (campaignId, campaignName) => {
    if (!authToken || !campaignId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/campaigns/campaigns/${campaignId}/start-queue`, {
        method: 'POST',
        token: authToken,
        onUnauthorized: logout,
      });
      if (res.ok) {
        const data = await res.json();
        const statusMessages = { active: 'activa y en ejecución', completed: 'completada', paused: 'pausada', created: 'creada' };
        showToast(`¡Campaña "${campaignName}" iniciada! Estado: ${statusMessages[data.status] || data.status}`, 'success');
        await loadCampaigns();
      } else {
        const errData = await res.json();
        showToast(errData.detail || 'Error al iniciar la campaña', 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Error de conexión al iniciar la campaña', 'error');
    } finally {
      setLoading(false);
    }
  }, [authToken, logout, loadCampaigns, showToast]);

  const toggleFollowUpCompletion = useCallback(async (followUpId) => {
    const followUp = followUps.find(fu => fu.id === followUpId);
    if (!followUp) return;

    const previousState = followUp.completed;

    setFollowUps(prev => prev.map(fu => fu.id === followUpId
      ? { ...fu, completed: !fu.completed, completed_at: !fu.completed ? new Date().toISOString() : null }
      : fu
    ));
    showToast(previousState ? 'Follow-up marcado como pendiente' : '✓ Follow-up completado', previousState ? 'info' : 'success');

    try {
      const res = await apiFetch(`/api/v1/follow-ups/${followUpId}/complete`, {
        method: 'PATCH',
        token: authToken,
        onUnauthorized: logout,
      });
      if (!res.ok) {
        setFollowUps(prev => prev.map(fu => fu.id === followUpId
          ? { ...fu, completed: previousState, completed_at: previousState ? followUp.completed_at : null }
          : fu
        ));
        showToast('Error al actualizar el follow-up', 'error');
      } else {
        await loadFollowUps();
        await loadFollowUpStats();
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        setFollowUps(prev => prev.map(fu => fu.id === followUpId
          ? { ...fu, completed: previousState, completed_at: previousState ? followUp.completed_at : null }
          : fu
        ));
        showToast('Error de conexión al actualizar el follow-up', 'error');
      }
    }
  }, [authToken, logout, followUps, loadFollowUps, loadFollowUpStats, showToast]);

  // --- Effects ---

  useEffect(() => {
    if (!isLoggedIn || !authToken) return;

    // Carga perezosa: sólo los datos que la ruta actual necesita, una vez al entrar
    // (o cuando cambia el área). El refresco manual se hace con el botón "Actualizar".
    if (pathname.startsWith('/campaigns') && pathname !== '/campaigns/new') {
      loadCampaigns();
    } else if (pathname.startsWith('/followups')) {
      loadFollowUps();
      loadFollowUpStats();
    }
  }, [isLoggedIn, authToken, pathname, loadCampaigns, loadFollowUps, loadFollowUpStats]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // --- Handlers ---

  const openAnalysis      = (call) => { setSelectedCall(call); setShowAnalysisModal(true); };
  const openTranscription = (call) => { setSelectedCall(call); setShowTranscriptionModal(true); };

  // --- Render ---

  return (
    <>
      <TranscriptionModal
        show={showTranscriptionModal}
        call={selectedCall}
        onClose={() => setShowTranscriptionModal(false)}
      />
      <AnalysisModal
        show={showAnalysisModal}
        call={selectedCall}
        onClose={() => setShowAnalysisModal(false)}
      />
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ show: false, message: '', type: '' })}
      />

      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={
            <DashboardView
              campaigns={campaigns}
              followUps={followUps}
            />
          } />

          <Route path="/calls" element={
            <CallsMonitorView
              onViewTranscription={openTranscription}
              onViewAnalysis={openAnalysis}
            />
          } />

          <Route path="/reports" element={
            isAdmin ? <ComingSoon Icon={BarChart3} title="Módulo de Reportes" /> : <Navigate to="/dashboard" replace />
          } />

          <Route path="/campaigns" element={
            <CampaignListView
              campaigns={campaigns}
              loading={loading}
              onRefresh={loadCampaigns}
              dateStart={campaignDateStart}
              dateEnd={campaignDateEnd}
              onDateStartChange={changeCampaignStart}
              onDateEndChange={changeCampaignEnd}
              onClearDates={resetCampaignDates}
              onCreateNew={() => navigate('/campaigns/new')}
              onViewContacts={(campaign) => navigate(`/campaigns/${campaign.id}/contacts`, { state: { campaign } })}
              onStartCampaign={startCampaign}
            />
          } />

          <Route path="/campaigns/new" element={
            canCreateCampaigns
              ? <CreateCampaignPage loadCampaigns={loadCampaigns} />
              : <Navigate to="/campaigns" replace />
          } />

          <Route path="/campaigns/:id/contacts" element={
            <CampaignContactsPage
              campaigns={campaigns}
              campaignContacts={campaignContacts}
              calls={calls}
              loading={loading}
              loadCampaignContacts={loadCampaignContacts}
              onViewCallAnalysis={openAnalysis}
            />
          } />

          <Route path="/followups" element={
            <FollowUpsView
              followUps={followUps}
              followUpStats={followUpStats}
              isMobile={isMobile}
              onToggleComplete={toggleFollowUpCompletion}
              showAreaFilter={isSystem}
              areas={followUpAreas}
              selectedAreaId={followUpAreaId}
              onAreaChange={setFollowUpAreaId}
              onRefresh={() => {
                loadFollowUps();
                loadFollowUpStats();
                showToast('Follow-ups actualizados', 'success');
              }}
            />
          } />

          <Route path="/projects" element={
            isTelemarketing ? <Navigate to="/dashboard" replace /> : <ProjectsView />
          } />

          <Route path="/prompts" element={
            isAdmin ? <PromptsView /> : <Navigate to="/dashboard" replace />
          } />

          <Route path="/prompts/new" element={
            isAdmin ? <AgentEditorPage /> : <Navigate to="/dashboard" replace />
          } />

          <Route path="/prompts/:id/edit" element={
            isAdmin ? <AgentEditorPage /> : <Navigate to="/dashboard" replace />
          } />

          <Route path="/users" element={
            isAdmin ? <UsersView /> : <Navigate to="/dashboard" replace />
          } />

          <Route path="/settings" element={
            isAdmin ? <SettingsView /> : <Navigate to="/dashboard" replace />
          } />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </>
  );
}

// ─── Root: auth guards + login route ─────────────────────────────────────────

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <AppShell />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

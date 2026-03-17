import { useState, useEffect, useCallback } from 'react';
import { Phone, Bell, LogOut, Menu, X, BarChart3, Users, Settings } from 'lucide-react';

import { useAuth } from './context/AuthContext.jsx';
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

const TAB_LABELS = {
  dashboard: 'Dashboard',
  calls:     'Monitor de Llamadas',
  reports:   'Reportes',
  campaigns: 'Campañas',
  followups: 'Follow Ups',
  projects:  'Proyectos',
  prompts:   'Prompts',
  users:     'Usuarios',
  settings:  'Configuración',
};

export default function App() {
  const { authToken, isLoggedIn, logout } = useAuth();

  // Navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [campaignView, setCampaignView] = useState('list');
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // Global UI
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // Modal state
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);

  // Data
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, pending: 0, failed: 0, avgDuration: 0 });
  const [campaigns, setCampaigns] = useState([]);
  const [campaignContacts, setCampaignContacts] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [followUpStats, setFollowUpStats] = useState({ total: 0, green: 0, orange: 0, red: 0, completed: 0 });

  // --- Helpers ---

  const showToast = useCallback((message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 4000);
  }, []);

  // --- Data loaders ---

  const loadCalls = useCallback(async ({ silent = false } = {}) => {
    if (!authToken) return;
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch('/api/v1/calls/admin/all?skip=0&limit=100', {
        token: authToken,
        onUnauthorized: logout,
      });
      if (res.ok) {
        const data = await res.json();
        setCalls(data);

        const active    = data.filter(c => c.status === 'ringing' || c.status === 'active').length;
        const completed = data.filter(c => c.status === 'completed' || c.status === 'answered').length;
        const pending   = data.filter(c => c.status === 'pending').length;
        const failed    = data.filter(c => c.status === 'failed' || c.status === 'no-answer' || c.status === 'busy').length;
        const withDur   = data.filter(c => c.duration != null && c.duration > 0);
        const avgDuration = withDur.length > 0
          ? Math.round(withDur.reduce((acc, c) => acc + c.duration, 0) / withDur.length)
          : 0;

        setStats({ active, completed, pending, failed, avgDuration });
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') console.error('Error loading calls:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [authToken, logout]);

  const loadCampaigns = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await apiFetch('/api/v1/campaigns?skip=0&limit=100', {
        token: authToken,
        onUnauthorized: logout,
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.map(c => ({
          id:          c.id,
          name:        c.name,
          title:       c.title       || '',
          description: c.description || '',
          projectName: c.project_name || c.project?.name || '',
          status:      c.status,
          contacts:    c.total_contacts  || 0,
          completed:   c.called_contacts || 0,
          pending:     Math.max(0, (c.total_contacts || 0) - (c.called_contacts || 0)),
          created:     c.created_at ? new Date(c.created_at).toLocaleDateString('es-GT') : '-',
        })));
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') console.error('Error loading campaigns:', err);
    }
  }, [authToken, logout]);

  const loadCampaignContacts = useCallback(async (campaignId) => {
    if (!authToken || !campaignId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/campaigns/contacts_by_campaing/${campaignId}`, {
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
      const res = await apiFetch('/api/v1/follow-ups?skip=0&limit=100', {
        token: authToken,
        onUnauthorized: logout,
      });
      if (res.ok) setFollowUps(await res.json());
    } catch (err) {
      if (err.message !== 'Unauthorized') console.error('Error loading follow-ups:', err);
    }
  }, [authToken, logout]);

  const loadFollowUpStats = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await apiFetch('/api/v1/follow-ups/stats', {
        token: authToken,
        onUnauthorized: logout,
      });
      if (res.ok) setFollowUpStats(await res.json());
    } catch (err) {
      if (err.message !== 'Unauthorized') console.error('Error loading follow-up stats:', err);
    }
  }, [authToken, logout]);

  const startCampaign = useCallback(async (campaignId, campaignName) => {
    if (!authToken || !campaignId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/campaigns/${campaignId}/start`, {
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

    // Optimistic update
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
        // Rollback
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

  // Initial data load + 30s polling
  useEffect(() => {
    if (!isLoggedIn || !authToken) return;
    loadCalls();
    loadCampaigns();
    loadFollowUps();
    loadFollowUpStats();
    const interval = setInterval(() => {
      loadCalls({ silent: true });   // sin spinner — refresco en segundo plano
      loadCampaigns();
      loadFollowUps();
      loadFollowUpStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn, authToken]);

  // Load contacts when selected campaign changes
  useEffect(() => {
    if (selectedCampaign?.id && authToken) {
      loadCampaignContacts(selectedCampaign.id);
    }
  }, [selectedCampaign?.id]);

  // Mobile detection
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // --- Handlers ---

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'campaigns') setCampaignView('list');
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const openAnalysis = (call) => { setSelectedCall(call); setShowAnalysisModal(true); };
  const openTranscription = (call) => { setSelectedCall(call); setShowTranscriptionModal(true); };

  // --- Render ---

  if (!isLoggedIn) return <LoginPage />;

  return (
    <div className="min-h-screen bg-gray-50">
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

      {/* Mobile header */}
      <header className="lg:hidden bg-white shadow-sm border-b sticky top-0 z-30 w-full">
        <div className="w-full flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="flex items-center gap-2">
              <Phone className="w-8 h-8 text-blue-600 flex-shrink-0" />
              <div>
                <h1 className="text-xl font-bold text-gray-800">AVR System</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Agent Voice Response</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition">
              <Bell className="w-6 h-6 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <div className="lg:flex">
        <Sidebar
          activeTab={activeTab}
          sidebarOpen={sidebarOpen}
          onTabChange={handleTabChange}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 min-h-screen">
          {/* Desktop header */}
          <header className="hidden lg:block bg-white shadow-sm border-b">
            <div className="flex items-center justify-between px-4 lg:px-8 py-4">
              <h2 className="text-2xl font-bold text-gray-800">{TAB_LABELS[activeTab] || activeTab}</h2>
              <div className="flex items-center gap-4">
                <button className="relative p-2 hover:bg-gray-100 rounded-lg transition">
                  <Bell className="w-6 h-6 text-gray-600" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </button>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <LogOut className="w-5 h-5" />
                  Salir
                </button>
              </div>
            </div>
          </header>

          <main className="p-4 lg:p-8 bg-gray-50 min-h-screen">
            {activeTab === 'dashboard' && (
              <DashboardView
                calls={calls}
                campaigns={campaigns}
                followUps={followUps}
                onRefresh={loadCalls}
              />
            )}

            {activeTab === 'calls' && (
              <CallsMonitorView
                calls={calls}
                loading={loading}
                onRefresh={loadCalls}
                onViewTranscription={openTranscription}
                onViewAnalysis={openAnalysis}
              />
            )}

            {activeTab === 'reports' && (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Módulo de Reportes</h3>
                  <p className="text-gray-500">Próximamente disponible</p>
                </div>
              </div>
            )}

            {activeTab === 'campaigns' && (
              <>
                {campaignView === 'list' && (
                  <CampaignListView
                    campaigns={campaigns}
                    loading={loading}
                    onRefresh={loadCampaigns}
                    onCreateNew={() => setCampaignView('create')}
                    onViewContacts={(campaign) => { setSelectedCampaign(campaign); setCampaignView('contacts'); }}
                    onStartCampaign={startCampaign}
                  />
                )}
                {campaignView === 'create' && (
                  <CreateCampaignView
                    onCancel={() => setCampaignView('list')}
                    onSuccess={() => { loadCampaigns(); setCampaignView('list'); }}
                  />
                )}
                {campaignView === 'contacts' && (
                  <CampaignContactsView
                    campaign={selectedCampaign}
                    contacts={campaignContacts}
                    calls={calls}
                    loading={loading}
                    onBack={() => { setCampaignView('list'); setSelectedCampaign(null); }}
                    onRefresh={() => loadCampaignContacts(selectedCampaign.id)}
                    onViewCallAnalysis={openAnalysis}
                  />
                )}
              </>
            )}

            {activeTab === 'followups' && (
              <FollowUpsView
                followUps={followUps}
                followUpStats={followUpStats}
                isMobile={isMobile}
                onToggleComplete={toggleFollowUpCompletion}
                onRefresh={() => {
                  loadFollowUps();
                  loadFollowUpStats();
                  showToast('Follow-ups actualizados', 'success');
                }}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectsView />
            )}

            {activeTab === 'prompts' && (
              <PromptsView />
            )}

            {activeTab === 'users' && (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Gestión de Usuarios</h3>
                  <p className="text-gray-500">Próximamente disponible</p>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                  <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Configuración</h3>
                  <p className="text-gray-500">Próximamente disponible</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

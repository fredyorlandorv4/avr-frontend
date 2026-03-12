import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Phone, PhoneCall, PhoneOff, Clock, Users, TrendingUp, Activity, Bell, Settings, LogOut, Menu, X, Play, FileText, BarChart3, Target, RefreshCw } from 'lucide-react';

const AVRSystem = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [campaignView, setCampaignView] = useState('list');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [loginError, setLoginError] = useState('');

  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({
    active: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    avgDuration: 0
  });

  const [isMobile, setIsMobile] = useState(false);

  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [selectedCall, setSelectedCallModal] = useState(null);

  const [campaigns, setCampaigns] = useState([]);
  const [campaignContacts, setCampaignContacts] = useState([]);

  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // Follow-ups state
  const [followUps, setFollowUps] = useState([]);
  const [followUpStats, setFollowUpStats] = useState({
    total: 0,
    green: 0,
    orange: 0,
    red: 0,
    completed: 0
  });

  const callsByHour = [
    { hour: '08:00', calls: 12 },
    { hour: '10:00', calls: 25 },
    { hour: '12:00', calls: 18 },
    { hour: '14:00', calls: 30 },
    { hour: '16:00', calls: 22 },
    { hour: '18:00', calls: 15 },
  ];

  const callsByStatus = [
    { name: 'Completadas', value: 145, color: '#10b981' },
    { name: 'Fallidas', value: 23, color: '#ef4444' },
    { name: 'Sin respuesta', value: 12, color: '#f59e0b' },
    { name: 'Ocupado', value: 8, color: '#6366f1' },
  ];

  const handleLogin = async () => {
    if (!username || !password) {
      setLoginError('Por favor ingresa usuario y contraseña');
      return;
    }

    setLoading(true);
    setLoginError('');

    try {
      const response = await fetch('http://10.10.1.26:8000/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          password: password
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Guardar token en localStorage
        localStorage.setItem('authToken', data.access_token);
        localStorage.setItem('username', username);
        setAuthToken(data.access_token);
        setIsLoggedIn(true);
      } else {
        setLoginError(data.detail || 'Usuario o contraseña incorrectos');
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      setLoginError('Error de conexión. Verifica que la API esté corriendo en http://10.10.1.26:8000');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Limpiar localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setAuthToken(null);
    setLoginError('');
    setSidebarOpen(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const loadCalls = async () => {
    if (!authToken) return;

    setLoading(true);
    try {
      const response = await fetch('http://10.10.1.26:8000/api/v1/calls/admin/all?skip=0&limit=100', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCalls(data);

        const activeCount = data.filter(c => c.status === 'ringing' || c.status === 'active').length;
        const completedCount = data.filter(c => c.status === 'completed' || c.status === 'answered').length;
        const pendingCount = data.filter(c => c.status === 'pending').length;
        const failedCount = data.filter(c => c.status === 'failed' || c.status === 'no-answer' || c.status === 'busy').length;

        const callsWithDuration = data.filter(c => c.duration !== null && c.duration > 0);
        const avgDur = callsWithDuration.length > 0 
          ? Math.round(callsWithDuration.reduce((acc, c) => acc + c.duration, 0) / callsWithDuration.length)
          : 0;

        setStats({
          active: activeCount,
          completed: completedCount,
          pending: pendingCount,
          failed: failedCount,
          avgDuration: avgDur
        });
      }
    } catch (error) {
      console.error('Error loading calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    if (!authToken) return;

    try {
      const response = await fetch('http://10.10.1.26:8000/api/v1/campaigns?skip=0&limit=100', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();

        const mappedCampaigns = data.map(campaign => ({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          contacts: campaign.total_contacts || 0,
          completed: campaign.called_contacts || 0,
          pending: Math.max(0, (campaign.total_contacts || 0) - (campaign.called_contacts || 0)),
          created: campaign.created_at ? new Date(campaign.created_at).toLocaleDateString('es-GT') : '-'
        }));

        setCampaigns(mappedCampaigns);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const loadCampaignContacts = async (campaignId) => {
    if (!authToken || !campaignId) return;

    setLoading(true);
    try {
      const response = await fetch(`http://10.10.1.26:8000/api/v1/campaigns/contacts_by_campaing/${campaignId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCampaignContacts(data.contacts || []);
      }
    } catch (error) {
      console.error('Error loading campaign contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load follow-ups from backend
  const loadFollowUps = async () => {
    if (!authToken) return;

    try {
      const response = await fetch('http://10.10.1.26:8000/api/v1/follow-ups?skip=0&limit=100', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFollowUps(data);
      } else {
        console.error('Error loading follow-ups:', response.status);
      }
    } catch (error) {
      console.error('Error loading follow-ups:', error);
    }
  };

  // Load follow-up stats
  const loadFollowUpStats = async () => {
    if (!authToken) return;

    try {
      const response = await fetch('http://10.10.1.26:8000/api/v1/follow-ups/stats', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFollowUpStats(data);
      } else {
        console.error('Error loading follow-up stats:', response.status);
      }
    } catch (error) {
      console.error('Error loading follow-up stats:', error);
    }
  };

  const startCampaign = async (campaignId, campaignName) => {
    if (!authToken || !campaignId) return;

    setLoading(true);
    try {
      const response = await fetch(`http://10.10.1.26:8000/api/v1/campaigns/campaigns/${campaignId}/start-queue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: ''
      });

      if (response.ok) {
        const data = await response.json();

        const statusMessages = {
          'active': 'activa y en ejecución',
          'completed': 'completada',
          'paused': 'pausada',
          'created': 'creada'
        };

        const statusMessage = statusMessages[data.status] || data.status;

        showToast(`¡Campaña "${campaignName}" iniciada exitosamente! Estado: ${statusMessage}`, 'success');

        await loadCampaigns();
      } else {
        const errorData = await response.json();
        showToast(errorData.detail || 'Error al iniciar la campaña', 'error');
      }
    } catch (error) {
      console.error('Error starting campaign:', error);
      showToast('Error de conexión al iniciar la campaña', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: '' });
    }, 4000);
  };

  // Toggle follow-up completion with backend integration
  const toggleFollowUpCompletion = async (followUpId) => {
    const followUp = followUps.find(fu => fu.id === followUpId);
    if (!followUp) return;

    const previousState = followUp.completed;

    // Actualización optimista del UI
    setFollowUps(prevFollowUps => 
      prevFollowUps.map(fu => {
        if (fu.id === followUpId) {
          const newCompleted = !fu.completed;
          return {
            ...fu,
            completed: newCompleted,
            completed_at: newCompleted ? new Date().toISOString() : null
          };
        }
        return fu;
      })
    );

    // Mostrar toast inmediatamente
    showToast(
      previousState 
        ? `Follow-up marcado como pendiente` 
        : `✓ Follow-up completado`,
      previousState ? 'info' : 'success'
    );

    // Actualizar en el backend
    try {
      const response = await fetch(`http://10.10.1.26:8000/api/v1/follow-ups/${followUpId}/complete`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Si falla, revertir el cambio
        setFollowUps(prevFollowUps => 
          prevFollowUps.map(fu => {
            if (fu.id === followUpId) {
              return {
                ...fu,
                completed: previousState,
                completed_at: previousState ? followUp.completed_at : null
              };
            }
            return fu;
          })
        );
        showToast('Error al actualizar el follow-up', 'error');
      } else {
        // Recargar para asegurar sincronización
        await loadFollowUps();
        await loadFollowUpStats();
      }
    } catch (error) {
      console.error('Error toggling follow-up:', error);
      // Revertir en caso de error de red
      setFollowUps(prevFollowUps => 
        prevFollowUps.map(fu => {
          if (fu.id === followUpId) {
            return {
              ...fu,
              completed: previousState,
              completed_at: previousState ? followUp.completed_at : null
            };
          }
          return fu;
        })
      );
      showToast('Error de conexión al actualizar el follow-up', 'error');
    }
  };

  // Verificar si hay token guardado al cargar la aplicación
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    const savedUsername = localStorage.getItem('username');
    
    if (savedToken && savedUsername) {
      setAuthToken(savedToken);
      setUsername(savedUsername);
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && authToken) {
      loadCalls();
      loadCampaigns();
      loadFollowUps();
      loadFollowUpStats();
      const interval = setInterval(() => {
        loadCalls();
        loadCampaigns();
        loadFollowUps();
        loadFollowUpStats();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, authToken]);

  useEffect(() => {
    if (selectedCampaign && selectedCampaign.id && authToken) {
      loadCampaignContacts(selectedCampaign.id);
    }
  }, [selectedCampaign]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = (e) => setIsMobile(e.matches);

    setIsMobile(mq.matches);

    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const TranscriptionModal = () => {
    if (!showTranscriptionModal || !selectedCall) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowTranscriptionModal(false)}>
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Transcripción de Llamada</h3>
              <p className="text-sm text-gray-500 mt-1">ID: {selectedCall.call_id}</p>
            </div>
            <button onClick={() => setShowTranscriptionModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
            {selectedCall.transcription ? (
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedCall.transcription}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="w-12 h-12 text-gray-400 animate-spin mb-4" />
                <p className="text-gray-500">Cargando transcripción...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const Toast = () => {
    if (!toast.show) return null;

    return (
      <div 
        className="fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out transform"
        style={{
          animation: 'slideInRight 0.3s ease-out'
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>
        <div className={`rounded-lg shadow-lg p-4 max-w-md ${
          toast.type === 'success' ? 'bg-green-50 border border-green-200' :
          toast.type === 'error' ? 'bg-red-50 border border-red-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : toast.type === 'error' ? (
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                toast.type === 'success' ? 'text-green-800' :
                toast.type === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {toast.message}
              </p>
            </div>
            <button 
              onClick={() => setToast({ show: false, message: '', type: '' })}
              className="flex-shrink-0 ml-2"
            >
              <X className={`w-4 h-4 ${
                toast.type === 'success' ? 'text-green-600' :
                toast.type === 'error' ? 'text-red-600' :
                'text-blue-600'
              }`} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AnalysisModal = () => {
    if (!showAnalysisModal || !selectedCall) return null;

    const analysis = selectedCall.analysis;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowAnalysisModal(false)}>
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Análisis de Llamada</h3>
              <p className="text-sm text-gray-500 mt-1">ID: {selectedCall.call_id}</p>
            </div>
            <button onClick={() => setShowAnalysisModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
            {analysis ? (
              <div className="space-y-6">
                {analysis.title && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Título</h4>
                    <p className="text-gray-700">{analysis.title}</p>
                  </div>
                )}

                {analysis.summary && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Resumen</h4>
                    <p className="text-gray-700">{analysis.summary}</p>
                  </div>
                )}

                {analysis.sentiment && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Sentimiento</h4>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      analysis.sentiment.includes('positivo') ? 'bg-green-100 text-green-800' :
                      analysis.sentiment.includes('negativo') ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {analysis.sentiment}
                    </span>
                  </div>
                )}

                {analysis.main_points && analysis.main_points.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Puntos Principales</h4>
                    <ul className="list-disc list-inside space-y-2">
                      {analysis.main_points.map((point, index) => (
                        <li key={index} className="text-gray-700">{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.action_items && analysis.action_items.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Acciones a Realizar</h4>
                    <ul className="list-disc list-inside space-y-2">
                      {analysis.action_items.map((item, index) => (
                        <li key={index} className="text-gray-700">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.follow_up && analysis.follow_up.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Seguimiento</h4>
                    <ul className="list-disc list-inside space-y-2">
                      {analysis.follow_up.map((item, index) => (
                        <li key={index} className="text-gray-700">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.supervisor_coaching && (
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Coaching del Supervisor</h4>

                    {analysis.supervisor_coaching.quality_score && (
                      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-700">Puntuación de Calidad</span>
                          <span className="text-2xl font-bold text-blue-600">{analysis.supervisor_coaching.quality_score.score}/100</span>
                        </div>
                        <p className="text-sm text-gray-600">{analysis.supervisor_coaching.quality_score.rationale}</p>
                      </div>
                    )}

                    {analysis.supervisor_coaching.strengths && analysis.supervisor_coaching.strengths.length > 0 && (
                      <div className="mb-4">
                        <h5 className="font-medium text-green-700 mb-2">Fortalezas</h5>
                        <ul className="list-disc list-inside space-y-1">
                          {analysis.supervisor_coaching.strengths.map((item, index) => (
                            <li key={index} className="text-gray-700 text-sm">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysis.supervisor_coaching.areas_for_improvement && analysis.supervisor_coaching.areas_for_improvement.length > 0 && (
                      <div className="mb-4">
                        <h5 className="font-medium text-orange-700 mb-2">Áreas de Mejora</h5>
                        <ul className="list-disc list-inside space-y-1">
                          {analysis.supervisor_coaching.areas_for_improvement.map((item, index) => (
                            <li key={index} className="text-gray-700 text-sm">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="w-12 h-12 text-gray-400 animate-spin mb-4" />
                <p className="text-gray-500">Cargando análisis...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!isLoggedIn) {
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
                <label className="block text-sm font-medium text-blue-100 mb-2">
                  Usuario
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Ingresa tu usuario"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-100 mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
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

  const DashboardView = () => (
    <div className="w-full mx-auto space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <PhoneCall className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-2xl font-bold text-green-600">{stats.active}</span>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Llamadas Activas</h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Phone className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-blue-600">{stats.completed}</span>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Completadas Hoy</h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-50 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-2xl font-bold text-yellow-600">{stats.pending}</span>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Pendientes</h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <PhoneOff className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-2xl font-bold text-red-600">{stats.failed}</span>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Fallidas</h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-2xl font-bold text-purple-600">{stats.avgDuration}s</span>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Duración Promedio</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Llamadas por Hora</h3>
            <button onClick={loadCalls} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={callsByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Bar dataKey="calls" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribución por Estado</h3>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={callsByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={!isMobile}
                  label={
                    isMobile
                      ? false
                      : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={isMobile ? 60 : 80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {callsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Actividad Reciente</h3>
        <div className="overflow-x-auto -mx-6 px-6">
          {calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Phone className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500">No hay llamadas registradas</p>
            </div>
          ) : (
            <>
              <div className="sm:hidden space-y-3">
                {calls.slice(0, 5).map((call) => {
                  const statusLabel = call.status === 'ringing' || call.status === 'active' ? 'Activa' :
                                     call.status === 'answered' || call.status === 'completed' ? 'Completada' :
                                     call.status === 'pending' ? 'Pendiente' : 'Fallida';
                  const statusColor = (call.status === 'ringing' || call.status === 'active') ? 'bg-green-100 text-green-800' :
                                     (call.status === 'answered' || call.status === 'completed') ? 'bg-blue-100 text-blue-800' :
                                     call.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                     'bg-red-100 text-red-800';

                  return (
                    <div key={call.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{call.destination}</p>
                          <p className="text-xs text-gray-500 truncate">ID: {call.call_id}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">Duración</p>
                          <p className="text-sm font-medium text-gray-800">{call.duration ? `${call.duration}s` : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Hora</p>
                          <p className="text-sm font-medium text-gray-800">
                            {call.created_at ? new Date(call.created_at).toLocaleString('es-GT') : '-'}
                          </p>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          setSelectedCallModal(call);
                          setShowAnalysisModal(true);
                        }}
                        className="mt-4 w-full text-center px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium"
                      >
                        Ver detalles
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Teléfono</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Duración</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Hora</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.slice(0, 5).map((call) => {
                      const statusLabel = call.status === 'ringing' || call.status === 'active' ? 'Activa' :
                                         call.status === 'answered' || call.status === 'completed' ? 'Completada' :
                                         call.status === 'pending' ? 'Pendiente' : 'Fallida';
                      const statusColor = (call.status === 'ringing' || call.status === 'active') ? 'bg-green-100 text-green-800' :
                                         (call.status === 'answered' || call.status === 'completed') ? 'bg-blue-100 text-blue-800' :
                                         call.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                         'bg-red-100 text-red-800';

                      return (
                        <tr key={call.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="py-3 px-4 text-sm text-gray-800">{call.destination}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-800">{call.duration ? `${call.duration}s` : 'N/A'}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            {call.created_at ? new Date(call.created_at).toLocaleString('es-GT') : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <button 
                              onClick={() => {
                                setSelectedCallModal(call);
                                setShowAnalysisModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Ver detalles
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const CallsMonitorView = () => {
    const getStatusLabel = (status) => {
      const statusMap = {
        'ringing': 'Timbrando',
        'answered': 'Contestada',
        'completed': 'Completada',
        'active': 'Activa',
        'pending': 'Pendiente',
        'failed': 'Fallida',
        'no-answer': 'Sin respuesta',
        'busy': 'Ocupado'
      };
      return statusMap[status] || status;
    };

    const getStatusColor = (status) => {
      if (status === 'ringing' || status === 'active') return 'bg-green-100 text-green-800';
      if (status === 'answered' || status === 'completed') return 'bg-blue-100 text-blue-800';
      if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
      return 'bg-red-100 text-red-800';
    };

    const getStatusIconColor = (status) => {
      if (status === 'ringing' || status === 'active') return 'bg-green-100 text-green-600';
      if (status === 'answered' || status === 'completed') return 'bg-blue-100 text-blue-600';
      if (status === 'pending') return 'bg-yellow-100 text-yellow-600';
      return 'bg-red-100 text-red-600';
    };

    return (
      <div className="w-full mx-auto space-y-6">
        <div className="w-full bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Monitor de Llamadas</h2>
            <button onClick={loadCalls} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <select className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Todos los estados</option>
              <option>Activas</option>
              <option>Completadas</option>
              <option>Pendientes</option>
              <option>Fallidas</option>
            </select>
            <input
              type="date"
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-12 h-12 text-gray-400 animate-spin mb-4" />
              <p className="text-gray-500">Cargando llamadas...</p>
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Phone className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-500">No hay llamadas registradas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {calls.map((call) => (
                <div key={call.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full flex-shrink-0 ${getStatusIconColor(call.status)}`}>
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{call.destination}</p>
                        <p className="text-sm text-gray-500">Desde: {call.caller_id}</p>
                        <p className="text-xs text-gray-400">ID: {call.call_id}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium self-start sm:self-auto ${getStatusColor(call.status)}`}>
                      {getStatusLabel(call.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Duración</p>
                      <p className="text-sm font-medium text-gray-800">{call.duration ? `${call.duration}s` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Hora Inicio</p>
                      <p className="text-sm font-medium text-gray-800">
                        {call.created_at ? new Date(call.created_at).toLocaleString('es-GT') : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => {
                        setSelectedCallModal(call);
                        setShowTranscriptionModal(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition"
                    >
                      <FileText className="w-4 h-4" />
                      Transcripción
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedCallModal(call);
                        setShowAnalysisModal(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Análisis
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const CampaignListView = () => (
    <div className="w-full mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Mis Campañas</h2>
        <div className="flex gap-2">
          <button 
            onClick={loadCampaigns}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          <button 
            onClick={() => setCampaignView('create')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Target className="w-4 h-4" />
            Nueva Campaña
          </button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <Target className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-gray-500 mb-2">No hay campañas disponibles</p>
          <p className="text-sm text-gray-400">Crea tu primera campaña para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">{campaign.name}</h3>
                    <p className="text-sm text-gray-500">Creada: {campaign.created}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                    campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                    campaign.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                    campaign.status === 'created' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {campaign.status === 'active' ? 'Activa' : 
                     campaign.status === 'paused' ? 'Pausada' : 
                     campaign.status === 'completed' ? 'Finalizada' :
                     campaign.status === 'created' ? 'Creada' :
                     campaign.status}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Contactos</span>
                    <span className="text-sm font-semibold text-gray-800">{campaign.contacts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Completadas</span>
                    <span className="text-sm font-semibold text-green-600">{campaign.completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Pendientes</span>
                    <span className="text-sm font-semibold text-yellow-600">{campaign.pending}</span>
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${campaign.contacts > 0 ? (campaign.completed / campaign.contacts) * 100 : 0}%` }}
                  ></div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setSelectedCampaign(campaign);
                      setCampaignView('contacts');
                    }}
                    className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                  >
                    Ver Contactos
                  </button>
                  {campaign.status !== 'active' && (
                    <button 
                      onClick={() => startCampaign(campaign.id, campaign.name)}
                      disabled={loading}
                      className="flex items-center justify-center gap-1 px-3 py-2 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="w-4 h-4" />
                      Iniciar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const CreateCampaignView = () => {
    const [campaignName, setCampaignName] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');

    const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const validTypes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel'
        ];

        if (validTypes.includes(file.type)) {
          setSelectedFile(file);
          setUploadError('');
        } else {
          setUploadError('Formato de archivo no válido. Solo se aceptan archivos Excel (.xlsx, .xls)');
          setSelectedFile(null);
        }
      }
    };

    const handleUploadCampaign = async () => {
      if (!campaignName.trim()) {
        setUploadError('Por favor ingresa un nombre para la campaña');
        return;
      }

      if (!selectedFile) {
        setUploadError('Por favor selecciona un archivo Excel con los contactos');
        return;
      }

      setUploadLoading(true);
      setUploadError('');
      setUploadSuccess('');

      try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await fetch(`http://10.10.1.26:8000/api/v1/campaigns/upload?campaign_name=${encodeURIComponent(campaignName)}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
          body: formData
        });

        const data = await response.json();

        if (response.ok) {
          setUploadSuccess(`¡Campaña creada exitosamente! Se cargaron ${data.contacts_loaded} contactos.`);

          if (data.errors && data.errors.length > 0) {
            setUploadError(`Advertencias: ${data.errors.join(', ')}`);
          }

          await loadCampaigns();

          setTimeout(() => {
            setCampaignView('list');
            setCampaignName('');
            setSelectedFile(null);
            setUploadSuccess('');
            setUploadError('');
          }, 2000);
        } else {
          setUploadError(data.detail || 'Error al crear la campaña. Por favor intenta nuevamente.');
        }
      } catch (error) {
        console.error('Error uploading campaign:', error);
        setUploadError('Error de conexión. Verifica que la API esté corriendo.');
      } finally {
        setUploadLoading(false);
      }
    };

    return (
      <div className="w-full space-y-6">
        <div className="mb-6">
          <button 
            onClick={() => {
              setCampaignView('list');
              setCampaignName('');
              setSelectedFile(null);
              setUploadError('');
              setUploadSuccess('');
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition"
            disabled={uploadLoading}
          >
            <X className="w-4 h-4" />
            Volver a Campañas
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 lg:p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Crear Nueva Campaña</h2>

          {uploadSuccess && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-green-800 font-medium">{uploadSuccess}</p>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-red-800 text-sm">{uploadError}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de la Campaña *
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                disabled={uploadLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Ej: Campaña Navideña 2024"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cargar Lista de Contactos (Excel) *
              </label>
              <div className={`border-2 border-dashed rounded-lg p-6 sm:p-12 text-center transition ${
                selectedFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-500'
              } ${uploadLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input 
                  type="file" 
                  className="hidden" 
                  id="file-upload" 
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={uploadLoading}
                />
                <label htmlFor="file-upload" className={uploadLoading ? 'cursor-not-allowed' : 'cursor-pointer'}>
                  {selectedFile ? (
                    <>
                      <FileText className="w-10 h-10 sm:w-16 sm:h-16 text-green-600 mx-auto mb-4" />
                      <p className="text-base text-green-700 font-medium mb-2">
                        Archivo seleccionado: {selectedFile.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        Tamaño: {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                      {!uploadLoading && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedFile(null);
                            document.getElementById('file-upload').value = '';
                          }}
                          className="mt-3 text-sm text-red-600 hover:text-red-800"
                        >
                          Eliminar archivo
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <FileText className="w-10 h-10 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-base text-gray-600 mb-2">
                        Haz clic para cargar o arrastra el archivo aquí
                      </p>
                      <p className="text-sm text-gray-500">
                        Formato soportado: Excel (.xlsx, .xls)
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <button 
              onClick={handleUploadCampaign}
              disabled={uploadLoading || !campaignName || !selectedFile}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploadLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Cargando campaña...
                </>
              ) : (
                'Crear Campaña'
              )}
            </button>
            <button 
              onClick={() => {
                setCampaignView('list');
                setCampaignName('');
                setSelectedFile(null);
                setUploadError('');
                setUploadSuccess('');
              }}
              disabled={uploadLoading}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CampaignContactsView = () => {
    if (!selectedCampaign) return null;

    return (
      <div className="w-full mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button 
              onClick={() => {
                setCampaignView('list');
                setSelectedCampaign(null);
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition mb-2"
            >
              <X className="w-4 h-4" />
              Volver a Campañas
            </button>
            <h2 className="text-2xl font-bold text-gray-800">{selectedCampaign.name}</h2>
            <p className="text-sm text-gray-500">Contactos de la campaña</p>
          </div>
          <button 
            onClick={() => loadCampaignContacts(selectedCampaign.id)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-600 mb-1">Total</p>
            <p className="text-2xl font-bold text-gray-800">{selectedCampaign.contacts}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-600 mb-1">Completadas</p>
            <p className="text-2xl font-bold text-green-600">{selectedCampaign.completed}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-600 mb-1">Pendientes</p>
            <p className="text-2xl font-bold text-yellow-600">{selectedCampaign.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <p className="text-sm text-gray-600 mb-1">Progreso</p>
            <p className="text-2xl font-bold text-blue-600">
              {selectedCampaign.contacts > 0 ? Math.round((selectedCampaign.completed / selectedCampaign.contacts) * 100) : 0}%
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <input
                type="text"
                placeholder="Buscar por nombre o teléfono..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Todos los estados</option>
                <option>Completadas</option>
                <option>Pendientes</option>
              </select>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="w-12 h-12 text-gray-400 animate-spin mb-4" />
                <p className="text-gray-500">Cargando contactos...</p>
              </div>
            ) : campaignContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No hay contactos en esta campaña</p>
              </div>
            ) : (
              <>
                <div className="sm:hidden space-y-3">
                  {campaignContacts.map((contact) => (
                    <div key={contact.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{contact.cliente}</p>
                          <p className="text-xs text-gray-500 truncate">{contact.telefono}</p>
                          <p className="text-xs text-gray-400 truncate">Lote: {contact.lote || '-'}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          contact.called === 1 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {contact.called === 1 ? 'Llamado' : 'Pendiente'}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">Total</p>
                          <p className="text-sm font-medium text-gray-800">
                            Q{contact.total ? contact.total.toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Llamada</p>
                          <p className="text-sm font-medium text-gray-800">{contact.call_id ? `#${contact.call_id}` : '-'}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        {contact.call_id ? (
                          <button 
                            onClick={async () => {
                              const call = calls.find(c => c.id === contact.call_id);
                              if (call) {
                                setSelectedCallModal(call);
                                setShowAnalysisModal(true);
                              }
                            }}
                            className="w-full px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium"
                          >
                            Ver llamada
                          </button>
                        ) : (
                          <div className="w-full px-3 py-2 text-sm bg-gray-50 text-gray-400 rounded-lg text-center">
                            Sin llamada
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full min-w-[980px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Lote</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Cliente</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Teléfono</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Total</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Llamada</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignContacts.map((contact) => (
                        <tr key={contact.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="py-3 px-4 text-sm font-medium text-gray-800">{contact.lote || '-'}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{contact.cliente}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{contact.telefono}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              contact.called === 1 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {contact.called === 1 ? 'Llamado' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            Q{contact.total ? contact.total.toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '0.00'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            {contact.call_id ? `#${contact.call_id}` : '-'}
                          </td>
                          <td className="py-3 px-4">
                            {contact.call_id ? (
                              <button 
                                onClick={async () => {
                                  const call = calls.find(c => c.id === contact.call_id);
                                  if (call) {
                                    setSelectedCallModal(call);
                                    setShowAnalysisModal(true);
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Ver llamada
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">Sin llamada</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Follow Ups View - Sistema de 4 Estados
  const FollowUpsView = () => {
    // Clasificar follow-ups según status
    const greenFollowUps = followUps.filter(fu => fu.status === 'green' && !fu.completed);
    const orangeFollowUps = followUps.filter(fu => fu.status === 'orange' && !fu.completed);
    const redFollowUps = followUps.filter(fu => fu.status === 'red' && !fu.completed);
    const completedFollowUps = followUps.filter(fu => fu.completed);

    const FollowUpCard = ({ followUp, borderColor, bgColor }) => {
      const scheduledDate = new Date(followUp.scheduled_date);
      
      // Dividir notes por el pipe "|"
      const notesParts = followUp.notes.split('|');
      const title = notesParts[0]?.trim() || '';
      const description = notesParts[1]?.trim() || notesParts[0]?.trim() || '';

      return (
        <div className={`bg-white rounded-lg border-l-4 ${borderColor} shadow-sm hover:shadow-md transition p-4`}>
          <div className="flex items-start gap-3 mb-3">
            <input
              type="checkbox"
              checked={followUp.completed}
              onChange={() => toggleFollowUpCompletion(followUp.id)}
              className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
                  ID: #{followUp.id}
                </span>
                {followUp.call_id && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Llamada #{followUp.call_id}
                  </span>
                )}
              </div>

              {notesParts.length > 1 ? (
                <>
                  <h4 className={`font-semibold text-base mb-2 ${followUp.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {title}
                  </h4>
                  <p className={`text-sm mb-3 ${followUp.completed ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                    {description}
                  </p>
                </>
              ) : (
                <p className={`text-sm mb-3 ${followUp.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {followUp.notes}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {followUp.completed ? (
                    <span>Completado: {new Date(followUp.completed_at).toLocaleDateString('es-GT')}</span>
                  ) : (
                    <span>
                      Programado: {scheduledDate.toLocaleDateString('es-GT')}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  Creado: {new Date(followUp.created_at).toLocaleDateString('es-GT')}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="w-full mx-auto space-y-6">
        {/* Header con botón de actualizar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Seguimiento de Follow Ups</h2>
            <p className="text-sm text-gray-500 mt-1">Sistema de gestión por estado</p>
          </div>
          <button 
            onClick={() => {
              loadFollowUps();
              loadFollowUpStats();
              showToast('Follow-ups actualizados', 'success');
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Pendientes</h3>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <p className="text-3xl font-bold text-green-600">{followUpStats.green}</p>
            <p className="text-xs text-gray-500 mt-1">En tiempo</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Pronto a Vencer</h3>
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            </div>
            <p className="text-3xl font-bold text-orange-600">{followUpStats.orange}</p>
            <p className="text-xs text-gray-500 mt-1">Requieren atención</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Vencidos</h3>
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
            </div>
            <p className="text-3xl font-bold text-red-600">{followUpStats.red}</p>
            <p className="text-xs text-gray-500 mt-1">Urgente</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Completados</h3>
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            </div>
            <p className="text-3xl font-bold text-blue-600">{followUpStats.completed}</p>
            <p className="text-xs text-gray-500 mt-1">Finalizados</p>
          </div>
        </div>

        {/* Vista Desktop - 4 Columnas */}
        <div className="hidden lg:grid lg:grid-cols-4 gap-6">
          {/* Columna Verde - Pendientes */}
          <div className="space-y-4">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <h3 className="font-bold text-green-800">PENDIENTES</h3>
              </div>
              <p className="text-sm text-green-700">{greenFollowUps.length} en tiempo</p>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {greenFollowUps.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">No hay follow-ups pendientes</p>
                </div>
              ) : (
                greenFollowUps.map(fu => (
                  <FollowUpCard 
                    key={fu.id} 
                    followUp={fu} 
                    borderColor="border-green-500"
                    bgColor="bg-green-100 text-green-800"
                  />
                ))
              )}
            </div>
          </div>

          {/* Columna Naranja - Pronto a Vencer */}
          <div className="space-y-4">
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <h3 className="font-bold text-orange-800">PRONTO A VENCER</h3>
              </div>
              <p className="text-sm text-orange-700">{orangeFollowUps.length} requieren atención</p>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {orangeFollowUps.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">No hay follow-ups próximos a vencer</p>
                </div>
              ) : (
                orangeFollowUps.map(fu => (
                  <FollowUpCard 
                    key={fu.id} 
                    followUp={fu} 
                    borderColor="border-orange-500"
                    bgColor="bg-orange-100 text-orange-800"
                  />
                ))
              )}
            </div>
          </div>

          {/* Columna Roja - Vencidos */}
          <div className="space-y-4">
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <h3 className="font-bold text-red-800">VENCIDOS</h3>
              </div>
              <p className="text-sm text-red-700">{redFollowUps.length} urgentes</p>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {redFollowUps.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">No hay follow-ups vencidos</p>
                </div>
              ) : (
                redFollowUps.map(fu => (
                  <FollowUpCard 
                    key={fu.id} 
                    followUp={fu} 
                    borderColor="border-red-500"
                    bgColor="bg-red-100 text-red-800"
                  />
                ))
              )}
            </div>
          </div>

          {/* Columna Azul - Completados */}
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <h3 className="font-bold text-blue-800">COMPLETADOS</h3>
              </div>
              <p className="text-sm text-blue-700">{completedFollowUps.length} finalizados</p>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {completedFollowUps.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">No hay follow-ups completados</p>
                </div>
              ) : (
                completedFollowUps.map(fu => (
                  <FollowUpCard 
                    key={fu.id} 
                    followUp={fu} 
                    borderColor="border-blue-500"
                    bgColor="bg-blue-100 text-blue-800"
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Vista Mobile - Apilado */}
        <div className="lg:hidden space-y-6">
          {/* Pendientes */}
          <div className="space-y-3">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <h3 className="font-bold text-green-800">PENDIENTES ({greenFollowUps.length})</h3>
              </div>
              <p className="text-sm text-green-700">En tiempo</p>
            </div>
            {greenFollowUps.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No hay follow-ups pendientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {greenFollowUps.map(fu => (
                  <FollowUpCard 
                    key={fu.id} 
                    followUp={fu} 
                    borderColor="border-green-500"
                    bgColor="bg-green-100 text-green-800"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pronto a Vencer */}
          <div className="space-y-3">
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <h3 className="font-bold text-orange-800">PRONTO A VENCER ({orangeFollowUps.length})</h3>
              </div>
              <p className="text-sm text-orange-700">Requieren atención</p>
            </div>
            {orangeFollowUps.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No hay follow-ups próximos a vencer</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orangeFollowUps.map(fu => (
                  <FollowUpCard 
                    key={fu.id} 
                    followUp={fu} 
                    borderColor="border-orange-500"
                    bgColor="bg-orange-100 text-orange-800"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Vencidos */}
          <div className="space-y-3">
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <h3 className="font-bold text-red-800">VENCIDOS ({redFollowUps.length})</h3>
              </div>
              <p className="text-sm text-red-700">Urgentes</p>
            </div>
            {redFollowUps.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No hay follow-ups vencidos</p>
              </div>
            ) : (
              <div className="space-y-3">
                {redFollowUps.map(fu => (
                  <FollowUpCard 
                    key={fu.id} 
                    followUp={fu} 
                    borderColor="border-red-500"
                    bgColor="bg-red-100 text-red-800"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Completados */}
          <div className="space-y-3">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <h3 className="font-bold text-blue-800">COMPLETADOS ({completedFollowUps.length})</h3>
              </div>
              <p className="text-sm text-blue-700">Finalizados</p>
            </div>
            {completedFollowUps.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No hay follow-ups completados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedFollowUps.map(fu => (
                  <FollowUpCard 
                    key={fu.id} 
                    followUp={fu} 
                    borderColor="border-blue-500"
                    bgColor="bg-blue-100 text-blue-800"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TranscriptionModal />
      <AnalysisModal />
      <Toast />

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
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <div className="lg:flex">
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        <aside className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:static top-0 left-0 h-screen w-64 bg-white border-r shadow-lg lg:shadow-none transition-transform duration-300 z-30 overflow-y-auto overscroll-contain`}>
          <div className="hidden lg:flex items-center gap-2 p-6 border-b">
            <Phone className="w-8 h-8 text-blue-600 flex-shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">AVR System</h1>
              <p className="text-xs text-gray-500">Agent Voice Response</p>
            </div>
          </div>

          <nav className="p-4 space-y-2 lg:pt-0 pt-20 pb-8">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                closeSidebarOnMobile();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Activity className="w-5 h-5 flex-shrink-0" />
              Dashboard
            </button>
            <button
              onClick={() => {
                setActiveTab('calls');
                closeSidebarOnMobile();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                activeTab === 'calls' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Phone className="w-5 h-5 flex-shrink-0" />
              Monitor de Llamadas
            </button>
            <button
              onClick={() => {
                setActiveTab('reports');
                closeSidebarOnMobile();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                activeTab === 'reports' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <BarChart3 className="w-5 h-5 flex-shrink-0" />
              Reportes
            </button>
            <button
              onClick={() => {
                setActiveTab('campaigns');
                setCampaignView('list');
                closeSidebarOnMobile();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                activeTab === 'campaigns' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Target className="w-5 h-5 flex-shrink-0" />
              Campañas
            </button>
            <button
              onClick={() => {
                setActiveTab('followups');
                closeSidebarOnMobile();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                activeTab === 'followups' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Clock className="w-5 h-5 flex-shrink-0" />
              Follow Ups
            </button>
            <button
              onClick={() => {
                setActiveTab('users');
                closeSidebarOnMobile();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                activeTab === 'users' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users className="w-5 h-5 flex-shrink-0" />
              Usuarios
            </button>
            <button
              onClick={() => {
                setActiveTab('settings');
                closeSidebarOnMobile();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              Configuración
            </button>
          </nav>
        </aside>

        <div className="flex-1 min-h-screen">
          <header className="hidden lg:block bg-white shadow-sm border-b">
            <div className="flex items-center justify-between px-4 lg:px-8 py-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'calls' && 'Monitor de Llamadas'}
                {activeTab === 'reports' && 'Reportes'}
                {activeTab === 'campaigns' && 'Campañas'}
                {activeTab === 'followups' && 'Follow Ups'}
                {activeTab === 'users' && 'Usuarios'}
                {activeTab === 'settings' && 'Configuración'}
              </h2>

              <div className="flex items-center gap-4">
                <button className="relative p-2 hover:bg-gray-100 rounded-lg transition">
                  <Bell className="w-6 h-6 text-gray-600" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Salir</span>
                </button>
              </div>
            </div>
          </header>

          <main className="p-4 lg:p-8 bg-gray-50 min-h-screen">
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'calls' && <CallsMonitorView />}
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
                {campaignView === 'list' && <CampaignListView />}
                {campaignView === 'create' && <CreateCampaignView />}
                {campaignView === 'contacts' && <CampaignContactsView />}
              </>
            )}
            {activeTab === 'followups' && <FollowUpsView />}
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
};

export default AVRSystem;

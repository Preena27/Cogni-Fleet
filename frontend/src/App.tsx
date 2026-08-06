import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  MapPin, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  Settings, 
  Bell, 
  Sun, 
  Moon, 
  User as UserIcon, 
  ChevronRight, 
  Search, 
  Database, 
  Layers,
  ClipboardCheck,
  ChevronDown,
  Navigation,
  MessageSquare,
  Sparkles,
  Zap
} from 'lucide-react';
import { Trip, Driver, Vehicle, Warehouse, ProofOfDelivery, Invoice, Alert, AutomationLog } from './types';

// Establish API URL
const API_BASE = 'http://localhost:8000/api';
const WS_BASE = 'ws://localhost:8000/ws';

// Global Context Definition
interface AppContextType {
  role: 'manager' | 'driver';
  setRole: (role: 'manager' | 'driver') => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  trips: Trip[];
  drivers: Driver[];
  vehicles: Vehicle[];
  warehouses: Warehouse[];
  invoices: Invoice[];
  pods: ProofOfDelivery[];
  alerts: Alert[];
  automationLogs: AutomationLog[];
  refreshData: (module: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addToast: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (login: boolean) => void;
  currentUser: any;
  setCurrentUser: (user: any) => void;
  handleSignOut: () => void;
  secureFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};

// Toast notification helper state
interface Toast {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

// Sub-pages are imported here (we will create them next)
import Dashboard from './pages/Dashboard';
import LoadsModule from './pages/LoadsModule';
import DispatchBoard from './pages/DispatchBoard';
import TrackingMap from './pages/TrackingMap';
import FleetModule from './pages/FleetModule';
import DriverModule from './pages/DriverModule';
import WarehouseModule from './pages/WarehouseModule';
import PODModule from './pages/PODModule';
import BillingModule from './pages/BillingModule';
import ReportsModule from './pages/ReportsModule';
import SettingsModule from './pages/SettingsModule';
import DriverApp from './pages/DriverApp';
import AIAssistant from './components/AIAssistant';
import LoginPage from './pages/LoginPage';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<'manager' | 'driver'>(() => {
    return (localStorage.getItem("role") as 'manager' | 'driver') || 'manager';
  });
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return !!localStorage.getItem("token");
  });
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const user = localStorage.getItem("username");
    const roleVal = localStorage.getItem("role");
    return user ? { username: user, role: roleVal } : null;
  });
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pods, setPods] = useState<ProofOfDelivery[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const addToast = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = toastIdRef.current++;
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const secureFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    } as any;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      // Automatic signout on token expiry
      localStorage.clear();
      setIsLoggedIn(false);
    }
    return res;
  };

  // Data fetching functions using secureFetch
  const fetchData = async (endpoint: string, setter: Function) => {
    try {
      const res = await secureFetch(`${API_BASE}/${endpoint}`);
      if (res.ok) {
        const data = await res.json();
        setter(data);
        if (endpoint === 'drivers' && localStorage.getItem("userRole") === 'driver' && Array.isArray(data) && data.length > 0) {
          localStorage.setItem("driverId", String(data[0].id));
        }
      }
    } catch (e) {
      console.error(`Failed to fetch ${endpoint}:`, e);
    }
  };

  const refreshData = async (module: string) => {
    switch (module) {
      case 'trips': await fetchData('trips', setTrips); break;
      case 'drivers': await fetchData('drivers', setDrivers); break;
      case 'vehicles': await fetchData('vehicles', setVehicles); break;
      case 'warehouses': await fetchData('warehouses', setWarehouses); break;
      case 'invoices': await fetchData('invoices', setInvoices); break;
      case 'pods': await fetchData('pods', setPods); break;
      case 'alerts': await fetchData('alerts', setAlerts); break;
      case 'automation-logs': await fetchData('automation-logs', setAutomationLogs); break;
    }
  };

  const refreshAll = async () => {
    if (!isLoggedIn) return;
    await Promise.all([
      fetchData('trips', setTrips),
      fetchData('drivers', setDrivers),
      fetchData('vehicles', setVehicles),
      fetchData('warehouses', setWarehouses),
      fetchData('invoices', setInvoices),
      fetchData('pods', setPods),
      fetchData('alerts', setAlerts),
      fetchData('automation-logs', setAutomationLogs),
    ]);
  };

  // Setup WebSockets and Load Initial Data
  useEffect(() => {
    if (!isLoggedIn) return;
    refreshAll();

    let ws: WebSocket;
    const connectWS = () => {
      ws = new WebSocket(WS_BASE);
      
      ws.onopen = () => {
        console.log("WebSocket connected to FastAPI");
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("WS message received:", data);

        if (data.type === 'REFRESH_DATA') {
          refreshData(data.module);
        } else if (data.type === 'AUTOMATION_LOG') {
          // Toast filtering by manager/driver scoping
          const userIdStr = localStorage.getItem("userId");
          const userId = userIdStr ? parseInt(userIdStr) : null;
          const userRole = localStorage.getItem("userRole");

          if (userRole === 'manager') {
            if (data.log.manager_id && data.log.manager_id !== userId) {
              return; // ignore log for different managers
            }
          } else if (userRole === 'driver') {
            const driverIdStr = localStorage.getItem("driverId");
            const driverId = driverIdStr ? parseInt(driverIdStr) : null;
            if (driverId) {
              if (data.log.driver_id && data.log.driver_id !== driverId) {
                return; // ignore log for different drivers
              }
            } else {
              return;
            }
          } else {
            return;
          }

          // Add to log state
          setAutomationLogs(prev => [data.log, ...prev]);
          
          // Toast Notification trigger
          let toastType: 'info' | 'success' | 'warning' | 'error' = 'info';
          if (data.log.status === 'Failed') toastType = 'error';
          else if (data.log.trigger_event === 'Breakdown') toastType = 'error';
          else if (data.log.trigger_event === 'Trip Completed') toastType = 'success';
          
          addToast(data.log.trigger_event, `${data.log.pipeline_step}: ${data.log.details}`, toastType);
          
          // Auto-sync everything when pipeline processes complete
          refreshAll();
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, retrying in 3s...");
        setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("WS connection error:", err);
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
    };
  }, [isLoggedIn]);

  // Theme application
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleSignOut = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setCurrentUser(null);
    addToast("Signed Out", "Session ended. Relog to access CogniFleet.", "info");
  };

  return (
    <AppContext.Provider value={{
      role, setRole,
      darkMode, setDarkMode,
      trips, drivers, vehicles, warehouses, invoices, pods, alerts, automationLogs,
      refreshData, refreshAll,
      searchQuery, setSearchQuery,
      addToast,
      isLoggedIn, setIsLoggedIn,
      currentUser, setCurrentUser,
      handleSignOut,
      secureFetch
    }}>
      {children}

      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-3 max-w-md w-full">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`p-4 rounded-xl shadow-soft-lg flex items-start gap-3 border animate-bounce-short transition-all ${
              toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' :
              toast.type === 'error' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300' :
              toast.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-850 text-amber-850 dark:text-amber-300' :
              'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
            }`}
          >
            <div className="flex-1">
              <div className="font-semibold text-sm flex items-center gap-1.5 font-sans">
                <Zap className="w-4 h-4 text-primary-500 animate-pulse" />
                {toast.title}
              </div>
              <p className="text-xs mt-1 leading-relaxed opacity-90">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
};

// Sub-Component: App Layout Shell
const AppLayout: React.FC = () => {
  const { role, setRole, darkMode, setDarkMode, alerts, refreshAll, addToast, isLoggedIn, currentUser, handleSignOut, drivers } = useAppContext();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  if (!isLoggedIn) {
    return <LoginPage />;
  }

  if (role === 'driver') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans">
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40 shadow-soft-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold tracking-tight">
              CF
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-slate-800 dark:text-slate-100">CogniFleet Driver</span>
              <span className="text-[10px] block font-semibold uppercase tracking-wider text-emerald-500 -mt-1">Operator Console</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Welcome, {currentUser?.username}</span>
            <button 
              onClick={handleSignOut}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer text-slate-600 dark:text-slate-350"
            >
              Sign Out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4">
          <DriverApp />
        </main>
      </div>
    );
  }

  const handleRoleChange = (newRole: 'manager' | 'driver') => {
    setRole(newRole);
    if (newRole === 'driver') {
      navigate('/driver-app');
    } else {
      navigate('/');
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, managerOnly: true },
    { path: '/loads', label: 'Loads & Orders', icon: Layers, managerOnly: true },
    { path: '/dispatch', label: 'Dispatch Board', icon: ClipboardCheck, managerOnly: true },
    { path: '/map', label: 'Routes & Tracking', icon: MapPin, managerOnly: true },
    { path: '/fleet', label: 'Fleet Management', icon: Truck, managerOnly: true },
    { path: '/drivers', label: 'Driver Directory', icon: Users, managerOnly: true },
    { path: '/pod', label: 'Proof of Delivery', icon: ClipboardCheck, managerOnly: true },
    { path: '/billing', label: 'Invoices & Billing', icon: DollarSign, managerOnly: true },
    { path: '/reports', label: 'Reports & Analytics', icon: TrendingUp, managerOnly: true },
    { path: '/settings', label: 'Settings', icon: Settings, managerOnly: false },
  ];

  const activeAlertCount = alerts.filter(a => !a.resolved && a.severity !== 'Resolved').length;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* 1. Sidebar Nav */}
      <aside className="w-64 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Brand */}
          <div className="h-16 flex items-center px-6 gap-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white font-bold font-sans tracking-tight shadow-md glow-primary">
              CF
            </div>
            <div>
              <span className="font-bold text-base font-sans tracking-tight text-slate-800 dark:text-slate-100">CogniFleet</span>
              <span className="text-[10px] block font-medium uppercase tracking-wider text-primary-500 font-sans -mt-1 font-semibold">AI Operating System</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 flex flex-col gap-1">
            {navItems.map(item => {
              if (item.managerOnly && role !== 'manager') return null;
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400 font-semibold' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-primary-500' : 'text-slate-400 dark:text-slate-500'}`} />
                  {item.label}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary-500" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>System Server: Online</span>
          </div>
          <p className="font-sans text-[10px] opacity-80">© 2026 CogniFleet Core OS</p>
        </div>
      </aside>

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation */}
        <header className="h-16 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between shrink-0 z-10 shadow-soft-sm">
          {/* Section Breadcrumbs */}
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold font-sans text-slate-800 dark:text-slate-100">
              {navItems.find(item => item.path === location.pathname)?.label || (location.pathname === '/driver-app' ? 'Driver Workspace' : 'Fleet Control Panel')}
            </h1>
            <div className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              {role} portal
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex items-center gap-4">
            {/* Quick Refresh */}
            <button 
              onClick={() => refreshAll()}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-center transition-colors"
              title="Sync Database State"
            >
              <Database className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </button>



            {/* Dark Mode Switcher */}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>

            {/* Active Alert Ticker / Popover */}
            {role === 'manager' && (
              <div className="relative">
                <button 
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full relative transition-colors"
                >
                  <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  {activeAlertCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                      {activeAlertCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-lg z-50 p-4">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-2 border-b pb-2 flex justify-between items-center">
                      <span>Critical System Alerts</span>
                      <span className="text-[10px] text-red-500 font-semibold uppercase">{activeAlertCount} Active</span>
                    </h3>
                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                      {alerts.filter(a => !a.resolved).length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">No unresolved system alerts.</p>
                      ) : (
                        alerts.filter(a => !a.resolved).map(alert => (
                          <div 
                            key={alert.id} 
                            onClick={() => {
                              setNotifOpen(false);
                              navigate(alert.trip_id ? `/loads` : `/map`);
                            }}
                            className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-primary-50 dark:hover:bg-primary-950/20 cursor-pointer border-l-4 border-red-500 transition-all"
                          >
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{alert.title}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{alert.description}</p>
                            <span className="text-[8px] text-slate-400 block mt-1">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Profile Popover */}
            <div className="relative">
              <button 
                onClick={() => setProfileOpen(!profileOpen)}
                className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-xs border border-primary-200 dark:border-primary-800 hover:opacity-80 transition-opacity"
              >
                {role === 'manager' ? 'M' : 'D'}
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-lg z-50 p-3">
                  <div className="px-2 py-1.5 border-b mb-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {role === 'manager' 
                        ? (currentUser?.username === 'admin' ? 'Admin Manager' : 'Sarah Collins')
                        : (drivers.find(d => d.email === currentUser?.email)?.name || 'John Davis')}
                    </p>
                    <p className="text-[10px] text-slate-400">{role === 'manager' ? 'Admin Fleet Manager' : 'Class A Driver'}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full text-left text-xs px-2 py-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    User Profile
                  </button>
                  <button 
                    onClick={() => {
                      setProfileOpen(false);
                      handleSignOut();
                    }}
                    className="w-full text-left text-xs px-2 py-2 rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-red-650 dark:text-red-400"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 3. Sub-page views render here */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/loads" element={<LoadsModule />} />
            <Route path="/dispatch" element={<DispatchBoard />} />
            <Route path="/map" element={<TrackingMap />} />
            <Route path="/fleet" element={<FleetModule />} />
            <Route path="/drivers" element={<DriverModule />} />
            <Route path="/pod" element={<PODModule />} />
            <Route path="/billing" element={<BillingModule />} />
            <Route path="/reports" element={<ReportsModule />} />
            <Route path="/settings" element={<SettingsModule />} />
            <Route path="/driver-app" element={<DriverApp />} />
          </Routes>

          {/* Floating AI Assistant Chat Widget */}
          <AIAssistant />
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AppProvider>
        <AppLayout />
      </AppProvider>
    </Router>
  );
}

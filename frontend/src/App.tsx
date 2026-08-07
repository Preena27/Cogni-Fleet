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
  Zap,
  Compass
} from 'lucide-react';
import { User, Trip, Driver, Vehicle, Warehouse, ProofOfDelivery, Invoice, Alert, AutomationLog } from './types';

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
  userProfile: User | null;
  setUserProfile: (profile: User | null) => void;
  updateUserProfile: (updated: Partial<User>) => Promise<boolean>;
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
import MessagesModule from './pages/MessagesModule';
import AIAssistant from './components/AIAssistant';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';

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
  const [userProfile, setUserProfile] = useState<User | null>(null);
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
    // Managers receive notifications via the Notification Panel, not popup toasts
    if (role === 'manager') return;
    
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
      localStorage.clear();
      setIsLoggedIn(false);
    }
    return res;
  };

  const fetchUserProfile = async () => {
    try {
      const res = await secureFetch(`${API_BASE}/auth/me`);
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
      }
    } catch (e) {
      console.error("Failed to fetch user profile:", e);
    }
  };

  const updateUserProfile = async (updated: Partial<User>): Promise<boolean> => {
    try {
      const res = await secureFetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
        if (updated.username) {
          localStorage.setItem("username", updated.username);
          setCurrentUser((prev: any) => ({ ...prev, username: updated.username }));
        }
        await refreshAll();
        return true;
      }
    } catch (e) {
      console.error("Failed to update user profile:", e);
    }
    return false;
  };

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
      case 'profile': await fetchUserProfile(); break;
    }
  };

  const refreshAll = async () => {
    if (!isLoggedIn) return;
    await Promise.all([
      fetchUserProfile(),
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
        if (data.type === 'REFRESH_DATA') {
          refreshData(data.module);
        } else if (data.type === 'AUTOMATION_LOG') {
          const userIdStr = localStorage.getItem("userId");
          const userId = userIdStr ? parseInt(userIdStr) : null;
          const userRole = localStorage.getItem("userRole");

          if (userRole === 'manager') {
            if (data.log.manager_id && data.log.manager_id !== userId) return;
          } else if (userRole === 'driver') {
            const driverIdStr = localStorage.getItem("driverId");
            const driverId = driverIdStr ? parseInt(driverIdStr) : null;
            if (!driverId || (data.log.driver_id && data.log.driver_id !== driverId)) return;
          } else return;

          setAutomationLogs(prev => [data.log, ...prev]);
          refreshAll();
        }
      };

      ws.onclose = () => {
        setTimeout(connectWS, 3000);
      };
    };

    connectWS();
    return () => { if (ws) ws.close(); };
  }, [isLoggedIn]);

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
    setUserProfile(null);
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
      userProfile, setUserProfile, updateUserProfile,
      handleSignOut,
      secureFetch
    }}>
      {children}

      {/* Floating Toast Notification Container (Drivers only) */}
      {role !== 'manager' && (
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
      )}
    </AppContext.Provider>
  );
};

// Sub-Component: App Layout Shell
const AppLayout: React.FC = () => {
  const { role, setRole, darkMode, setDarkMode, alerts, refreshAll, isLoggedIn, currentUser, userProfile, handleSignOut, drivers, secureFetch, refreshData } = useAppContext();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Click outside to close open dropdown popovers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleNotif = () => {
    setProfileOpen(false);
    setNotifOpen(prev => !prev);
  };

  const toggleProfile = () => {
    setNotifOpen(false);
    setProfileOpen(prev => !prev);
  };

  const handleAcknowledgeAlert = async (alertId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await secureFetch(`${API_BASE}/alerts/${alertId}/acknowledge`, { method: 'POST' });
      if (res.ok) {
        refreshData('alerts');
      }
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  const [showLoginView, setShowLoginView] = useState(false);

  if (!isLoggedIn) {
    if (showLoginView || location.pathname === '/login') {
      return <LoginPage onBackToHome={() => { setShowLoginView(false); navigate('/'); }} />;
    }
    return <LandingPage onLoginClick={() => setShowLoginView(true)} />;
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
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Welcome, {userProfile?.full_name || currentUser?.username}
            </span>
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
    { path: '/messages', label: 'Driver Messages', icon: MessageSquare, managerOnly: true },
    { path: '/settings', label: 'Settings', icon: Settings, managerOnly: false },
  ];

  const unreadAlerts = alerts.filter(a => !a.acknowledged);
  const activeAlertCount = unreadAlerts.length;

  const getPriorityStyle = (priority?: string, severity?: string) => {
    const p = (priority || severity || 'Information').toLowerCase();
    switch (p) {
      case 'critical':
        return {
          badge: 'bg-red-600 text-white font-bold animate-pulse',
          card: 'border-l-4 border-l-red-600 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 shadow-md',
          dot: 'bg-red-600 animate-ping',
          label: 'CRITICAL'
        };
      case 'high':
        return {
          badge: 'bg-red-500 text-white font-semibold',
          card: 'border-l-4 border-l-red-500 border-slate-200 dark:border-slate-800 bg-red-50/40 dark:bg-red-950/20',
          dot: 'bg-red-500',
          label: 'HIGH'
        };
      case 'warning':
      case 'medium':
        return {
          badge: 'bg-orange-500 text-white font-semibold',
          card: 'border-l-4 border-l-orange-500 border-slate-200 dark:border-slate-800 bg-orange-50/40 dark:bg-orange-950/20',
          dot: 'bg-orange-500',
          label: 'MEDIUM'
        };
      case 'information':
      case 'low':
      default:
        return {
          badge: 'bg-blue-500 text-white font-semibold',
          card: 'border-l-4 border-l-blue-500 border-slate-200 dark:border-slate-800 bg-blue-50/40 dark:bg-blue-950/20',
          dot: 'bg-blue-500',
          label: 'LOW'
        };
    }
  };

  const displayName = userProfile?.full_name || currentUser?.username || 'Sarah Collins';

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
              <span className="text-[10px] block font-medium uppercase tracking-wider text-primary-500 font-sans -mt-1 font-semibold">
                {userProfile?.company_name || 'AI Operating System'}
              </span>
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
        {/* Top Navigation Header */}
        <header className="h-16 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between shrink-0 z-10 shadow-soft-sm">
          {/* Section Title */}
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold font-sans text-slate-800 dark:text-slate-100">
              {navItems.find(item => item.path === location.pathname)?.label || 'Fleet Control Panel'}
            </h1>
            <div className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              {role} portal
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">


            {/* Dark Mode Switcher */}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>

            {/* Notification Panel (Bell Icon) */}
            {role === 'manager' && (
              <div className="relative" ref={notifRef}>
                <button 
                  onClick={toggleNotif}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full relative transition-colors"
                  title="Notification Panel"
                >
                  <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  {activeAlertCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                      {activeAlertCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-3 w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-soft-lg z-50 p-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800 mb-3">
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Bell className="w-4 h-4 text-primary-500" />
                        <span>System Notifications</span>
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                        {activeAlertCount} Unread
                      </span>
                    </div>

                    {/* Scrollable Notification List */}
                    <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                      {(() => {
                        const counts: Record<string, number> = {};
                        const displayAlerts = alerts.filter(a => {
                          const key = `${a.title}_${a.vehicle_number || ''}`;
                          counts[key] = (counts[key] || 0) + 1;
                          return counts[key] <= 3;
                        });
                        if (displayAlerts.length === 0) {
                          return <p className="text-xs text-slate-400 py-6 text-center">No notifications recorded.</p>;
                        }
                        return displayAlerts.map(alert => {
                          const style = getPriorityStyle(alert.priority, alert.severity);
                          const isCritical = (alert.priority || alert.severity) === 'Critical';

                          return (
                            <div 
                              key={alert.id}
                              className={`p-3 rounded-lg flex flex-col gap-1 transition-all ${style.card}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${style.dot}`}></span>
                                  {alert.title}
                                </span>
                                <span className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${style.badge}`}>
                                  {style.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-350 leading-relaxed mt-0.5">
                                {alert.description}
                              </p>
                              <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1">
                                <span>{alert.vehicle_number ? `Vehicle: ${alert.vehicle_number}` : (alert.driver_name ? `Driver: ${alert.driver_name}` : 'System')}</span>
                                <span>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>

                              {/* Acknowledge Button for Critical alerts */}
                              {isCritical && !alert.acknowledged && (
                                <button
                                  onClick={(e) => handleAcknowledgeAlert(alert.id, e)}
                                  className="mt-2 w-full py-1 bg-red-800 hover:bg-red-900 text-white rounded text-[10px] font-bold transition-colors shadow-soft-sm"
                                >
                                  Acknowledge Critical Alert
                                </button>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button 
                onClick={toggleProfile}
                className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-xs border border-primary-200 dark:border-primary-800 hover:opacity-90 transition-opacity"
              >
                {userProfile?.profile_picture ? (
                  <img src={userProfile.profile_picture} alt="Profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-3 w-60 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-lg z-50 p-3">
                  <div className="px-2 py-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{userProfile?.email || 'admin@cognifleet.com'}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 text-[9px] font-semibold uppercase">
                      {role}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full text-left text-xs px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors"
                  >
                    User Profile & Settings
                  </button>
                  <button 
                    onClick={() => {
                      setProfileOpen(false);
                      handleSignOut();
                    }}
                    className="w-full text-left text-xs px-2.5 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 font-semibold transition-colors mt-1"
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
            <Route path="/messages" element={<MessagesModule />} />
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

import { SettingsProvider } from './contexts/SettingsContext';

export default function App() {
  return (
    <Router>
      <AppProvider>
        <SettingsProvider>
          <AppLayout />
        </SettingsProvider>
      </AppProvider>
    </Router>
  );
}

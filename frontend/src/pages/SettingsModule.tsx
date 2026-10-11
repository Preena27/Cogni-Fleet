import React, { useState, useEffect } from 'react';
import { useAppContext } from '../App';
import { useSettings } from '../contexts/SettingsContext';
import { 
  User, 
  Settings2,
  Bell, 
  Shield, 
  Save,
  Laptop,
  Trash2,
  AlertTriangle,
  Lock,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  Map as MapIcon,
  Navigation,
  Key
} from 'lucide-react';

export default function SettingsModule() {
  const { darkMode, setDarkMode, userProfile, updateUserProfile, currentUser, secureFetch, refreshAll } = useAppContext();

  const [activeTab, setActiveTab] = useState<'general' | 'preferences' | 'notifications' | 'security'>('general');

  // General Settings State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [language, setLanguage] = useState('English');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [currency, setCurrency] = useState('INR ₹');
  const [distanceUnit, setDistanceUnit] = useState('Kilometers');
  const [weightUnit, setWeightUnit] = useState('Kilograms');

  // Preferences State
  const [mapView, setMapView] = useState('Street');
  const [routeStyle, setRouteStyle] = useState('Solid');
  const [routeColor, setRouteColor] = useState('#3b82f6');
  const [trafficEnabled, setTrafficEnabled] = useState(true);
  const [poiEnabled, setPoiEnabled] = useState(false);
  const [vehicleMarkersEnabled, setVehicleMarkersEnabled] = useState(true);
  const [routeOptimizationMode, setRouteOptimizationMode] = useState('Balanced');

  // Notifications State (Mock variables mapped to UserSettings schema where applicable)
  const [routeDelayThreshold, setRouteDelayThreshold] = useState(5);
  const [autoRouteRecalculation, setAutoRouteRecalculation] = useState(true);
  const [trafficConsideration, setTrafficConsideration] = useState(true);

  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  
  const [apiKey, setApiKey] = useState('');
  const [resetting, setResetting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const { settings, updateSettings, refreshSettings } = useSettings();

  // Fetch Settings
  useEffect(() => {
    // Populate profile basics
    if (userProfile) {
      setFullName(userProfile.full_name || '');
      setUsername(userProfile.username || currentUser?.username || '');
      setEmail(userProfile.email || '');
      setPhone(userProfile.phone || '');
      setCompanyName(userProfile.company_name || '');
    }

    setLanguage(settings.language);
    setTimezone(settings.timezone);
    setCurrency(settings.currency);
    setDistanceUnit(settings.distance_unit);
    setWeightUnit(settings.weight_unit);
    setMapView(settings.map_view);
    setRouteStyle(settings.route_style);
    setRouteColor(settings.route_color);
    setTrafficEnabled(settings.traffic_enabled);
    setPoiEnabled(settings.poi_enabled);
    setVehicleMarkersEnabled(settings.vehicle_markers_enabled);
    setRouteOptimizationMode(settings.route_optimization_mode);
    setRouteDelayThreshold(settings.route_delay_threshold);
    setAutoRouteRecalculation(settings.auto_route_recalculation);
    setTrafficConsideration(settings.traffic_consideration);
    
    setApiKey(localStorage.getItem('OPENAI_API_KEY') || '');
  }, [userProfile, currentUser, settings]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    
    // Save Profile Details
    await updateUserProfile({
      full_name: fullName,
      username: username,
      email: email,
      phone: phone,
      company_name: companyName,
      timezone: timezone,
      language: language
    });

    // Save Settings
    try {
      await secureFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          language,
          timezone,
          currency,
          distance_unit: distanceUnit,
          weight_unit: weightUnit,
          map_view: mapView,
          route_style: routeStyle,
          route_color: routeColor,
          traffic_enabled: trafficEnabled,
          poi_enabled: poiEnabled,
          vehicle_markers_enabled: vehicleMarkersEnabled,
          route_optimization_mode: routeOptimizationMode,
          route_delay_threshold: routeDelayThreshold,
          auto_route_recalculation: autoRouteRecalculation,
          traffic_consideration: trafficConsideration
        })
      });
      updateSettings({
        language,
        timezone,
        currency,
        distance_unit: distanceUnit,
        weight_unit: weightUnit,
        map_view: mapView,
        route_style: routeStyle,
        route_color: routeColor,
        traffic_enabled: trafficEnabled,
        poi_enabled: poiEnabled,
        vehicle_markers_enabled: vehicleMarkersEnabled,
        route_optimization_mode: routeOptimizationMode,
        route_delay_threshold: routeDelayThreshold,
        auto_route_recalculation: autoRouteRecalculation,
        traffic_consideration: trafficConsideration
      });
      setSuccessMsg("Settings and profile preferences synchronized successfully.");
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error(err);
    }
    
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!currentPassword) return setPwdError("Please enter your current password.");
    if (!newPassword || newPassword.length < 4) return setPwdError("New password must be at least 4 characters long.");
    if (newPassword !== confirmPassword) return setPwdError("Passwords do not match.");

    setPwdLoading(true);
    try {
      const res = await secureFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });
      if (res.ok) {
        setPwdSuccess("Password updated securely. You are protected.");
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const err = await res.json();
        setPwdError(err.detail || "Update failed.");
      }
    } catch (err) {
      setPwdError("Connection error.");
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSaveApiKeys = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('OPENAI_API_KEY', apiKey);
    setSuccessMsg("API credentials updated.");
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleSystemReset = async () => {
    const doubleConfirm = confirm("CRITICAL WARNING: This wipes all trips, driver data, and PODs. Do you want to proceed?");
    if (!doubleConfirm) return;
    
    setResetting(true);
    try {
      const res = await secureFetch("/api/system/reset", { method: "POST" });
      if (res.ok) await refreshAll();
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Platform Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your account configurations and operational preferences.</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Settings Layout Container */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 flex flex-col gap-2 shrink-0">
          {[
            { id: 'general', icon: User, label: 'General Settings' },
            { id: 'preferences', icon: Settings2, label: 'App Preferences' },
            { id: 'notifications', icon: Bell, label: 'Alerts & Events' },
            { id: 'security', icon: Shield, label: 'Security & Auth' }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                  isActive 
                  ? 'bg-primary-600 text-white shadow-soft-md shadow-primary-500/20 scale-100' 
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-soft-lg p-6 lg:p-8 relative min-h-[500px]">
          
          <form onSubmit={handleSaveAll} className="h-full flex flex-col">
            
            {/* --- GENERAL SETTINGS --- */}
            {activeTab === 'general' && (
              <div className="flex flex-col gap-8 animate-fade-in h-full">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 mb-5">Profile Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">Full Name</label>
                      <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">Username</label>
                      <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">Email Address</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">Phone Number</label>
                      <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 mb-5">Localization & Format</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Globe className="w-4 h-4"/> Language</label>
                      <select value={language} onChange={e => setLanguage(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                        <option value="English">English</option>
                        <option value="Spanish">Spanish</option>
                        <option value="Hindi">Hindi</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Clock className="w-4 h-4"/> Timezone</label>
                      <select value={timezone} onChange={e => setTimezone(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                        <option value="Asia/Kolkata">IST (Indian Standard Time)</option>
                        <option value="America/New_York">EST (Eastern Standard Time)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">Currency</label>
                      <select value={currency} onChange={e => setCurrency(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                        <option value="INR ₹">Indian Rupee (INR ₹)</option>
                        <option value="USD $">US Dollar (USD $)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">Distance Units</label>
                      <select value={distanceUnit} onChange={e => setDistanceUnit(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                        <option value="Kilometers">Kilometers (km)</option>
                        <option value="Miles">Miles (mi)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- PREFERENCES --- */}
            {activeTab === 'preferences' && (
              <div className="flex flex-col gap-8 animate-fade-in h-full">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 mb-5 flex items-center gap-2"><MapIcon className="w-5 h-5 text-primary-500"/> Mapping Interface</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">Default Map View</label>
                      <select value={mapView} onChange={e => setMapView(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                        <option value="Street">Street Detail</option>
                        <option value="Satellite">Satellite Imagery</option>
                        <option value="Terrain">Terrain Topology</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">Route Line Style</label>
                      <select value={routeStyle} onChange={e => setRouteStyle(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                        <option value="Solid">Solid Line</option>
                        <option value="Dashed">Dashed Line</option>
                      </select>
                    </div>
                    <div className="col-span-1 md:col-span-2 flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Vehicle Markers</p>
                        <p className="text-xs text-slate-500">Show live asset locations on the routing map</p>
                      </div>
                      <button type="button" onClick={() => setVehicleMarkersEnabled(!vehicleMarkersEnabled)} className={`w-12 h-6 rounded-full transition-colors relative flex items-center cursor-pointer ${vehicleMarkersEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        <span className={`w-4 h-4 rounded-full bg-white shadow-sm absolute transition-transform ${vehicleMarkersEnabled ? 'translate-x-7' : 'translate-x-1'}`}></span>
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 mb-5 flex items-center gap-2"><Navigation className="w-5 h-5 text-indigo-500"/> Route Optimization</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">Optimization Strategy</label>
                      <select value={routeOptimizationMode} onChange={e => setRouteOptimizationMode(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                        <option value="Balanced">Balanced (Cost vs Time)</option>
                        <option value="Fastest">Fastest Time</option>
                        <option value="Shortest">Shortest Distance</option>
                        <option value="FuelEfficient">Maximum Fuel Efficiency</option>
                      </select>
                    </div>
                    <div className="flex flex-col justify-center gap-4 mt-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={trafficEnabled} onChange={e => setTrafficEnabled(e.target.checked)} className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500" />
                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Enable Live Traffic Overlays</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={poiEnabled} onChange={e => setPoiEnabled(e.target.checked)} className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500" />
                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Show Points of Interest (Gas, Stops)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- NOTIFICATIONS --- */}
            {activeTab === 'notifications' && (
              <div className="flex flex-col gap-8 animate-fade-in h-full">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 mb-5">Alert Triggers</h2>
                  
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Auto-Recalculate Routes</p>
                        <p className="text-xs text-slate-500">Automatically adjust paths when traffic anomalies occur</p>
                      </div>
                      <button type="button" onClick={() => setAutoRouteRecalculation(!autoRouteRecalculation)} className={`w-12 h-6 rounded-full transition-colors relative flex items-center cursor-pointer ${autoRouteRecalculation ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        <span className={`w-4 h-4 rounded-full bg-white shadow-sm absolute transition-transform ${autoRouteRecalculation ? 'translate-x-7' : 'translate-x-1'}`}></span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Traffic Impact Analysis</p>
                        <p className="text-xs text-slate-500">Trigger warnings when congestion significantly impacts ETA</p>
                      </div>
                      <button type="button" onClick={() => setTrafficConsideration(!trafficConsideration)} className={`w-12 h-6 rounded-full transition-colors relative flex items-center cursor-pointer ${trafficConsideration ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        <span className={`w-4 h-4 rounded-full bg-white shadow-sm absolute transition-transform ${trafficConsideration ? 'translate-x-7' : 'translate-x-1'}`}></span>
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Delay Notification Threshold</p>
                        <p className="text-xs text-slate-500">Alert dispatch when ETA slips beyond (minutes):</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <input type="range" min="1" max="60" value={routeDelayThreshold} onChange={e => setRouteDelayThreshold(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
                        <span className="font-bold text-primary-600 text-lg w-10 text-center">{routeDelayThreshold}m</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* General Save Button (Visible on first 3 tabs) */}
            {activeTab !== 'security' && (
              <div className="mt-auto pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white rounded-xl font-bold shadow-soft-md shadow-primary-500/20 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Synchronizing Data...' : 'Save Configuration'}
                </button>
              </div>
            )}
          </form>

          {/* --- SECURITY & AUTH --- */}
          {activeTab === 'security' && (
            <div className="flex flex-col gap-10 animate-fade-in h-full">
              {/* Password Change */}
              <form onSubmit={handleChangePassword} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-soft-sm">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 mb-5 flex items-center gap-2"><Lock className="w-5 h-5 text-indigo-500"/> Update Master Password</h2>
                
                {pwdError && <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-600 text-sm font-semibold flex items-center gap-2"><XCircle className="w-4 h-4"/>{pwdError}</div>}
                {pwdSuccess && <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{pwdSuccess}</div>}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">Current Password</label>
                    <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">New Password</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">Confirm Password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button type="submit" disabled={pwdLoading} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer shadow-soft-sm">
                    <Shield className="w-4 h-4"/> {pwdLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>

              {/* API Keys */}
              <form onSubmit={handleSaveApiKeys} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-soft-sm">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 mb-5 flex items-center gap-2"><Key className="w-5 h-5 text-amber-500"/> Developer Integrations</h2>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-sm text-slate-600 dark:text-slate-400">OpenAI API Key (Local Sandbox)</label>
                  <input type="password" placeholder="sk-..." value={apiKey} onChange={e => setApiKey(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  <p className="text-xs text-slate-500 mt-1">If provided, AI models will power smart assignments. Saved securely in local storage.</p>
                </div>
                <div className="mt-4 flex justify-end">
                  <button type="submit" className="px-6 py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl font-bold transition-all cursor-pointer shadow-soft-sm">
                    Save Key
                  </button>
                </div>
              </form>

              {/* Danger Zone */}
              <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 p-6 rounded-2xl">
                <h2 className="text-lg font-bold text-red-600 dark:text-red-500 border-b border-red-200 dark:border-red-900/50 pb-3 mb-5 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Danger Zone</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Factory Reset Database</h4>
                    <p className="text-sm text-slate-500 mt-1">Permanently deletes all operational data including trips, alerts, and proofs. Admin accounts are preserved.</p>
                  </div>
                  <button type="button" disabled={resetting} onClick={handleSystemReset} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer shadow-soft-sm shadow-red-500/20">
                    <Trash2 className="w-4 h-4"/> {resetting ? 'Purging...' : 'Wipe Database'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

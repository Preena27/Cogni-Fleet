import React, { useState, useEffect } from 'react';
import { useAppContext } from '../App';
import { 
  User, 
  Shield, 
  Bell, 
  Key, 
  Languages, 
  Save,
  Laptop,
  Trash2,
  AlertTriangle
} from 'lucide-react';

export default function SettingsModule() {
  const { darkMode, setDarkMode, addToast, secureFetch, refreshAll } = useAppContext();
  const [apiKey, setApiKey] = useState('');
  const [resetting, setResetting] = useState(false);
  
  useEffect(() => {
    // Load OpenAI Key from local storage
    const savedKey = localStorage.getItem('OPENAI_API_KEY') || '';
    setApiKey(savedKey);
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('OPENAI_API_KEY', apiKey);
    addToast("Settings Updated", "Configurations and OpenAI credentials saved successfully.", "success");
  };

  const handleSystemReset = async () => {
    const doubleConfirm = confirm(
      "CRITICAL WARNING: This will permanently wipe all active loads, route maps, driver directory profiles, and POD logs. Manager accounts will be preserved.\n\nDo you want to reset the system database?"
    );
    if (!doubleConfirm) return;
    
    setResetting(true);
    try {
      const res = await secureFetch("http://localhost:8000/api/system/reset", {
        method: "POST"
      });
      if (res.ok) {
        addToast("Database Purged", "System successfully restored to baseline state. Driver accounts cleared.", "success");
        await refreshAll();
      } else {
        const err = await res.json();
        addToast("Reset Failed", err.detail || "Could not wipe database.", "error");
      }
    } catch (e) {
      console.error(e);
      addToast("Connection Error", "Server could not be reached to perform system reset.", "error");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-3xl flex flex-col gap-6 font-sans">
      <form onSubmit={handleSaveSettings} className="flex flex-col gap-6">
        {/* Profile Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md flex flex-col gap-4">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-150 flex items-center gap-2">
            <User className="w-4.5 h-4.5 text-primary-500" />
            <span>Company Profile Settings</span>
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-slate-500">Corporate Name</label>
              <input 
                type="text" defaultValue="CogniFleet Logistics Corp"
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-slate-500">Fleet Dispatch Center</label>
              <input 
                type="text" defaultValue="San Francisco Headquarters"
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* System Settings & Theme */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md flex flex-col gap-4">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-150 flex items-center gap-2">
            <Laptop className="w-4.5 h-4.5 text-indigo-500" />
            <span>System Appearance & Theme</span>
          </h3>
          <div className="flex items-center justify-between text-xs">
            <div>
              <p className="font-semibold text-slate-705 dark:text-slate-300">Dark Mode Interface</p>
              <p className="text-[10px] text-slate-400">Switches display scheme between standard light and dark palettes</p>
            </div>
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center cursor-pointer ${
                darkMode ? 'bg-primary-600' : 'bg-slate-200'
              }`}
            >
              <span className={`w-4 h-4 rounded-full bg-white shadow-soft-sm absolute transition-transform ${
                darkMode ? 'translate-x-6' : 'translate-x-1'
              }`}></span>
            </button>
          </div>
        </div>

        {/* API Credentials */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md flex flex-col gap-4">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-150 flex items-center gap-2">
            <Key className="w-4.5 h-4.5 text-amber-500" />
            <span>API Integrations</span>
          </h3>
          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-semibold text-slate-500">OpenAI API Key (Saved locally in sandbox)</label>
            <input 
              type="password" placeholder="sk-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500 font-mono"
            />
            <p className="text-[10px] text-slate-400">If provided, OpenAI APIs will power assignment previews. Otherwise, local rules engines are leveraged.</p>
          </div>
        </div>

        {/* Database Purge Options */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md flex flex-col gap-4">
          <h3 className="font-bold text-sm text-red-650 dark:text-red-500 flex items-center gap-2">
            <AlertTriangle className="w-4.5 h-4.5 text-red-500" />
            <span>Database Administration</span>
          </h3>
          <div className="flex items-center justify-between text-xs">
            <div>
              <p className="font-semibold text-slate-705 dark:text-slate-350">Wipe System Tracking Database</p>
              <p className="text-[10px] text-slate-400">Deletes trips, drivers, PODs, alerts, invoices, and sets vehicles available (Preserves manager credentials).</p>
            </div>
            <button
              type="button"
              disabled={resetting}
              onClick={handleSystemReset}
              className="px-4 py-2 bg-red-600 hover:bg-red-750 disabled:bg-slate-300 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-soft-sm text-xs flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {resetting ? "Purging..." : "Reset System Data"}
            </button>
          </div>
        </div>

        {/* Save button */}
        <button
          type="submit"
          className="self-end px-5 py-2.5 bg-primary-600 hover:bg-primary-750 text-white rounded-lg text-xs font-bold shadow-soft-md flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Save className="w-4 h-4" />
          Save Configurations
        </button>
      </form>
    </div>
  );
}

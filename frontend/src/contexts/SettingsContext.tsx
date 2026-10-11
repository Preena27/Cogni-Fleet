import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAppContext } from '../App';

export interface UserSettings {
  language: string;
  timezone: string;
  currency: string;
  distance_unit: string;
  weight_unit: string;
  map_view: string;
  route_style: string;
  route_color: string;
  traffic_enabled: boolean;
  poi_enabled: boolean;
  vehicle_markers_enabled: boolean;
  route_optimization_mode: string;
  route_delay_threshold: number;
  auto_route_recalculation: boolean;
  traffic_consideration: boolean;
}

const defaultSettings: UserSettings = {
  language: 'English',
  timezone: 'Asia/Kolkata',
  currency: 'INR ₹',
  distance_unit: 'Kilometers',
  weight_unit: 'Kilograms',
  map_view: 'Street',
  route_style: 'Solid',
  route_color: '#3b82f6',
  traffic_enabled: true,
  poi_enabled: false,
  vehicle_markers_enabled: true,
  route_optimization_mode: 'Balanced',
  route_delay_threshold: 5,
  auto_route_recalculation: true,
  traffic_consideration: true,
};

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { secureFetch, isLoggedIn } = useAppContext();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);

  const fetchSettings = async () => {
    if (!isLoggedIn) return;
    try {
      const res = await secureFetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [isLoggedIn]);

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

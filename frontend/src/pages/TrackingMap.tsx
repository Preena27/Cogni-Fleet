import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../App';
import L from 'leaflet';
import { 
  Truck, 
  MapPin, 
  TrafficCone, 
  AlertTriangle, 
  CheckCircle, 
  Navigation,
  RefreshCw
} from 'lucide-react';

// Resolve Leaflet icon relative issues under Vite compilation
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function TrackingMap() {
  const { vehicles, trips, drivers, refreshAll, addToast, secureFetch } = useAppContext();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineGroupRef = useRef<L.LayerGroup | null>(null);
  
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [loadingEvent, setLoadingEvent] = useState<string | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Create map centered in California
    const map = L.map(mapContainerRef.current, {
      center: [36.5, -120.0],
      zoom: 6,
      zoomControl: true,
      layers: []
    });

    // Add OpenStreetMap standard tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markerGroupRef.current = L.layerGroup().addTo(map);
    polylineGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Trigger map resize check
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map markers when vehicles list changes
  useEffect(() => {
    if (!mapRef.current || !markerGroupRef.current || !polylineGroupRef.current) return;
    
    // Clear previous markers & polylines
    markerGroupRef.current.clearLayers();
    polylineGroupRef.current.clearLayers();

    vehicles.forEach(vehicle => {
      const lat = vehicle.latitude || 36.7783;
      const lng = vehicle.longitude || -119.4179;
      
      const driver = drivers.find(d => d.vehicle_id === vehicle.id);
      const trip = trips.find(t => t.vehicle_id === vehicle.id && t.status !== 'Completed');

      // Create a marker custom color icon depending on status
      let markerColor = '#10b981'; // Available (Green)
      if (vehicle.availability === 'On Duty') {
        if (trip?.status === 'Problem') markerColor = '#ef4444'; // Problem (Red)
        else markerColor = '#3b82f6'; // Moving (Blue)
      } else if (vehicle.availability === 'Maintenance') {
        markerColor = '#f97316'; // Maintenance (Orange)
      } else if (vehicle.gps === 'Offline') {
        markerColor = '#64748b'; // Offline (Slate)
      }

      // Simple HTML template for dot marker glow
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="
          width: 14px; 
          height: 14px; 
          border-radius: 50%; 
          background-color: ${markerColor}; 
          border: 2px solid white;
          box-shadow: 0 0 8px ${markerColor};
          transform: translate(-3px, -3px);
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Build marker popup content
      marker.bindPopup(`
        <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px; width: 160px;">
          <h4 style="margin: 0 0 4px 0; font-weight: bold; font-size: 12px; color: #1e293b;">${vehicle.vehicle_number}</h4>
          <p style="margin: 0 0 2px 0; color: #64748b;"><b>Driver:</b> ${driver ? driver.name : 'Unassigned'}</p>
          <p style="margin: 0 0 2px 0; color: #64748b;"><b>Speed:</b> ${vehicle.speed} km/h</p>
          <p style="margin: 0 0 2px 0; color: #64748b;"><b>Fuel level:</b> ${vehicle.fuel}%</p>
          <p style="margin: 0 0 4px 0; color: #64748b;"><b>Telemetry:</b> ${vehicle.availability}</p>
        </div>
      `);

      marker.on('click', () => {
        setSelectedVehicle({
          ...vehicle,
          driver,
          trip
        });
      });

      marker.addTo(markerGroupRef.current!);

      // Plot route lines for active trips
      if (trip && trip.route_coordinates) {
        try {
          const coords = JSON.parse(trip.route_coordinates);
          if (Array.isArray(coords) && coords.length > 0) {
            L.polyline(coords, {
              color: trip.status === 'Problem' ? '#f87171' : '#60a5fa',
              weight: 3,
              opacity: 0.8,
              dashArray: trip.status === 'Problem' ? '5, 5' : undefined
            }).addTo(polylineGroupRef.current!);
          }
        } catch (e) {
          console.error("Failed to parse route coords:", e);
        }
      }
    });
  }, [vehicles, trips, drivers]);

  // Simulate remote events (traffic rerouting, breakdown, trip completes)
  const triggerSimulation = async (tripId: number, eventType: string) => {
    setLoadingEvent(eventType);
    try {
      const res = await fetch(`http://localhost:8000/api/trips/${tripId}/simulate-event?event_type=${eventType}`, {
        method: 'POST'
      });
      if (res.ok) {
        if (eventType === 'traffic') {
          addToast("Route Optimization", "n8n pipeline triggered: Detour suggested and route dynamically updated.", "info");
        } else if (eventType === 'breakdown') {
          addToast("Critical Alert", "Vehicle breakdown flagged. Dispatched recovery towing & scheduled maintenance ticket.", "error");
        } else if (eventType === 'complete') {
          addToast("Delivery Completed", "Shipment delivered. Invoiced generated and POD cycle opened.", "success");
        }
        await refreshAll();
        setSelectedVehicle(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEvent(null);
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)] items-stretch">
      {/* Live Map Canvas container */}
      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden relative shadow-soft-sm">
        <div className="absolute top-4 left-4 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur border rounded-lg p-2.5 shadow-soft-md text-[10px] font-semibold text-slate-700 dark:text-slate-300 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
            <span>Active Transit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <span>Available / Idle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
            <span>In Maintenance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            <span>Critical Breakdown</span>
          </div>
        </div>
        <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
      </div>

      {/* Simulator Actions Details Sidebar Panel */}
      {selectedVehicle && (
        <aside className="w-80 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-soft-lg flex flex-col justify-between max-h-full overflow-y-auto animate-slide-in">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-start border-b pb-2">
              <div>
                <h3 className="font-bold text-sm text-slate-805 dark:text-slate-150">{selectedVehicle.vehicle_number}</h3>
                <span className="text-[10px] text-slate-400">{selectedVehicle.type}</span>
              </div>
              <button 
                onClick={() => setSelectedVehicle(null)}
                className="text-xs text-slate-400 hover:text-slate-650"
              >
                Close
              </button>
            </div>

            {/* General Specs info */}
            <div className="flex flex-col gap-3 text-xs text-slate-650 dark:text-slate-350">
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-slate-400">Operator</span>
                <span className="font-bold">{selectedVehicle.driver ? selectedVehicle.driver.name : 'None'}</span>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-slate-400">Current Velocity</span>
                <span className="font-bold">{selectedVehicle.speed} km/h</span>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-slate-400">Fuel Level</span>
                <span className="font-bold">{selectedVehicle.fuel}%</span>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-slate-400">Current Trip Status</span>
                <span className="font-bold text-indigo-500">{selectedVehicle.trip ? selectedVehicle.trip.status : 'Idle'}</span>
              </div>
            </div>

            {/* Dynamic n8n automated controls */}
            {selectedVehicle.trip ? (
              <div className="border-t pt-3 flex flex-col gap-3">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">n8n Automation Event Simulator</span>
                <div className="flex flex-col gap-2">
                  {selectedVehicle.trip.status === 'In Transit' && (
                    <button 
                      onClick={() => triggerSimulation(selectedVehicle.trip.id, 'traffic')}
                      disabled={!!loadingEvent}
                      className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 border border-blue-200 dark:border-blue-900 transition-colors"
                    >
                      <TrafficCone className="w-3.5 h-3.5" />
                      Simulate Route Traffic Detour
                    </button>
                  )}
                  {selectedVehicle.trip.status === 'In Transit' && (
                    <button 
                      onClick={() => triggerSimulation(selectedVehicle.trip.id, 'breakdown')}
                      disabled={!!loadingEvent}
                      className="w-full py-2 bg-red-50 hover:bg-red-105 text-red-750 dark:bg-red-950/20 dark:text-red-400 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-900 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                      Simulate Engine Breakdown
                    </button>
                  )}
                  {(selectedVehicle.trip.status === 'In Transit' || selectedVehicle.trip.status === 'Problem') && (
                    <button 
                      onClick={() => triggerSimulation(selectedVehicle.trip.id, 'complete')}
                      disabled={!!loadingEvent}
                      className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-900 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Simulate Completion & POD
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 border-t pt-3">Truck is currently idle. Route event triggers are active only when a trip is in transit.</p>
            )}
          </div>

          <div className="text-[9px] text-slate-400 mt-4 leading-normal bg-slate-50 dark:bg-slate-800/10 p-2 rounded border border-dashed text-center">
            Triggers simulate direct webhook events flowing into the backend automations.
          </div>
        </aside>
      )}
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../App';
import { useSettings } from '../contexts/SettingsContext';
import L from 'leaflet';
import { 
  Truck, TrafficCone, AlertTriangle, CheckCircle, Navigation,
  Maximize, Map as MapIcon, Fuel, Clock, Activity
} from 'lucide-react';

// Resolve Leaflet icon relative issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Calculate Fuel Analytics helper
const calculateFuelAnalytics = (distance: number, vehicle: any) => {
  const kml = vehicle?.mileage_kml || 10;
  const fuelUsed = distance / kml;
  const fuelCost = fuelUsed * 95; // Assume 95 INR per liter
  const estimatedRemaining = Math.max(0, (vehicle?.fuel || 100) - (fuelUsed / (vehicle?.capacity || 100) * 100));
  return { fuelUsed: fuelUsed.toFixed(1), fuelCost: fuelCost.toFixed(2), estimatedRemaining: estimatedRemaining.toFixed(1) };
};

export default function TrackingMap() {
  const { vehicles, trips, drivers, refreshAll } = useAppContext();
  const { settings } = useSettings();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineGroupRef = useRef<L.LayerGroup | null>(null);
  
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [loadingEvent, setLoadingEvent] = useState<string | null>(null);

  // Initialize Leaflet Map (Centered on India)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    const map = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629], // India
      zoom: 5,
      zoomControl: false, // Custom positioned if needed
      layers: []
    });

    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    if (settings.map_view === 'Satellite') tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    else if (settings.map_view === 'Terrain') tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';

    L.tileLayer(tileUrl, {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markerGroupRef.current = L.layerGroup().addTo(map);
    polylineGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [settings.map_view]);

  // Map Rendering Logic
  useEffect(() => {
    if (!mapRef.current || !markerGroupRef.current || !polylineGroupRef.current) return;
    
    markerGroupRef.current.clearLayers();
    polylineGroupRef.current.clearLayers();
    
    vehicles.forEach(vehicle => {
      const lat = vehicle.latitude || 13.0827; // Default Chennai
      const lng = vehicle.longitude || 80.2707;
      
      const driver = drivers.find(d => d.vehicle_id === vehicle.id);
      const trip = trips.find(t => t.vehicle_id === vehicle.id && t.status !== 'Completed');

      let markerColor = '#10b981'; 
      if (vehicle.availability === 'On Duty') {
        if (trip?.status === 'Problem') markerColor = '#ef4444'; 
        else markerColor = '#3b82f6'; 
      } else if (vehicle.availability === 'Maintenance') {
        markerColor = '#f97316'; 
      } else if (vehicle.gps === 'Offline') {
        markerColor = '#64748b'; 
      }

      // Smooth glow marker for live vehicle location
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="relative w-4 h-4">
                 <div class="absolute inset-0 rounded-full animate-ping opacity-75" style="background-color: ${markerColor};"></div>
                 <div class="relative w-4 h-4 rounded-full border-2 border-white shadow-md z-10" style="background-color: ${markerColor};"></div>
               </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      marker.on('click', () => {
        setSelectedVehicle({ ...vehicle, driver, trip });
        mapRef.current?.flyTo([lat, lng], 8, { duration: 1 });
      });

      marker.addTo(markerGroupRef.current!);

      // Draw Routes if active trip
      if (trip && trip.route_coordinates) {
        try {
          const coords = JSON.parse(trip.route_coordinates);
          if (Array.isArray(coords) && coords.length > 0) {
            // Simulated split for completed vs remaining path
            const mid = Math.floor(coords.length / 2);
            const completed = coords.slice(0, mid + 1);
            const remaining = coords.slice(mid);
            
            // Draw Remaining Route (Gray/Dashed)
            L.polyline(remaining, {
              color: '#94a3b8',
              weight: 4,
              opacity: 0.8,
              dashArray: '8, 8'
            }).addTo(polylineGroupRef.current!);

            // Draw Completed Route (Settings color and style)
            let dashStyle = undefined;
            if (settings.route_style === 'Dashed') dashStyle = '10, 10';

            L.polyline(completed, {
              color: trip.status === 'Problem' ? '#ef4444' : settings.route_color || '#3b82f6',
              weight: 4,
              opacity: 0.9,
              dashArray: dashStyle
            }).addTo(polylineGroupRef.current!);
            
            // Add Source/Dest markers if this vehicle is currently selected
            if (selectedVehicle?.id === vehicle.id) {
               // Use standard blue markers for origin/dest
               L.marker(coords[0], { title: 'Source' }).addTo(markerGroupRef.current!);
               L.marker(coords[coords.length - 1], { title: 'Destination' }).addTo(markerGroupRef.current!);
            }
          }
        } catch (e) {
          console.error("Failed to parse route coords:", e);
        }
      }
    });
  }, [vehicles, trips, drivers, selectedVehicle]);

  const triggerSimulation = async (tripId: number, eventType: string) => {
    setLoadingEvent(eventType);
    try {
      await fetch(`http://localhost:8000/api/trips/${tripId}/simulate-event?event_type=${eventType}`, {
        method: 'POST'
      });
      // Do NOT trigger toast popups. The backend automation directly creates an Alert row 
      // which syncs via websocket to the Notification Panel!
      await refreshAll();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEvent(null);
    }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-100px)] w-full">
      {/* LEFT 75% MAP */}
      <div className="w-3/4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden relative shadow-soft-sm flex flex-col">
        {/* Map Header Controls */}
        <div className="absolute top-4 left-4 z-40 flex gap-2">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border rounded-lg p-2.5 shadow-soft-md flex items-center gap-4 text-[10px] font-bold text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> Active</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Idle</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div> Maintenance</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div> Alert</span>
          </div>
        </div>

        {/* Floating Map Controls (Right) */}
        <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
           <button onClick={() => mapRef.current?.zoomIn()} className="p-2 bg-white border rounded shadow-sm hover:bg-slate-50"><Maximize className="w-4 h-4 text-slate-700" /></button>
           <button onClick={() => mapRef.current?.setView([20.5937, 78.9629], 5)} className="p-2 bg-white border rounded shadow-sm hover:bg-slate-50"><Navigation className="w-4 h-4 text-slate-700" /></button>
        </div>

        {/* Map Container */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Vehicle Status Card (Bottom Left) */}
        {selectedVehicle && (
          <div className="absolute bottom-6 left-6 z-40 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-soft-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-slide-in p-4">
             <div className="flex justify-between items-center mb-3">
               <div className="flex items-center gap-2">
                 <Truck className="w-5 h-5 text-blue-600" />
                 <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{selectedVehicle.vehicle_number}</h4>
               </div>
               <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                 selectedVehicle.availability === 'On Duty' ? 'bg-blue-100 text-blue-700' :
                 selectedVehicle.availability === 'Maintenance' ? 'bg-orange-100 text-orange-700' :
                 'bg-emerald-100 text-emerald-700'
               }`}>
                 {selectedVehicle.availability}
               </span>
             </div>
             <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
               <div className="flex justify-between"><span className="font-medium">Driver:</span> <span className="font-bold">{selectedVehicle.driver?.name || 'N/A'}</span></div>
               <div className="flex justify-between"><span className="font-medium">Speed:</span> <span className="font-bold">{settings.distance_unit === 'Miles' ? Math.round(selectedVehicle.speed * 0.621371) : selectedVehicle.speed} {settings.distance_unit === 'Miles' ? 'mph' : 'km/h'}</span></div>
               <div className="flex justify-between"><span className="font-medium">Fuel Level:</span> <span className="font-bold text-emerald-600">{selectedVehicle.fuel}%</span></div>
               <div className="flex justify-between"><span className="font-medium">Distance Rem:</span> <span className="font-bold">{settings.distance_unit === 'Miles' ? Math.round((selectedVehicle.trip?.remaining_distance || 0) * 0.621371) : (selectedVehicle.trip?.remaining_distance || 0)} {settings.distance_unit === 'Miles' ? 'mi' : 'km'}</span></div>
             </div>
          </div>
        )}

        {/* AI Route Recommendation Floating Card (Bottom Right) */}
        {selectedVehicle?.trip && (
          <div className="absolute bottom-6 right-6 z-40 w-72 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-soft-xl border border-indigo-100 dark:border-slate-700 p-4 animate-slide-in">
             <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-wide">
                <Activity className="w-4 h-4" /> AI Route Optimization Active
             </div>
             <p className="text-[10px] text-slate-500 mb-2">Continuously monitoring traffic and road conditions.</p>
             <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>Optimal Route:</span> <span className="font-semibold text-slate-800">{settings.route_optimization_mode || 'Fastest (Toll)'}</span></div>
                <div className="flex justify-between"><span>Est. Fuel Cost:</span> <span className="font-semibold text-emerald-650">{settings.currency.split(' ')[1] || '₹'}{(selectedVehicle.trip.distance * (settings.currency.includes('USD') ? 0.12 : 10)).toFixed(0)}</span></div>
             </div>
          </div>
        )}
      </div>

      {/* RIGHT 25% INFO PANEL */}
      <div className="w-1/4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-lg flex flex-col overflow-hidden">
        {selectedVehicle ? (
           <div className="h-full flex flex-col">
             <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
               <h3 className="font-bold text-sm">Tracking Details</h3>
               <button onClick={() => setSelectedVehicle(null)} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-5">
               {/* Trip Overview */}
               <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Trip Overview</h4>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Trip ID</span> <span className="font-semibold">#{selectedVehicle.trip?.id || 'Idle'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Pickup</span> <span className="font-semibold">{selectedVehicle.trip?.pickup || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Destination</span> <span className="font-semibold">{selectedVehicle.trip?.destination || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Current ETA</span> <span className="font-bold text-indigo-600">{selectedVehicle.trip?.eta || '-'}</span></div>
                  </div>
               </div>

               {/* Fuel & Analytics */}
               <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Analytics</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                     <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg p-2 flex flex-col items-center justify-center">
                        <Fuel className="w-4 h-4 mb-1" />
                        <span className="font-bold">{calculateFuelAnalytics(selectedVehicle.trip?.distance || 0, selectedVehicle).fuelUsed} L</span>
                        <span className="text-[9px]">Fuel Used</span>
                     </div>
                     <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg p-2 flex flex-col items-center justify-center">
                        <Clock className="w-4 h-4 mb-1" />
                        <span className="font-bold">{selectedVehicle.driver?.working_hours || 0} hrs</span>
                        <span className="text-[9px]">Working Hours</span>
                     </div>
                  </div>
               </div>

               {/* Timeline */}
               {selectedVehicle.trip && (
                 <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Live Timeline</h4>
                    <div className="relative pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-4">
                       <div className="relative">
                          <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white"></div>
                          <p className="text-[10px] text-slate-400">Assigned</p>
                          <p className="text-xs font-semibold">Driver accepted load</p>
                       </div>
                       <div className="relative">
                          <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white"></div>
                          <p className="text-[10px] text-slate-400">In Transit</p>
                          <p className="text-xs font-semibold">Departed pickup location</p>
                       </div>
                       {selectedVehicle.trip.status === 'Problem' && (
                         <div className="relative">
                            <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white"></div>
                            <p className="text-[10px] text-red-500">Alert</p>
                            <p className="text-xs font-semibold text-red-600">Delay / Breakdown reported</p>
                         </div>
                       )}
                    </div>
                 </div>
               )}

               {/* Simulator Triggers */}
               {selectedVehicle.trip && (
                 <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Simulation Events</span>
                    <button 
                      onClick={() => triggerSimulation(selectedVehicle.trip.id, 'traffic')}
                      disabled={!!loadingEvent}
                      className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2"
                    ><TrafficCone className="w-3.5 h-3.5" /> Force Traffic Detour</button>
                    
                    <button 
                      onClick={() => triggerSimulation(selectedVehicle.trip.id, 'breakdown')}
                      disabled={!!loadingEvent}
                      className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/30 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2"
                    ><AlertTriangle className="w-3.5 h-3.5" /> Force Breakdown</button>
                    
                    <button 
                      onClick={() => triggerSimulation(selectedVehicle.trip.id, 'complete')}
                      disabled={!!loadingEvent}
                      className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2"
                    ><CheckCircle className="w-3.5 h-3.5" /> Force Completion</button>
                 </div>
               )}
             </div>
           </div>
        ) : (
           <div className="h-full flex flex-col font-sans">
             <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
               <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Fleet Vehicles ({vehicles.length})</h3>
               <p className="text-[10px] text-slate-400">Click any truck to inspect live route tracking & telemetry</p>
             </div>
             <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
               {vehicles.map(v => {
                 const driver = drivers.find(d => d.vehicle_id === v.id);
                 const trip = trips.find(t => t.vehicle_id === v.id && t.status !== 'Completed');
                 return (
                   <button
                     key={v.id}
                     type="button"
                     onClick={() => {
                       setSelectedVehicle({ ...v, driver, trip });
                       if (mapRef.current) {
                         const lat = v.latitude || 13.0827;
                         const lng = v.longitude || 80.2707;
                         mapRef.current.flyTo([lat, lng], 8, { duration: 1 });
                       }
                     }}
                     className="w-full text-left p-3 rounded-xl border border-slate-150 dark:border-slate-800 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all flex flex-col gap-1.5 cursor-pointer shadow-soft-sm"
                   >
                     <div className="flex justify-between items-center">
                       <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                         <Truck className="w-3.5 h-3.5 text-primary-500" />
                         {v.vehicle_number}
                       </span>
                       <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                         (v.availability as string) === 'In Transit' || v.availability === 'On Duty' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' :
                         v.availability === 'Maintenance' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400' :
                         'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                       }`}>
                         {v.availability || 'Available'}
                       </span>
                     </div>
                     <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                       <span>Driver: <strong className="text-slate-700 dark:text-slate-300">{driver?.name || 'Unassigned'}</strong></span>
                       <span>Speed: <strong className="text-slate-700 dark:text-slate-300">{v.speed || 0} km/h</strong></span>
                       <span>Fuel: <strong className="text-emerald-600 dark:text-emerald-400">{v.fuel || 100}%</strong></span>
                       <span>Odometer: <strong className="text-slate-700 dark:text-slate-300">{v.odometer || 0} km</strong></span>
                     </div>
                     {trip && (
                       <div className="border-t pt-1.5 border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex justify-between">
                         <span className="truncate">Route: {trip.pickup} → {trip.destination}</span>
                         <span className="font-bold text-indigo-600 dark:text-indigo-400">#{trip.id}</span>
                       </div>
                     )}
                   </button>
                 );
               })}
             </div>
           </div>
        )}
      </div>
    </div>
  );
}

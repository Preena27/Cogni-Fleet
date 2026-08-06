import React, { useEffect, useState, useRef } from 'react';
import { useAppContext } from '../App';
import L from 'leaflet';
import { 
  Navigation, 
  MapPin, 
  Check, 
  X, 
  FileText, 
  Camera, 
  PenTool, 
  CheckCircle,
  Truck,
  ArrowRight,
  Clock,
  ShieldAlert,
  AlertTriangle,
  Play,
  Pause,
  History,
  Info,
  Calendar,
  AlertOctagon,
  User,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react';
import { CameraCapture } from '../components/CameraCapture';

// IndexedDB Helper Functions
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("CogniFleetOfflineStore", 1);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("gps_logs")) {
        db.createObjectStore("gps_logs", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("sync_queue")) {
        db.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

const queueForSync = async (endpoint: string, method: string, payload: any) => {
  try {
    const db = await openDB();
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    store.add({ endpoint, method, payload, timestamp: new Date().toISOString() });
    console.log("Queued offline action successfully:", endpoint);
  } catch (err) {
    console.error("Failed to write to IndexedDB:", err);
  }
};

const logGPSOffline = async (tripId: number, lat: number, lng: number, speed: number) => {
  try {
    const db = await openDB();
    const tx = db.transaction("gps_logs", "readwrite");
    const store = tx.objectStore("gps_logs");
    store.add({ tripId, lat, lng, speed, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Failed to save GPS log to IndexedDB:", err);
  }
};

export default function DriverApp() {
  const { trips, drivers, vehicles, refreshAll, addToast, currentUser, secureFetch } = useAppContext();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'active-trip' | 'history' | 'incidents'>('dashboard');
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Signature & photo states
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  
  // Drawing Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Rejection state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('Vehicle Issues');
  const [rejectNotes, setRejectNotes] = useState('');

  // Simulation journey stats
  const [isPaused, setIsPaused] = useState(false);
  const [simSpeed, setSimSpeed] = useState(55);
  const [simProgress, setSimProgress] = useState(0); // 0 to 100 percentage
  const [remainingTime, setRemainingTime] = useState(480); // in minutes
  const [remainingDist, setRemainingDist] = useState(620.0); // in km
  
  // Auto-stopped prompt state
  const [showStoppedReasonModal, setShowStoppedReasonModal] = useState(false);
  const [stoppedReasonSelection, setStoppedReasonSelection] = useState('Traffic');
  const [stoppedNotes, setStoppedNotes] = useState('');
  
  // Incident filing state
  const [issueType, setIssueType] = useState('Vehicle Breakdown');
  const [issueDesc, setIssueDesc] = useState('');
  const [issuePriority, setIssuePriority] = useState('High');
  const routeMapRef = useRef<HTMLDivElement | null>(null);

  // Network Connectivity Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast("Online Mode", "Network connection restored. Syncing offline updates...", "success");
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast("Offline Mode", "Network disconnected. Operation logs will cache locally.", "warning");
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Offline Sync Queue Processor
  const syncOfflineQueue = async () => {
    if (!navigator.onLine) return;
    try {
      const db = await openDB();
      const tx = db.transaction("sync_queue", "readonly");
      const store = tx.objectStore("sync_queue");
      const request = store.getAll();
      
      request.onsuccess = async (event: any) => {
        const items = event.target.result;
        if (!items || items.length === 0) return;
        
        console.log(`Syncing ${items.length} offline operations...`);
        let successCount = 0;
        
        for (const item of items) {
          try {
            const res = await secureFetch(item.endpoint, {
              method: item.method,
              body: item.payload ? JSON.stringify(item.payload) : undefined
            });
            if (res.ok) {
              successCount++;
              const deleteTx = db.transaction("sync_queue", "readwrite");
              deleteTx.objectStore("sync_queue").delete(item.id);
            }
          } catch (err) {
            console.error("Sync item failed:", item, err);
            break; // Pause loop on error (retry next window)
          }
        }
        if (successCount > 0) {
          addToast("Data Synchronized", `Synced ${successCount} operation tasks with dispatch room.`, "success");
          refreshAll();
        }
      };
    } catch (err) {
      console.error("Sync processor error:", err);
    }
  };

  useEffect(() => {
    if (isOnline) {
      syncOfflineQueue();
    }
  }, [isOnline]);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (isOnline) {
        syncOfflineQueue();
      }
    }, 20000);
    return () => clearInterval(syncInterval);
  }, [isOnline]);

  // Resolve matching active driver profiles
  const matchedDriver = drivers.find(d => d.user_id === currentUser?.id) || drivers.find(d => d.name === currentUser?.username) || drivers.find(d => d.email === currentUser?.email);
  const driver = matchedDriver || drivers[0] || {
    id: 1,
    name: "John Davis",
    working_hours: 5.5,
    availability: "Available",
    vehicle_id: 1
  };

  const fetchDriverTrips = () => {
    if (!driver) return;
    const items = trips.filter(t => Number(t.driver_id) === Number(driver.id));
    setDriverTrips(items);
  };

  useEffect(() => {
    fetchDriverTrips();
  }, [trips, drivers]);

  // Simulated speed/distance counter when active trip is In Transit
  const activeTrip = driverTrips.find(t => t.status !== 'Completed');
  const pastTrips = driverTrips.filter(t => t.status === 'Completed');

  // Determine vehicle relation
  const currentVehicleId = activeTrip ? activeTrip.vehicle_id : driver.vehicle_id;
  const vehicle = vehicles.find(v => Number(v.id) === Number(currentVehicleId)) || {
    id: 1,
    vehicle_number: "TRK-101",
    registration: "CA-992-FX",
    type: "Semi-Truck",
    health: 98,
    fuel: 85,
    availability: "Available"
  };

  useEffect(() => {
    let interval: any;
    if (activeTrip && activeTrip.status === 'In Transit' && !isPaused) {
      interval = setInterval(() => {
        setSimProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          const next = prev + 1;
          const distPct = (100 - next) / 100;
          setRemainingDist(parseFloat((activeTrip.distance * distPct).toFixed(1)));
          setRemainingTime(Math.round(480 * distPct));
          return next;
        });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeTrip, isPaused]);

  useEffect(() => {
    const mapContainer = routeMapRef.current;
    if (!mapContainer || !activeTrip || !activeTrip.route_coordinates) return;

    let map: L.Map | null = null;
    
    const initMap = async () => {
      try {
        const coords = JSON.parse(activeTrip.route_coordinates);
        if (!Array.isArray(coords) || coords.length < 2) return;

        map = L.map(mapContainer, {
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false
        }).setView(coords[0], 6);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18
        }).addTo(map!);

        const startMarker = L.marker(coords[0]).addTo(map!);
        const endMarker = L.marker(coords[coords.length - 1]).addTo(map!);
        startMarker.bindPopup('Pickup');
        endMarker.bindPopup('Destination');

        // Fetch accurate route from OSRM
        const start = coords[0];
        const end = coords[coords.length - 1];
        try {
          const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
          const data = await response.json();
          if (data.routes && data.routes.length > 0) {
            const routeGeoJSON = data.routes[0].geometry;
            const routeCoords = routeGeoJSON.coordinates.map((c: number[]) => [c[1], c[0]]);
            const routeLine = L.polyline(routeCoords, { color: '#3b82f6', weight: 4, opacity: 0.9 }).addTo(map!);
            map!.fitBounds(routeLine.getBounds(), { padding: [20, 20] });
          } else {
            const routeLine = L.polyline(coords, { color: '#3b82f6', weight: 4, opacity: 0.9 }).addTo(map!);
            map!.fitBounds(routeLine.getBounds(), { padding: [20, 20] });
          }
        } catch (e) {
          const routeLine = L.polyline(coords, { color: '#3b82f6', weight: 4, opacity: 0.9 }).addTo(map!);
          map!.fitBounds(routeLine.getBounds(), { padding: [20, 20] });
        }
      } catch (err) {
        console.error('Failed to render route map:', err);
      }
    };
    
    initMap();

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, [activeTrip]);

  // Offline GPS Logger loop
  useEffect(() => {
    let gpsInterval: any;
    if (activeTrip && activeTrip.status === 'In Transit' && !isPaused) {
      gpsInterval = setInterval(async () => {
        const lat = 13.0827 + (11.0168 - 13.0827) * (simProgress / 100);
        const lng = 80.2707 + (76.9558 - 80.2707) * (simProgress / 100);
        
        if (!isOnline) {
          await logGPSOffline(activeTrip.id, lat, lng, simSpeed);
          console.log(`Offline GPS cached: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      }, 8000);
    }
    return () => clearInterval(gpsInterval);
  }, [activeTrip, isPaused, simProgress, isOnline, simSpeed]);

  // Auto Stopped Check (stationary prompt)
  useEffect(() => {
    let stoppedTimer: any;
    if (activeTrip && activeTrip.status === 'In Transit' && isPaused) {
      stoppedTimer = setTimeout(() => {
        setShowStoppedReasonModal(true);
      }, 10000);
    }
    return () => clearTimeout(stoppedTimer);
  }, [activeTrip, isPaused]);

  // Acceptance / Rejection Handler
  const handleTripResponse = async (tripId: number, accept: boolean) => {
    // Optimistic Update for immediate UI feedback
    setDriverTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: accept ? 'Accepted' : 'Unassigned' } : t));
    
    const endpoint = `http://localhost:8000/api/trips/${tripId}/accept?accept=${accept}${!accept ? `&reason=${encodeURIComponent(rejectReason + ': ' + rejectNotes)}` : ''}`;
    
    if (!isOnline) {
      await queueForSync(endpoint, 'POST', null);
      addToast("Offline Action Queued", "Response registered locally. Will sync with dispatcher automatically.", "info");
      setShowRejectModal(false);
      return;
    }

    try {
      const res = await secureFetch(endpoint, { method: 'POST' });
      if (res.ok) {
        addToast(
          accept ? "Trip Accepted" : "Trip Rejected", 
          accept ? "Dispatch schedule locked. Depart when ready." : "Load rejected. Management notified.", 
          accept ? "success" : "warning"
        );
        setShowRejectModal(false);
        setRejectNotes('');
        refreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Start Trip Transit Route
  const handleStartTrip = async (tripId: number) => {
    // Optimistic Update for immediate UI feedback
    setDriverTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: 'In Transit' } : t));
    setIsPaused(false);
    setSimProgress(0);
    
    const endpoint = `http://localhost:8000/api/trips/${tripId}/start`;
    
    if (!isOnline) {
      await queueForSync(endpoint, 'POST', null);
      addToast("Offline Transit Started", "GPS Tracking initialized locally.", "info");
      return;
    }

    try {
      const res = await secureFetch(endpoint, { method: 'POST' });
      if (res.ok) {
        addToast("Trip Started", "Live navigation tracking activated. GPS active.", "success");
        setIsPaused(false);
        setSimProgress(0);
        setRemainingDist(activeTrip?.distance || 620);
        setRemainingTime(480);
        refreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Pause / Resume Trip Simulation
  const handlePauseResume = async (tripId: number, pause: boolean) => {
    const endpoint = `http://localhost:8000/api/trips/${tripId}/${pause ? 'pause' : 'resume'}`;
    
    if (!isOnline) {
      await queueForSync(endpoint, 'POST', null);
      addToast("Offline Update Cached", pause ? "Rest break cached." : "Resumed driving cached.", "info");
      setIsPaused(pause);
      setSimSpeed(pause ? 0 : 55);
      return;
    }

    try {
      const res = await secureFetch(endpoint, { method: 'POST' });
      if (res.ok) {
        setIsPaused(pause);
        setSimSpeed(pause ? 0 : 55);
        addToast(
          pause ? "Transit Paused" : "Transit Resumed", 
          pause ? "Speed set to 0. Logged as stopped state." : "Speed restored to 55. GPS tracking moving.", 
          "info"
        );
        refreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Stopped Reason
  const handleSubmitStoppedReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) return;
    const endpoint = `http://localhost:8000/api/trips/${activeTrip.id}/stopped-reason`;
    const payload = {
      reason: stoppedReasonSelection,
      location: "I-5 Highway Mile 182",
      duration: 12.0
    };

    if (!isOnline) {
      await queueForSync(endpoint, 'POST', payload);
      addToast("Offline Log Queued", "Stoppage reason cached locally.", "info");
      setShowStoppedReasonModal(false);
      return;
    }

    try {
      const res = await secureFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        addToast("Report Filed", "Stopped reason logged. Manager Dashboard updated.", "success");
        setShowStoppedReasonModal(false);
        setStoppedNotes('');
        refreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Report Issue
  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) {
      addToast("Active Load Required", "You must have an active trip assignment to file operational issue reports.", "warning");
      return;
    }
    const endpoint = `http://localhost:8000/api/trips/${activeTrip.id}/report-issue`;
    const payload = {
      issue_type: issueType,
      description: issueDesc,
      priority: issuePriority,
      gps: "13.0827, 80.2707"
    };

    if (!isOnline) {
      await queueForSync(endpoint, 'POST', payload);
      addToast("Offline Incident Queued", "Warning warning queued. Will sync immediately upon connection.", "info");
      setIssueDesc('');
      setActiveTab('active-trip');
      return;
    }

    try {
      const res = await secureFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        addToast("Issue Transmitted", "Warning alerts generated on manager dashboard panels.", "error");
        setIssueDesc('');
        setActiveTab('active-trip');
        refreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // SOS Emergency Trigger
  const handleSOSTrigger = async () => {
    if (!activeTrip) {
      addToast("No active trip", "Critical alarms require active load logs.", "warning");
      return;
    }
    const endpoint = `http://localhost:8000/api/trips/${activeTrip.id}/sos`;
    const payload = { gps: "11.6643, 78.1460" };

    if (!isOnline) {
      await queueForSync(endpoint, 'POST', payload);
      addToast("SOS Alert Queued", "SOS alert stored locally. Syncing immediately on connection.", "error");
      return;
    }

    try {
      const res = await secureFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        addToast("CRITICAL SOS ACTIVATED", "Emergency alerts flashed on all manager dashboard consoles.", "error");
        refreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // End journey / final submit
  const handleEndTrip = async (tripId: number) => {
    if (!signatureData || !photoData) {
      addToast("Incomplete Proofs", "You must verify your drawing signature and scan cargo photos before ending.", "warning");
      return;
    }
    const endpoint = `http://localhost:8000/api/trips/${tripId}/end`;
    const payload = {
      duration: 462.5,
      average_speed: 51.8,
      idle_time: 18.0,
      route_taken: [
        [13.0827, 80.2707],
        [11.6643, 78.1460],
        [11.0168, 76.9558]
      ]
    };

    if (!isOnline) {
      await queueForSync(endpoint, 'POST', payload);
      addToast("Offline Journey Ended", "Complete delivery sequence cached locally.", "info");
      setDriverTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: 'Completed' } : t));
      setSignatureData(null);
      setPhotoData(null);
      setActiveTab('dashboard');
      return;
    }

    try {
      const res = await secureFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        addToast("Journey Completed", "Verification completed. Logs archived. Status set to Available.", "success");
        setSignatureData(null);
        setPhotoData(null);
        setActiveTab('dashboard');
        refreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Canvas drawing logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData(null);
    }
  };

  // Upload proof of delivery files
  const handlePhotoCaptureConfirm = async (base64Image: string) => {
    if (!activeTrip) return;
    const endpoint = 'http://localhost:8000/api/pods/submit';
    const payload = {
      trip_id: activeTrip.id,
      signature_path: signatureData || "data:image/svg+xml;utf8,<svg></svg>",
      photo_path: base64Image
    };

    if (!isOnline) {
      await queueForSync(endpoint, 'POST', payload);
      setPhotoData(base64Image);
      addToast("Offline POD Queued", "Cargo conditions snapshot cached locally.", "info");
      return;
    }

    try {
      const res = await secureFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setPhotoData(base64Image);
        addToast("POD Uploaded", "Proof of delivery image confirmed and saved.", "success");
        refreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const changeDriverStatus = async (status: string) => {
    if (!isOnline) {
      addToast("Offline Status Saved", `Operator status changed locally.`, "info");
      return;
    }
    try {
      const res = await secureFetch(`http://localhost:8000/api/drivers/${driver.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...driver,
          availability: status
        })
      });
      if (res.ok) {
        addToast("Profile Sync", `Availability status changed to ${status}.`, "success");
        refreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-140px)] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-soft-lg flex flex-col overflow-hidden font-sans">
      
      {/* Network Connectivity Status Banner */}
      <div className={`px-4 py-2 text-[9px] font-bold text-center flex items-center justify-center gap-1.5 transition-all ${
        isOnline 
          ? 'bg-emerald-500/10 text-emerald-600 border-b border-emerald-500/15' 
          : 'bg-amber-500/10 text-amber-600 border-b border-amber-500/15 animate-pulse'
      }`}>
        {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 animate-ping" />}
        {isOnline 
          ? 'SECURE DISPATCH CONNECTION ACTIVE' 
          : 'OFFLINE MODE ACTIVE • OPERATION TASKS LOGGED LOCALLY'}
      </div>

      {/* App Mobile Header */}
      <div className="bg-primary-600 px-5 py-3.5 text-white flex items-center justify-between shadow-soft-sm shrink-0">
        <div className="flex items-center gap-2">
          <Truck className="w-5.5 h-5.5 text-white" />
          <h2 className="font-bold text-sm tracking-tight uppercase">CogniFleet Mobile</h2>
        </div>
        
        {/* Floating SOS button */}
        {activeTrip && (activeTrip.status === 'In Transit' || activeTrip.status === 'Problem') && (
          <button 
            onClick={handleSOSTrigger}
            className="px-3.5 py-1 bg-red-600 hover:bg-red-750 text-[10px] font-bold tracking-wider uppercase rounded-full shadow-md animate-pulse flex items-center gap-1 text-white border border-red-500 cursor-pointer"
          >
            <AlertOctagon className="w-3.5 h-3.5" /> SOS
          </button>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="flex bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold tracking-wider shrink-0 text-slate-550">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${activeTab === 'dashboard' ? 'border-primary-500 text-primary-600 font-bold bg-slate-50/50 dark:bg-slate-800/10' : 'border-transparent'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('active-trip')}
          className={`flex-1 py-3 text-center border-b-2 transition-colors relative cursor-pointer ${activeTab === 'active-trip' ? 'border-primary-500 text-primary-600 font-bold bg-slate-50/50 dark:bg-slate-800/10' : 'border-transparent'}`}
        >
          Active Trip
          {activeTrip && (
            <span className="absolute top-2.5 right-2 w-2 h-2 rounded-full bg-red-500 animate-ping" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab('incidents')}
          className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${activeTab === 'incidents' ? 'border-primary-500 text-primary-600 font-bold bg-slate-50/50 dark:bg-slate-800/10' : 'border-transparent'}`}
        >
          Incident
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${activeTab === 'history' ? 'border-primary-500 text-primary-600 font-bold bg-slate-50/50 dark:bg-slate-800/10' : 'border-transparent'}`}
        >
          History
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        
        {/* PANEL A: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-4 animate-scale-in">
            {/* Driver Profile card */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{driver.name}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Assigned Vehicle: <span className="font-bold text-slate-650 dark:text-slate-350">{vehicle.vehicle_number}</span> ({vehicle.type})</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[8px] uppercase text-slate-450 font-bold tracking-wider">Status</span>
                <select
                  value={driver.availability}
                  onChange={e => changeDriverStatus(e.target.value)}
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 border-none focus:outline-none cursor-pointer"
                >
                  <option value="Available">Available</option>
                  <option value="Off Duty">Off Duty</option>
                  <option value="Break">On Break</option>
                </select>
              </div>
            </div>

            {/* Truck Collaboration stats */}
            <div className="p-4 bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col gap-2">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-primary-500" />
                Truck Diagnostics (Collaboration sync)
              </span>
              <div className="grid grid-cols-3 gap-2.5 text-center mt-1">
                <div className="p-2 rounded bg-white dark:bg-slate-900 border">
                  <span className="text-[8px] text-slate-400 block">Health Gauge</span>
                  <span className="font-bold text-xs text-emerald-600">{vehicle.health}%</span>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-900 border">
                  <span className="text-[8px] text-slate-400 block">Fuel Tank</span>
                  <span className="font-bold text-xs text-amber-600">{vehicle.fuel}%</span>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-900 border">
                  <span className="text-[8px] text-slate-400 block">Truck Status</span>
                  <span className={`font-bold text-xs ${vehicle.availability === 'Available' ? 'text-emerald-500' : 'text-indigo-500'}`}>
                    {vehicle.availability}
                  </span>
                </div>
              </div>
            </div>

            {/* Summary statistics grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl shadow-soft-sm flex flex-col gap-1">
                <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-500" /> Driving Hours</span>
                <span className="text-xl font-bold text-slate-850 dark:text-white mt-1">{driver.working_hours} hrs</span>
                <span className="text-[8px] text-slate-400">Total hours logged today</span>
              </div>
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl shadow-soft-sm flex flex-col gap-1">
                <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5 text-emerald-500" /> Legal Limit</span>
                <span className="text-xl font-bold text-slate-850 dark:text-white mt-1">{(11.0 - driver.working_hours).toFixed(1)} hrs</span>
                <span className="text-[8px] text-slate-400">Remaining driving limit</span>
              </div>
            </div>
            
            {/* Guidelines */}
            <div className="p-4 bg-primary-50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/50 rounded-xl text-xs flex flex-col gap-1.5">
              <h4 className="font-bold text-primary-750 dark:text-primary-350 flex items-center gap-1"><Info className="w-4 h-4 shrink-0" /> Operator Protocol</h4>
              <p className="text-slate-650 dark:text-slate-400 leading-relaxed text-[11px]">
                Confirm you are set to **Available** to receive dispatch requests. Working driving logs, stoppages, and delivery photo coordinates sync directly with dispatch logs.
              </p>
            </div>
          </div>
        )}

        {/* PANEL B: ACTIVE TRIP ACTIONS */}
        {activeTab === 'active-trip' && (
          <div className="flex flex-col gap-4 animate-scale-in">
            {activeTrip ? (
              <div className="flex flex-col gap-4">
                
                {/* 1. Trip details (Accept/Reject flow) */}
                {activeTrip.status === 'Assigned' && (
                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md flex flex-col gap-4 animate-scale-in text-xs">
                    <div className="flex justify-between items-start border-b pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-amber-500 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 animate-pulse" />
                          New Assignment Pending
                        </span>
                        <h3 className="font-bold text-sm text-slate-805 dark:text-slate-100 mt-1">Trip #{activeTrip.id}</h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-850 dark:bg-amber-950/20 dark:text-amber-400`}>
                        Priority: {activeTrip.priority}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[11px] border-b pb-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-450 font-medium">Customer</span>
                        <span className="font-bold text-slate-705 dark:text-slate-300">{activeTrip.customer}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-450 font-medium">Cargo Detail</span>
                        <span className="font-bold text-slate-705 dark:text-slate-300">{activeTrip.cargo_type} ({activeTrip.weight} Tons)</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-455 font-medium">Est. Distance</span>
                        <span className="font-bold text-slate-705 dark:text-slate-300">{activeTrip.distance} mi</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-455 font-medium">Est. Duration</span>
                        <span className="font-bold text-slate-705 dark:text-slate-300">8 hrs (approx)</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-slate-400 font-medium text-[11px]">Route Summary</span>
                      <div className="flex items-center gap-2 p-2.5 rounded bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                        <MapPin className="w-4 h-4 text-primary-500 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-650 dark:text-slate-300 line-clamp-1">{activeTrip.pickup}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-650 dark:text-slate-300 line-clamp-1">{activeTrip.destination}</span>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => setShowRejectModal(true)}
                        className="flex-1 py-2 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-650 dark:text-red-400 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" /> Reject Load
                      </button>
                      <button 
                        onClick={() => handleTripResponse(activeTrip.id, true)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-soft-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> Accept & Load
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Loading stage */}
                {activeTrip.status === 'Accepted' && (
                  <div className="p-4 bg-white dark:bg-slate-900 border rounded-xl shadow-soft-sm flex flex-col gap-3 text-xs">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="font-bold text-slate-805 dark:text-slate-100">At Dock Gate</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-750 font-bold dark:bg-indigo-950/20 dark:text-indigo-400">Loading Cargo</span>
                    </div>
                    <p className="text-slate-450 leading-relaxed">
                      Your truck **{vehicle.vehicle_number}** is queued at **{activeTrip.pickup}** warehouse. Await cargo load completion, then depart.
                    </p>
                    <button 
                      onClick={() => handleStartTrip(activeTrip.id)}
                      className="w-full py-2.5 bg-primary-600 hover:bg-primary-750 text-white font-bold rounded-lg shadow-soft-sm flex items-center justify-center gap-1.5 transition-colors text-xs cursor-pointer"
                    >
                      <Play className="w-4 h-4" /> Depart Dock & Start Route
                    </button>
                  </div>
                )}

                {/* 3. Live Transit navigation screen */}
                {(activeTrip.status === 'In Transit' || activeTrip.status === 'Problem') && (
                  <div className="flex flex-col gap-4">
                    {/* Live Navigation Widget */}
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md flex flex-col gap-3.5 text-xs">
                      
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                          {isPaused ? 'Simulation Paused' : 'In Transit (Moving)'}
                        </span>
                        <span className="font-mono text-slate-500">{simProgress}% Traveled</span>
                      </div>

                      {/* Optimized route map */}
                      <div className="h-44 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-850">
                        <div ref={routeMapRef} className="w-full h-full" />
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2.5 text-center py-1">
                        <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800">
                          <span className="text-[8px] text-slate-400 uppercase font-semibold">Speed</span>
                          <p className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{simSpeed} mph</p>
                        </div>
                        <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800">
                          <span className="text-[8px] text-slate-400 uppercase font-semibold">ETA</span>
                          <p className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{remainingTime} mins</p>
                        </div>
                        <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800">
                          <span className="text-[8px] text-slate-400 uppercase font-semibold">Dist. Left</span>
                          <p className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{remainingDist} mi</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {isPaused ? (
                          <button 
                            onClick={() => handlePauseResume(activeTrip.id, false)}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-soft-sm flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Play className="w-4 h-4" /> Resume Journey
                          </button>
                        ) : (
                          <button 
                            onClick={() => handlePauseResume(activeTrip.id, true)}
                            className="flex-1 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-300 font-bold rounded-lg shadow-soft-sm flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Pause className="w-4 h-4" /> Register Rest Stop
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Proof of Delivery form */}
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-105 dark:border-slate-800 rounded-xl shadow-soft-md flex flex-col gap-4 text-xs">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <PenTool className="w-4 h-4 text-indigo-500" />
                        <span>Confirm Delivery & POD</span>
                      </h4>

                      <div className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Sign Pad</span>
                        <div className="border rounded-lg bg-slate-50 dark:bg-slate-800/10 overflow-hidden relative border-slate-200 dark:border-slate-800">
                          <canvas 
                            ref={canvasRef}
                            width={320}
                            height={120}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="w-full h-[120px] cursor-crosshair touch-none bg-white dark:bg-slate-900"
                          />
                          <button 
                            type="button" 
                            onClick={clearCanvas}
                            className="absolute right-2 bottom-2 px-2 py-0.5 border rounded text-[9px] hover:bg-slate-100 dark:hover:bg-slate-800 font-bold border-slate-200 dark:border-slate-800"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-3 border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="font-semibold text-slate-500">Cargo Snapshot</span>
                          <p className="text-[10px] text-slate-400">Capture load condition photos</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {photoData && (
                            <img src={photoData} alt="Mini preview" className="w-8 h-8 rounded border object-cover" />
                          )}
                          <button 
                            type="button" 
                            onClick={() => setShowCamera(true)}
                            className={`p-2.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                              photoData ? 'bg-emerald-50 border-emerald-300 text-emerald-500' : 'hover:bg-slate-50 border-slate-200 dark:border-slate-800 text-slate-500'
                            }`}
                          >
                            <Camera className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleEndTrip(activeTrip.id)}
                        disabled={!signatureData || !photoData}
                        className={`w-full py-2.5 font-bold rounded-lg shadow-soft-sm flex items-center justify-center gap-1.5 transition-colors mt-2 text-xs text-white ${
                          signatureData && photoData ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer' : 'bg-slate-350 cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Complete Delivery & End Trip
                      </button>
                    </div>
                  </div>
                )}
                
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl text-slate-400 text-xs gap-3">
                <CheckCircle className="w-10 h-10 text-slate-305" />
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-350">Waiting for Assignment</p>
                  <p className="text-[10px] mt-0.5 opacity-80">Roster state: Available for load assignment routing.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PANEL C: REPORT INCIDENTS */}
        {activeTab === 'incidents' && (
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl shadow-soft-md flex flex-col gap-4 animate-scale-in text-xs">
            <h3 className="font-bold text-base text-slate-805 dark:text-slate-100 flex items-center gap-1.5 border-b pb-2">
              <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
              File Route Incident Report
            </h3>
            
            <form onSubmit={handleReportIssue} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Incident Category</label>
                <select
                  value={issueType}
                  onChange={e => setIssueType(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="Vehicle Breakdown">Vehicle Breakdown</option>
                  <option value="Engine Problem">Engine Problem</option>
                  <option value="Flat Tyre">Flat Tyre</option>
                  <option value="Fuel Issue">Fuel Issue</option>
                  <option value="Accident">Accident / Collision</option>
                  <option value="Traffic Delay">Severe Traffic Delay</option>
                  <option value="Road Closed">Road Closure</option>
                  <option value="Weather Problem">Severe Weather Block</option>
                  <option value="Medical Emergency">Medical Emergency</option>
                  <option value="Other">Other Issues</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Severity Rating</label>
                <div className="flex gap-2">
                  {['Low', 'Medium', 'High', 'Critical'].map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setIssuePriority(level)}
                      className={`flex-1 py-1.5 border rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                        issuePriority === level 
                          ? level === 'Critical' ? 'bg-red-650 border-red-650 text-white font-extrabold' 
                            : level === 'High' ? 'bg-amber-500 border-amber-500 text-white font-extrabold' 
                            : 'bg-primary-600 border-primary-600 text-white font-extrabold'
                          : 'bg-transparent text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Report Details</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide precise descriptions of incident delays or mechanical assistance needed..."
                  value={issueDesc}
                  onChange={e => setIssueDesc(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-850 bg-transparent focus:outline-none focus:border-primary-500 font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-red-600 hover:bg-red-750 text-white font-bold rounded-lg shadow-soft-sm flex items-center justify-center gap-1.5 transition-colors mt-2 text-xs cursor-pointer"
              >
                <AlertOctagon className="w-4 h-4" />
                Transmit Incident Report
              </button>
            </form>
          </div>
        )}

        {/* PANEL D: HISTORY LOGS */}
        {activeTab === 'history' && (
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl shadow-soft-md flex flex-col gap-3.5 animate-scale-in text-xs">
            <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <History className="w-4 h-4" />
              CogniFleet Archive logs
            </h4>
            <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
              {pastTrips.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-6">No completed trips recorded in archives.</p>
              ) : (
                pastTrips.map(trip => (
                  <div 
                    key={trip.id}
                    className="p-3 border border-slate-100 dark:border-slate-800 rounded bg-slate-50/50 dark:bg-slate-800/10 flex flex-col gap-1.5"
                  >
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-slate-800 dark:text-slate-150">Trip #{trip.id}</span>
                      <span className="text-[8px] font-bold text-emerald-500 flex items-center gap-0.5 uppercase">
                        <Check className="w-3 h-3" /> Delivered
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      <p className="font-bold">{trip.customer}</p>
                      <p className="mt-0.5">{trip.pickup} → {trip.destination}</p>
                      <div className="flex justify-between items-center border-t mt-2 pt-1.5 border-slate-100 dark:border-slate-800 text-[8px] text-slate-400">
                        <span>Dist: {trip.distance} mi</span>
                        <span>Avg Speed: 52 mph</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* MODAL 1: REJECTION REASON */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in text-xs">
            <h3 className="font-bold text-base text-slate-805 dark:text-slate-150 flex items-center gap-1.5">
              <AlertTriangle className="w-5 h-5 text-red-500 animate-bounce" /> Reject Load Request
            </h3>
            
            <form onSubmit={(e) => { e.preventDefault(); handleTripResponse(activeTrip!.id, false); }} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Reason Category</label>
                <select
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="Vehicle Issues">Vehicle Issues</option>
                  <option value="Route Concerns">Dangerous Route Concerns</option>
                  <option value="Overwork Limit">Driving Hour Limits Reached</option>
                  <option value="Illness">Operator Illness</option>
                  <option value="Personal Reason">Personal / Family Emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Details</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide details on choice for dispatch record..."
                  value={rejectNotes}
                  onChange={e => setRejectNotes(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-850 bg-transparent focus:outline-none font-sans"
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <button 
                  type="button" 
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-red-650 hover:bg-red-750 text-white rounded-lg font-semibold shadow-soft-sm cursor-pointer"
                >
                  Reject & Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AUTO STOPPED QUESTIONNAIRE */}
      {showStoppedReasonModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in text-xs">
            <div className="flex items-center gap-1.5 border-b pb-2 text-red-500 border-slate-100 dark:border-slate-800">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
              <h3 className="font-bold text-sm">Why are you currently stopped?</h3>
            </div>
            
            <form onSubmit={handleSubmitStoppedReason} className="flex flex-col gap-3">
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Telemetry detected your vehicle was stationary on the route for over 5 minutes. Declare stoppage status.
              </p>
              
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Stoppage Status</label>
                <select
                  value={stoppedReasonSelection}
                  onChange={e => setStoppedReasonSelection(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="Traffic">Traffic Congestion</option>
                  <option value="Loading Goods">Loading Goods</option>
                  <option value="Unloading Goods">Unloading Goods</option>
                  <option value="Fuel Break">Fuel Break</option>
                  <option value="Lunch Break">Meal / Lunch Break</option>
                  <option value="Customer Delay">Customer Delays</option>
                  <option value="Road Block">Road Blockage / Accident</option>
                  <option value="Vehicle Inspection">Vehicle Inspection check</option>
                  <option value="Waiting for Instructions">Awaiting Dispatch Orders</option>
                  <option value="Vehicle Breakdown">Mechanical Breakdown</option>
                  <option value="Accident">Accident Involved</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Stoppage Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional notes (optional)..."
                  value={stoppedNotes}
                  onChange={e => setStoppedNotes(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-850 bg-transparent focus:outline-none font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-primary-600 hover:bg-primary-750 text-white font-bold rounded-lg shadow-soft-sm text-xs mt-1 cursor-pointer"
              >
                Log Status Update
              </button>
            </form>
          </div>
        </div>
      )}

      {/* HTML5 CAMERA OVERLAY VIEW */}
      {showCamera && (
        <CameraCapture 
          onCapture={handlePhotoCaptureConfirm} 
          onClose={() => setShowCamera(false)} 
        />
      )}
    </div>
  );
}

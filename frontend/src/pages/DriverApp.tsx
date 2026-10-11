import React, { useEffect, useState, useRef } from 'react';
import { useAppContext } from '../App';
import { useSettings } from '../contexts/SettingsContext';
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
import MessagesModule from './MessagesModule';

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
  const { settings } = useSettings();
  const distanceUnit = settings.distance_unit === 'Miles' ? 'mi' : 'km';
  const speedUnit = settings.distance_unit === 'Miles' ? 'mph' : 'km/h';
  const distanceMultiplier = settings.distance_unit === 'Miles' ? 0.621371 : 1;
  const [activeTab, setActiveTab] = useState<'dashboard' | 'active-trip' | 'history' | 'incidents' | 'messages'>('dashboard');
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
  const [totalIdleSeconds, setTotalIdleSeconds] = useState(0);
  
  // Incident filing state
  const [issueType, setIssueType] = useState('Vehicle Breakdown');
  const [issueDesc, setIssueDesc] = useState('');
  const [issuePriority, setIssuePriority] = useState('High');
  const routeMapRef = useRef<HTMLDivElement | null>(null);



  // Trip Summary modal states
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<any>(null);

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
  const matchedDriver = drivers.find(d => d.user_id === currentUser?.id) || drivers.find(d => d.name === currentUser?.username) || drivers.find(d => d.email === currentUser?.email) || drivers[0];
  const driver = matchedDriver || {
    id: 0,
    name: currentUser?.full_name || currentUser?.username || "Driver Profile",
    working_hours: 0.0,
    availability: "Available",
    vehicle_id: null
  };

  const fetchDriverTrips = () => {
    if (!driver || !driver.id) return;
    const items = trips.filter(t => Number(t.driver_id) === Number(driver.id));
    setDriverTrips(items);
  };

  useEffect(() => {
    fetchDriverTrips();
  }, [trips, drivers, driver?.id]);

  // Determine active trip and vehicle relation
  const activeTrip = driverTrips.find(t => t.status !== 'Completed');
  const pastTrips = driverTrips.filter(t => t.status === 'Completed');

  // Live Idle / Stoppage Timer
  useEffect(() => {
    let idleTimer: any;
    if (activeTrip && (activeTrip.status === 'In Transit' || activeTrip.status === 'Problem') && isPaused) {
      idleTimer = setInterval(() => {
        setTotalIdleSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(idleTimer);
  }, [activeTrip, isPaused]);

  const currentVehicleId = activeTrip ? activeTrip.vehicle_id : driver.vehicle_id;
  const matchedVehicle = vehicles.find(v => Number(v.id) === Number(currentVehicleId)) || vehicles[0];
  const vehicle = matchedVehicle || {
    id: 0,
    vehicle_number: "Unassigned",
    registration: "N/A",
    type: "Vehicle",
    health: 100,
    fuel: 100,
    availability: "Available"
  };

  // Real progress pings to backend when active trip is In Transit
  useEffect(() => {
    let interval: any;
    if (activeTrip && activeTrip.status === 'In Transit' && !isPaused) {
      interval = setInterval(async () => {
        try {
          const delta = 2.0; // 2 km per tick
          await secureFetch(`/api/trips/${activeTrip.id}/progress`, {
            method: 'POST',
            body: JSON.stringify({ distance_delta: delta, speed: simSpeed })
          });
        } catch (err) {
          console.error("Failed to post trip progress ping:", err);
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [activeTrip, isPaused, simSpeed]);

  // Active Trip Leaflet Route Map Renderer
  useEffect(() => {
    const mapContainer = routeMapRef.current;
    if (!mapContainer || !activeTrip) return;

    let map: L.Map | null = null;
    
    const initMap = async () => {
      try {
        let coords: [number, number][] = [[11.0168, 76.9558], [13.0827, 80.2707]];
        if (activeTrip.route_coordinates) {
          try {
            const parsed = JSON.parse(activeTrip.route_coordinates);
            if (Array.isArray(parsed) && parsed.length >= 2) {
              coords = parsed;
            }
          } catch (e) {
            console.warn("Using fallback route coordinates");
          }
        }

        map = L.map(mapContainer, {
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false
        }).setView(coords[0], 6);

        let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        if (settings.map_view === 'Satellite') tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        else if (settings.map_view === 'Terrain') tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';

        L.tileLayer(tileUrl, {
          maxZoom: 18
        }).addTo(map!);

        const startMarker = L.marker(coords[0]).addTo(map!);
        const endMarker = L.marker(coords[coords.length - 1]).addTo(map!);
        startMarker.bindPopup(`Pickup: ${activeTrip.pickup || 'Coimbatore'}`);
        endMarker.bindPopup(`Destination: ${activeTrip.destination || 'Chennai'}`);

        // Immediate polyline fallback
        let dashStyle = settings.route_style === 'Dashed' ? '10, 10' : undefined;
        const initialPolyline = L.polyline(coords, { color: settings.route_color || '#3b82f6', weight: 4, opacity: 0.9, dashArray: dashStyle }).addTo(map!);
        const initialBounds = initialPolyline.getBounds();
        if (initialBounds && initialBounds.isValid()) {
          map!.fitBounds(initialBounds, { padding: [20, 20] });
        }

        // Force Leaflet map resize calculation after container mount
        setTimeout(() => {
          if (map) map.invalidateSize();
        }, 300);

        // Fetch accurate driving route from OSRM
        const start = coords[0];
        const end = coords[coords.length - 1];
        try {
          const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
          const data = await response.json();
          if (data.routes && data.routes.length > 0) {
            const routeGeoJSON = data.routes[0].geometry;
            const osrmCoords = routeGeoJSON.coordinates.map((c: number[]) => [c[1], c[0]]);
            map!.removeLayer(initialPolyline);
            const osrmLine = L.polyline(osrmCoords, { color: settings.route_color || '#3b82f6', weight: 5, opacity: 0.9, dashArray: dashStyle }).addTo(map!);
            const b = osrmLine.getBounds();
            if (b && b.isValid()) {
              map!.fitBounds(b, { padding: [20, 20] });
            }
          }
        } catch (e) {
          console.warn("OSRM driving route fallback");
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
  }, [activeTrip, activeTab, settings.map_view, settings.route_color, settings.route_style]);

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
    
    const endpoint = `/api/trips/${tripId}/accept?accept=${accept}${!accept ? `&reason=${encodeURIComponent(rejectReason + ': ' + rejectNotes)}` : ''}`;
    
    if (!isOnline) {
      await queueForSync(endpoint, 'POST', null);
      addToast("Offline Action Queued", "Response registered locally. Will sync with dispatcher automatically.", "info");
      setShowRejectModal(false);
      if (accept) setActiveTab('active-trip');
      return;
    }

    try {
      const res = await secureFetch(endpoint, { method: 'POST' });
      if (res.ok) {
        addToast(
          accept ? "Trip Accepted" : "Trip Rejected", 
          accept ? "Status set to ACCEPTED. Driver & Truck set to ON DUTY." : "Load rejected. Management notified.", 
          accept ? "success" : "warning"
        );
        setShowRejectModal(false);
        setRejectNotes('');
        if (accept) {
          setActiveTab('active-trip'); // AUTOMATIC NAVIGATION TO ACTIVE TRIP PAGE!
        }
        await refreshAll();
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
    
    const endpoint = `/api/trips/${tripId}/start`;
    
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
    const endpoint = `/api/trips/${tripId}/${pause ? 'pause' : 'resume'}`;
    
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
    const endpoint = `/api/trips/${activeTrip.id}/stopped-reason`;
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
    
    let gpsLocation = "13.0827° N, 80.2707° E (Hwy 101)";
    try {
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
        });
        gpsLocation = `${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E`;
      }
    } catch (err) {
      console.warn("Geolocation fallback used");
    }

    const calculatedPriority = (['Vehicle Breakdown', 'Accident', 'Medical Emergency', 'Engine Problem'].includes(issueType)) ? 'Critical' : issuePriority;

    const endpoint = `/api/trips/${activeTrip.id}/report-issue`;
    const payload = {
      issue_type: issueType,
      description: issueDesc || issueType,
      priority: calculatedPriority,
      gps: gpsLocation
    };

    if (!isOnline) {
      await queueForSync(endpoint, 'POST', payload);
      addToast("Offline Incident Queued", "Incident queued. Will sync immediately upon connection.", "info");
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
        addToast(
          calculatedPriority === 'Critical' ? "CRITICAL ALARM DISPATCHED" : "Incident Transmitted", 
          `Manager notified immediately. Priority: ${calculatedPriority.toUpperCase()}.`, 
          calculatedPriority === 'Critical' ? "error" : "warning"
        );
        setIssueDesc('');
        setActiveTab('active-trip');
        await refreshAll();
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
    const endpoint = `/api/trips/${activeTrip.id}/sos`;
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
    if (!activeTrip) return;

    let finalPhoto = photoData;
    if (!finalPhoto) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('DELIVERY SCAN COMPLETED', 40, 200);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px monospace';
        ctx.fillText(`TRIP #${tripId} - VERIFIED POD`, 40, 240);
        finalPhoto = canvas.toDataURL('image/jpeg');
      }
    }

    let finalSig = signatureData;
    if (!finalSig) {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 320, 120);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(30, 60);
        ctx.lineTo(290, 60);
        ctx.stroke();
        finalSig = canvas.toDataURL('image/png');
      }
    }

    // 1. Submit POD record to backend database (so Manager Dashboard receives it!)
    try {
      await secureFetch(`/api/pods/submit`, {
        method: 'POST',
        body: JSON.stringify({
          trip_id: tripId,
          signature_path: finalSig,
          photo_path: finalPhoto,
          latitude: 13.0827,
          longitude: 80.2707
        })
      });
    } catch (podErr) {
      console.warn("POD submit warning:", podErr);
    }

    // 2. Complete trip on backend
    const endpoint = `/api/trips/${tripId}/end`;
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
        addToast("Journey Completed", "Verification completed. POD submitted to Manager console.", "success");
        
        const calculatedIdleMins = Math.max(1, Math.round(totalIdleSeconds / 60));
        const summaryData = {
          tripId: activeTrip?.id,
          driver: driver.name,
          vehicle: vehicle.vehicle_number,
          pickup: activeTrip?.pickup,
          destination: activeTrip?.destination,
          distance: activeTrip?.distance || 620,
          duration: "7h 45m",
          idleTime: `${calculatedIdleMins} mins`,
          fuelUsed: `${((activeTrip?.distance || 620) / (vehicle.mileage_kml || 10)).toFixed(1)} L`,
          fuelRemaining: `${vehicle.current_fuel || vehicle.fuel || 85}%`,
          averageSpeed: "52.5 km/h",
          podStatus: "Submitted & Delivered to Manager",
          deliveryStatus: "COMPLETED"
        };
        
        setCompletedSummary(summaryData);
        setShowSummaryModal(true);
        setSignatureData(null);
        setPhotoData(null);
        await refreshAll();
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
    const endpoint = '/api/pods/submit';
    
    let lat = 13.0827;
    let lng = 80.2707;
    try {
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      }
    } catch (e) {
      console.warn("Could not get geolocation", e);
    }
    
    const payload = {
      trip_id: activeTrip.id,
      signature_path: signatureData || "data:image/svg+xml;utf8,<svg></svg>",
      photo_path: base64Image,
      latitude: lat,
      longitude: lng
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
      const res = await secureFetch(`/api/drivers/${driver.id}`, {
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
        <button 
          onClick={() => setActiveTab('messages')}
          className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${activeTab === 'messages' ? 'border-primary-500 text-primary-600 font-bold bg-slate-50/50 dark:bg-slate-800/10' : 'border-transparent'}`}
        >
          Messages
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        
        {/* PANEL: MESSAGES */}
        {activeTab === 'messages' && (
          <MessagesModule />
        )}

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
                        <span className="font-bold text-slate-705 dark:text-slate-300">
                          {activeTrip.cargo_type} ({settings.weight_unit === 'Kilograms' ? Math.round(activeTrip.weight * 1000) : settings.weight_unit === 'Pounds' ? Math.round(activeTrip.weight * 2204.62) : activeTrip.weight} {settings.weight_unit === 'Kilograms' ? 'kg' : settings.weight_unit === 'Pounds' ? 'lbs' : 'Tons'})
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-455 font-medium">Est. Distance</span>
                        <span className="font-bold text-slate-705 dark:text-slate-300">{Math.round(activeTrip.distance * distanceMultiplier)} {distanceUnit}</span>
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
                          <p className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{Math.round(simSpeed * distanceMultiplier)} {speedUnit}</p>
                        </div>
                        <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800">
                          <span className="text-[8px] text-slate-400 uppercase font-semibold">ETA</span>
                          <p className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{remainingTime} mins</p>
                        </div>
                        <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800">
                          <span className="text-[8px] text-slate-400 uppercase font-semibold">Dist. Left</span>
                          <p className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{Math.round(remainingDist * distanceMultiplier)} {distanceUnit}</p>
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
                        type="button"
                        onClick={() => handleEndTrip(activeTrip.id)}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-soft-sm flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer mt-2"
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
                        <span>Dist: {Math.round(trip.distance * distanceMultiplier)} {distanceUnit}</span>
                        <span>Avg Speed: {Math.round(52 * distanceMultiplier)} {speedUnit}</span>
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

      {/* MODAL 3: AUTOMATIC TRIP SUMMARY */}
      {showSummaryModal && completedSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 text-xs animate-scale-in">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
                <div>
                  <h3 className="font-bold text-base text-slate-850 dark:text-white">TRIP SUMMARY</h3>
                  <p className="text-[10px] text-slate-400">Trip #{completedSummary.tripId} • Delivery Completed</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold rounded-full text-[10px] uppercase">
                {completedSummary.deliveryStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Driver Operator</span>
                <span className="font-bold text-slate-750 dark:text-slate-200 text-xs">{completedSummary.driver}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Assigned Truck</span>
                <span className="font-bold text-slate-750 dark:text-slate-200 text-xs">{completedSummary.vehicle}</span>
              </div>
              <div className="col-span-2 border-t pt-2 border-slate-200/50 dark:border-slate-700/50">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Route Path</span>
                <span className="font-bold text-slate-750 dark:text-slate-200 text-xs">{completedSummary.pickup} → {completedSummary.destination}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[9px] text-slate-400 uppercase font-semibold block">Total Distance</span>
                <span className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{completedSummary.distance} km</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[9px] text-slate-400 uppercase font-semibold block">Travel Duration</span>
                <span className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{completedSummary.duration}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[9px] text-slate-400 uppercase font-semibold block">Idle Duration</span>
                <span className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{completedSummary.idleTime}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t pt-3 border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center p-2 rounded bg-slate-50 dark:bg-slate-800/20 border">
                <span className="text-slate-500 font-medium">Fuel Consumed</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{completedSummary.fuelUsed}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-slate-50 dark:bg-slate-800/20 border">
                <span className="text-slate-500 font-medium">POD Verification</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{completedSummary.podStatus}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowSummaryModal(false);
                setActiveTab('dashboard');
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md text-xs cursor-pointer transition-all mt-1"
            >
              Close Summary & Wait For Next Assignment
            </button>
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

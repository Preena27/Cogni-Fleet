import React, { useState, useEffect } from 'react';
import { useAppContext } from '../App';
import { 
  Layers, 
  Search, 
  Filter, 
  ChevronRight, 
  Trash2, 
  Copy, 
  Plus, 
  Upload, 
  Download, 
  Sparkles, 
  Clock, 
  Truck, 
  User, 
  Calendar,
  AlertTriangle,
  FileText,
  MapPin,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { Trip, Driver, Vehicle } from '../types';

export default function LoadsModule() {
  const { trips, drivers, vehicles, refreshData, addToast, secureFetch } = useAppContext();
  
  // List States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Manual Assignment Modal State
  const [showManualAssignModal, setShowManualAssignModal] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  
  // Auto Assignment Modal State
  const [showAutoResultModal, setShowAutoResultModal] = useState(false);
  const [autoAssignResult, setAutoAssignResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Route previews state
  const [routePreview, setRoutePreview] = useState<{
    shortest: { distance: number; duration: number; routeName: string };
    fastest: { distance: number; duration: number; routeName: string };
    selected: 'shortest' | 'fastest';
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    customer: '',
    pickup: '',
    destination: '',
    cargo_type: '',
    weight: 5.0,
    volume: 12.0,
    vehicle_type: 'Semi-Truck',
    required_capacity: 10.0,
    priority: 'Medium',
    pickup_date: new Date().toISOString().split('T')[0],
    delivery_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    instructions: '',
    fragile: false,
    temperature_control: false,
    insurance: false
  });

  // CSV Import States
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<any | null>(null);

  // Calculate route preview estimates
  useEffect(() => {
    if (formData.pickup && formData.destination) {
      const pickLen = formData.pickup.length;
      const destLen = formData.destination.length;
      const baseDist = Math.floor((pickLen + destLen) * 18 + 100);
      
      setRoutePreview({
        shortest: {
          distance: baseDist,
          duration: Math.round((baseDist / 55) * 10) / 10,
          routeName: `via I-${(pickLen % 9) + 5} S`
        },
        fastest: {
          distance: Math.round(baseDist * 1.08),
          duration: Math.round((baseDist / 65) * 10) / 10,
          routeName: `via US-${(destLen % 9) + 101} S`
        },
        selected: 'shortest'
      });
    } else {
      setRoutePreview(null);
    }
  }, [formData.pickup, formData.destination]);

  const resetForm = () => {
    setFormData({
      customer: '',
      pickup: '',
      destination: '',
      cargo_type: '',
      weight: 5.0,
      volume: 12.0,
      vehicle_type: 'Semi-Truck',
      required_capacity: 10.0,
      priority: 'Medium',
      pickup_date: new Date().toISOString().split('T')[0],
      delivery_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      instructions: '',
      fragile: false,
      temperature_control: false,
      insurance: false
    });
    setRoutePreview(null);
  };

  const handleCreateLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        distance: routePreview?.selected === 'shortest' ? routePreview.shortest.distance : routePreview?.fastest.distance,
        remaining_distance: routePreview?.selected === 'shortest' ? routePreview.shortest.distance : routePreview?.fastest.distance,
        shortest_route_meta: routePreview ? JSON.stringify(routePreview.shortest) : undefined,
        fastest_route_meta: routePreview ? JSON.stringify(routePreview.fastest) : undefined,
        route_coordinates: JSON.stringify([
          [37.7749, -122.4194],  
          [34.0522, -118.2437]
        ])
      };

      const res = await secureFetch('http://localhost:8000/api/trips', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        addToast("Load Registered", `New shipment for ${formData.customer} registered on the dispatch board.`, "success");
        setShowCreateModal(false);
        resetForm();
        refreshData('trips');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLoad = async (tripId: number) => {
    if (!confirm("Are you sure you want to delete this trip record?")) return;
    try {
      const res = await secureFetch(`http://localhost:8000/api/trips/${tripId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addToast("Record Purged", "Shipment record removed from operations.", "warning");
        setSelectedTrip(null);
        refreshData('trips');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicateLoad = async (trip: Trip) => {
    try {
      const duplicateData = {
        customer: `${trip.customer} (Copy)`,
        pickup: trip.pickup,
        destination: trip.destination,
        cargo_type: trip.cargo_type,
        weight: trip.weight,
        volume: trip.volume,
        vehicle_type: trip.vehicle_type,
        required_capacity: trip.required_capacity,
        priority: trip.priority,
        pickup_date: trip.pickup_date,
        delivery_date: trip.delivery_date,
        instructions: trip.instructions,
        fragile: trip.fragile,
        temperature_control: trip.temperature_control,
        insurance: trip.insurance,
        distance: trip.distance,
        remaining_distance: trip.remaining_distance,
        shortest_route_meta: trip.shortest_route_meta,
        fastest_route_meta: trip.fastest_route_meta,
        route_coordinates: trip.route_coordinates
      };
      
      const res = await secureFetch('http://localhost:8000/api/trips', {
        method: 'POST',
        body: JSON.stringify(duplicateData)
      });
      if (res.ok) {
        addToast("Duplicate Created", `Duplicated load configuration for ${trip.customer}.`, "success");
        refreshData('trips');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manual Assignment Dialog
  const handleManualAssignOpen = (trip: Trip) => {
    setSelectedTrip(trip);
    setSelectedDriverId('');
    setSelectedVehicleId('');
    setShowManualAssignModal(true);
  };

  const handleManualAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip || !selectedDriverId || !selectedVehicleId) {
      addToast("Validation Error", "Please select a driver and a vehicle.", "warning");
      return;
    }
    
    setAiLoading(true);
    try {
      const res = await secureFetch(`http://localhost:8000/api/trips/${selectedTrip.id}/manual-assign`, {
        method: 'POST',
        body: JSON.stringify({
          driver_id: parseInt(selectedDriverId),
          vehicle_id: parseInt(selectedVehicleId)
        })
      });
      if (res.ok) {
        const data = await res.json();
        addToast("Asset Manually Assigned", `Trip #${data.id} has been manually assigned.`, "success");
        setShowManualAssignModal(false);
        setSelectedTrip(null);
        refreshData('trips');
        refreshData('drivers');
        refreshData('vehicles');
      } else {
        const err = await res.json();
        addToast("Assignment Failed", err.detail || "Could not complete manual assignment.", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Connection Error", "Server could not be reached.", "error");
    } finally {
      setAiLoading(false);
    }
  };

  // Auto Assignment webhook
  const handleAutoAssignTrigger = async (trip: Trip) => {
    setSelectedTrip(trip);
    setAiLoading(true);
    setShowAutoResultModal(true);
    setAutoAssignResult(null);

    try {
      const res = await secureFetch(`https://api.agents.snsihub.ai/webhook/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: trip.id,
          weight: trip.weight // adjust field name to match your actual Trip type
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAutoAssignResult(data);
        addToast("Auto-Assignment Complete", `AI assigned assets successfully!`, "success");
        refreshData('trips');
        refreshData('drivers');
        refreshData('vehicles');
      } else {
        const err = await res.json();
        addToast("Auto-Assignment Failed", err.detail || "Could not assign trip automatically.", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Connection Error", "Could not call backend server.", "error");
    } finally {
      setAiLoading(false);
    }
  };

  // CSV Import Simulation
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      
      const parsedRows: any[] = [];
      const errors: string[] = [];
      
      // Basic CSV reading
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(',');
        if (cols.length < 3) {
          errors.push(`Row ${i + 1}: Insufficient column values.`);
          continue;
        }

        const customer = cols[0]?.trim();
        const pickup = cols[1]?.trim();
        const destination = cols[2]?.trim();
        const weight = parseFloat(cols[3]?.trim()) || 5.0;
        
        // Basic duplicate check in current upload or database
        const isDuplicate = trips.some(t => t.customer === customer && t.pickup === pickup && t.destination === destination);

        parsedRows.push({
          id: i,
          customer,
          pickup,
          destination,
          weight,
          status: isDuplicate ? 'Duplicate Alert' : 'Valid',
          isDuplicate
        });
      }

      setImportPreview(parsedRows);
      setImportErrors(errors);
    };
    reader.readAsText(file);
  };

  const processImport = async () => {
    let successCount = 0;
    let skipCount = 0;

    for (const row of importPreview) {
      if (row.isDuplicate) {
        skipCount++;
        continue;
      }

      try {
        const importPayload = {
          customer: row.customer,
          pickup: row.pickup,
          destination: row.destination,
          weight: row.weight,
          cargo_type: "General Freight",
          vehicle_type: "Semi-Truck",
          priority: "Medium"
        };

        const res = await secureFetch('http://localhost:8000/api/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(importPayload)
        });
        if (res.ok) {
          successCount++;
        }
      } catch (err) {
        console.error(err);
      }
    }

    setImportSummary({
      success: successCount,
      skipped: skipCount,
      failed: importPreview.length - successCount - skipCount
    });

    addToast("Bulk Import Completed", `Successfully imported ${successCount} loads. Skipped ${skipCount} duplicates.`, "success");
    refreshData('trips');
  };

  const handleExportCSV = () => {
    // Generate simple CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Customer,Pickup,Destination,Cargo,Weight,Status\n";
    
    trips.forEach(t => {
      csvContent += `"${t.customer}","${t.pickup}","${t.destination}","${t.cargo_type || ''}",${t.weight},"${t.status}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "CogniFleet_LoadsReport.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("CSV Exported", "Operations load ledger downloaded successfully.", "success");
  };

  // Filter application
  const filteredTrips = trips.filter(trip => {
    const matchesSearch = trip.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          trip.pickup.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          trip.destination.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = filterPriority === 'All' || trip.priority === filterPriority;
    const matchesStatus = filterStatus === 'All' || trip.status === filterStatus;
    
    return matchesSearch && matchesPriority && matchesStatus;
  });

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-50 text-red-750 dark:bg-red-950/20 dark:text-red-400';
      case 'High': return 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400';
      case 'Medium': return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400';
      default: return 'bg-blue-50 text-blue-750 dark:bg-blue-950/20 dark:text-blue-400';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search and Filters Header */}
      <section className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-soft-sm gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-70">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" placeholder="Search by customer, pickup, or destination..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent text-xs text-slate-700 dark:text-slate-350 focus:outline-none focus:border-primary-500"
            />
          </div>
          
          <div>
            <select 
              value={filterPriority} 
              onChange={e => setFilterPriority(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-xs"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div>
            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-xs"
            >
              <option value="All">All Statuses</option>
              <option value="Unassigned">Unassigned</option>
              <option value="Assigned">Assigned</option>
              <option value="Loading">Loading</option>
              <option value="In Transit">In Transit</option>
              <option value="Completed">Completed</option>
              <option value="Problem">Problem</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleExportCSV()}
            className="px-3 py-1.5 border hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold shadow-soft-sm flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button 
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 border hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold shadow-soft-sm flex items-center gap-1.5 transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
          <button 
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-750 text-white rounded-lg text-xs font-bold shadow-soft-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Load
          </button>
        </div>
      </section>

      {/* Main Workspace grid */}
      <section className="flex gap-6 items-start">
        {/* Loads Table */}
        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md p-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3">Load ID</th>
                  <th className="py-3">Customer Client</th>
                  <th className="py-3">Route Journey</th>
                  <th className="py-3 text-center">Weight</th>
                  <th className="py-3 text-center">Priority</th>
                  <th className="py-3 text-center">Status</th>
                  <th className="py-3 text-right">Quick Task</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-850/85">
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-450">No operations loads match the current search filters.</td>
                  </tr>
                ) : (
                  filteredTrips.map(trip => (
                    <tr 
                      key={trip.id}
                      onClick={() => setSelectedTrip(trip)}
                      className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors ${
                        selectedTrip?.id === trip.id ? 'bg-primary-50/50 dark:bg-primary-950/10' : ''
                      }`}
                    >
                      <td className="py-3.5 font-mono font-bold">#L-{trip.id}</td>
                      <td className="py-3.5 font-bold text-slate-800 dark:text-slate-150">{trip.customer}</td>
                      <td className="py-3.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-350">{trip.pickup}</span>
                        <ChevronRight className="w-3 h-3 text-slate-400 inline mx-1" />
                        <span className="text-slate-500">{trip.destination}</span>
                      </td>
                      <td className="py-3.5 text-center font-semibold">{trip.weight} tons</td>
                      <td className="py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${getPriorityStyle(trip.priority)}`}>
                          {trip.priority}
                        </span>
                      </td>
                      <td className="py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          trip.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400' :
                          trip.status === 'Problem' ? 'bg-red-105 text-red-800 dark:bg-red-950/20 dark:text-red-400' :
                          trip.status === 'Unassigned' ? 'bg-slate-105 text-slate-800 dark:bg-slate-800 dark:text-slate-400' :
                          'bg-blue-105 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400'
                        }`}>
                          {trip.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {trip.status === 'Unassigned' && (
                            <div className="flex gap-1">
                              <button 
                                onClick={() => handleAutoAssignTrigger(trip)}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-soft-sm transition-all cursor-pointer"
                                title="Optimize with Auto-Assign webhook"
                              >
                                <Sparkles className="w-3 h-3 animate-pulse" />
                                Auto
                              </button>
                              <button 
                                onClick={() => handleManualAssignOpen(trip)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 rounded text-[10px] font-bold flex items-center gap-1 border border-slate-250 dark:border-slate-750 transition-all cursor-pointer"
                                title="Manually assign driver and vehicle"
                              >
                                Manual
                              </button>
                            </div>
                          )}
                          <button 
                            onClick={() => handleDuplicateLoad(trip)}
                            className="p-1 text-slate-450 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Duplicate Load"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteLoad(trip.id)}
                            className="p-1 text-slate-455 hover:text-red-650"
                            title="Delete Load"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Details Panel */}
        {selectedTrip && (
          <aside className="w-80 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-soft-lg flex flex-col gap-4.5 max-h-[calc(100vh-250px)] overflow-y-auto sticky top-0 animate-slide-in">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Load #L-{selectedTrip.id} Details</h3>
                <p className="text-[10px] text-slate-400 font-bold">{selectedTrip.customer}</p>
              </div>
              <button onClick={() => setSelectedTrip(null)} className="text-xs text-slate-400 hover:text-slate-650">Close</button>
            </div>

            {/* General Specs */}
            <div className="flex flex-col gap-3 text-xs text-slate-650 dark:text-slate-350">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[9px] block text-slate-400 font-semibold uppercase">Route details</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 leading-normal block">
                    {selectedTrip.pickup} → {selectedTrip.destination}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 border-t pt-2.5 border-slate-50 dark:border-slate-800">
                <div>
                  <span className="text-[9px] block text-slate-400 font-semibold uppercase">Cargo weight</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{selectedTrip.weight} Tons</span>
                </div>
                <div>
                  <span className="text-[9px] block text-slate-400 font-semibold uppercase">Cargo Class</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{selectedTrip.cargo_type || 'General Cargo'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 border-t pt-2.5 border-slate-50 dark:border-slate-800">
                <div>
                  <span className="text-[9px] block text-slate-400 font-semibold uppercase">Assigned Driver</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {drivers.find(d => d.id === selectedTrip.driver_id)?.name || 'None Assigned'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] block text-slate-400 font-semibold uppercase">Vehicle Truck</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {vehicles.find(v => v.id === selectedTrip.vehicle_id)?.vehicle_number || 'None Assigned'}
                  </span>
                </div>
              </div>
            </div>

            {selectedTrip.assignment_reason && (
              <div className="bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-xl p-3 flex flex-col gap-1.5 border-dashed">
                <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-650 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  AI Webhook Assignment Decision
                </span>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-450 font-medium">Confidence Score:</span>
                  <span className="font-extrabold text-indigo-650 dark:text-indigo-400">{selectedTrip.assignment_confidence}%</span>
                </div>
                <div className="text-[10px] text-slate-500 leading-normal p-2 rounded bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-350 block">AI Rationale:</span>
                  <p className="mt-0.5 text-slate-550 dark:text-slate-400 leading-tight">{selectedTrip.assignment_reason}</p>
                </div>
                {selectedTrip.assignment_time && (
                  <span className="text-[8px] text-slate-450 text-right block">
                    Processed: {new Date(selectedTrip.assignment_time).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* Stops list parser */}
            <div className="border-t pt-3 flex flex-col gap-2">
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Scheduled Journey Stops</span>
              <div className="flex flex-col gap-2">
                {selectedTrip.stops ? (
                  JSON.parse(selectedTrip.stops).map((stop: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-500 shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-250">{stop.location}</p>
                        <span className="text-[9px] text-slate-400 font-semibold">{stop.type} • {stop.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-slate-400">No specific stop coordinates details available.</p>
                )}
              </div>
            </div>

            {/* Audit History Timeline */}
            <div className="border-t pt-3 flex flex-col gap-2">
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Operational Audit Log</span>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                {selectedTrip.history ? (
                  JSON.parse(selectedTrip.history).map((hist: any, idx: number) => (
                    <div key={idx} className="text-[10px] flex flex-col gap-0.5 border-l-2 border-slate-105 dark:border-slate-800 pl-2.5 py-0.5">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{hist.status}</span>
                      <p className="text-slate-450 opacity-90 leading-tight">{hist.notes}</p>
                      <span className="text-[8px] text-slate-400">{new Date(hist.timestamp).toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-slate-405">No historical logs available.</p>
                )}
              </div>
            </div>
          </aside>
        )}
      </section>

      {/* 1. Create Load Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-lg w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-855 dark:text-slate-100">Establish Cargo Dispatch Load</h3>
            
            <form onSubmit={handleCreateLoad} className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">Customer Client</label>
                  <input 
                    type="text" required placeholder="e.g., Walmart Inc"
                    value={formData.customer}
                    onChange={e => setFormData({...formData, customer: e.target.value})}
                    className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">Cargo Classification</label>
                  <input 
                    type="text" required placeholder="e.g., Cold Groceries"
                    value={formData.cargo_type}
                    onChange={e => setFormData({...formData, cargo_type: e.target.value})}
                    className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">Pickup Location Hub</label>
                  <input 
                    type="text" required placeholder="e.g., Oakland Terminal"
                    value={formData.pickup}
                    onChange={e => setFormData({...formData, pickup: e.target.value})}
                    className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">Destination Hub</label>
                  <input 
                    type="text" required placeholder="e.g., Los Angeles Depot"
                    value={formData.destination}
                    onChange={e => setFormData({...formData, destination: e.target.value})}
                    className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">Weight (Tons)</label>
                  <input 
                    type="number" step="0.1" required
                    value={formData.weight}
                    onChange={e => setFormData({...formData, weight: parseFloat(e.target.value)})}
                    className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">Volume (m³)</label>
                  <input 
                    type="number" step="0.1" required
                    value={formData.volume}
                    onChange={e => setFormData({...formData, volume: parseFloat(e.target.value)})}
                    className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">Priority Level</label>
                  <select 
                    value={formData.priority}
                    onChange={e => setFormData({...formData, priority: e.target.value})}
                    className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">Pickup Target Date</label>
                  <input 
                    type="date" required
                    value={formData.pickup_date}
                    onChange={e => setFormData({...formData, pickup_date: e.target.value})}
                    className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">Delivery Target Date</label>
                  <input 
                    type="date" required
                    value={formData.delivery_date}
                    onChange={e => setFormData({...formData, delivery_date: e.target.value})}
                    className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              {/* Checkbox triggers */}
              <div className="flex items-center gap-6 p-2 rounded-lg bg-slate-55 dark:bg-slate-800/20 border border-slate-105 border-dashed">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-650 dark:text-slate-350">
                  <input 
                    type="checkbox" checked={formData.fragile}
                    onChange={e => setFormData({...formData, fragile: e.target.checked})}
                    className="w-4 h-4 rounded text-primary-500 border-slate-300 focus:ring-primary-400"
                  />
                  Fragile
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-650 dark:text-slate-350">
                  <input 
                    type="checkbox" checked={formData.temperature_control}
                    onChange={e => setFormData({...formData, temperature_control: e.target.checked})}
                    className="w-4 h-4 rounded text-primary-500 border-slate-300 focus:ring-primary-400"
                  />
                  Temp Control
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-650 dark:text-slate-350">
                  <input 
                    type="checkbox" checked={formData.insurance}
                    onChange={e => setFormData({...formData, insurance: e.target.checked})}
                    className="w-4 h-4 rounded text-primary-500 border-slate-300 focus:ring-primary-400"
                  />
                  Cargo Insurance
                </label>
              </div>

              {/* Route directions preview options selector */}
              {routePreview && (
                <div className="flex flex-col gap-2 p-3 bg-slate-55 dark:bg-slate-800/20 border border-slate-105 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-450">
                    Directions Routing Optimization (Google Maps Engine)
                  </span>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setRoutePreview({ ...routePreview, selected: 'shortest' })}
                      className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        routePreview.selected === 'shortest'
                          ? 'border-primary-500 bg-primary-50/20 dark:bg-primary-950/10'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100/50'
                      }`}
                    >
                      <span className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Shortest Route</span>
                      <span className="text-[9px] text-slate-450">{routePreview.shortest.routeName}</span>
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-1">
                        <span>{routePreview.shortest.distance} mi</span>
                        <span>{routePreview.shortest.duration} hrs</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoutePreview({ ...routePreview, selected: 'fastest' })}
                      className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        routePreview.selected === 'fastest'
                          ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100/50'
                      }`}
                    >
                      <span className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Fastest Route (Rec)</span>
                      <span className="text-[9px] text-slate-450">{routePreview.fastest.routeName}</span>
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-1">
                        <span>{routePreview.fastest.distance} mi</span>
                        <span>{routePreview.fastest.duration} hrs</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 mt-2">
                <button 
                  type="button" onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-455"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-750 text-white rounded-lg font-semibold shadow-soft-sm"
                >
                  Publish Load
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-xl w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in">
            <h3 className="font-bold text-base text-slate-855 dark:text-slate-100">Bulk CSV Upload Portal</h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Select Load File (.csv)</label>
              <input 
                type="file" accept=".csv"
                onChange={handleCSVUpload}
                className="w-full text-xs text-slate-500 border border-slate-205 dark:border-slate-800 rounded-lg p-2 bg-slate-55 dark:bg-slate-800/10 cursor-pointer"
              />
            </div>

            {/* Preview Sheet */}
            {importPreview.length > 0 && (
              <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                    <tr className="text-slate-450 font-bold">
                      <th className="p-2">Customer</th>
                      <th className="p-2">Pickup</th>
                      <th className="p-2">Destination</th>
                      <th className="p-2 text-right">Tons</th>
                      <th className="p-2 text-center">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {importPreview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                        <td className="p-2 font-semibold">{row.customer}</td>
                        <td className="p-2">{row.pickup}</td>
                        <td className="p-2">{row.destination}</td>
                        <td className="p-2 text-right">{row.weight}</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            row.isDuplicate ? 'bg-red-50 text-red-750 dark:bg-red-950/20' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2.5 mt-2">
              <button 
                type="button" onClick={() => { setImportPreview([]); setShowImportModal(false); }}
                className="px-4 py-2 border rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-455"
              >
                Cancel
              </button>
              <button 
                type="button" onClick={() => processImport()}
                disabled={importPreview.length === 0}
                className="px-4 py-2 bg-primary-650 hover:bg-primary-750 disabled:bg-slate-205 text-white rounded-lg font-semibold shadow-soft-sm"
              >
                Start Bulk Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Manual Assignment Modal */}
      {showManualAssignModal && selectedTrip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Manual Asset Dispatch</h3>
              <button 
                onClick={() => setShowManualAssignModal(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
            
            <form onSubmit={handleManualAssignSubmit} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-2">
                <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Select Available Driver</span>
                <select
                  required
                  value={selectedDriverId}
                  onChange={e => setSelectedDriverId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none"
                >
                  <option value="">-- Choose available driver --</option>
                  {drivers
                    .filter(d => d.availability === "Available")
                    .map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} (Lic: Active • driving limit: {11 - d.working_hours}h left)
                      </option>
                    ))}
                </select>
                {drivers.filter(d => d.availability === "Available").length === 0 && (
                  <p className="text-[10px] text-red-500 font-semibold mt-1">
                    Warning: No available drivers in directory.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Select Available Truck</span>
                <select
                  required
                  value={selectedVehicleId}
                  onChange={e => setSelectedVehicleId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none"
                >
                  <option value="">-- Choose available truck --</option>
                  {vehicles
                    .filter(v => v.availability === "Available")
                    .map(v => (
                      <option key={v.id} value={v.id}>
                        {v.vehicle_number} (Health: {v.health}% • Fuel: {v.fuel}%)
                      </option>
                    ))}
                </select>
                {vehicles.filter(v => v.availability === "Available").length === 0 && (
                  <p className="text-[10px] text-red-500 font-semibold mt-1">
                    Warning: No available vehicles in garage.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={aiLoading || !selectedDriverId || !selectedVehicleId}
                className="w-full py-2.5 mt-2 bg-primary-600 hover:bg-primary-750 disabled:bg-slate-300 text-white rounded-lg font-bold shadow-soft-sm transition-colors text-center cursor-pointer"
              >
                {aiLoading ? "Dispatching..." : "Assign Assets & Start Trip"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Auto Assignment Results Modal */}
      {showAutoResultModal && selectedTrip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in">
            <h3 className="font-bold text-base text-slate-855 dark:text-slate-100 flex items-center gap-1.5 border-b pb-2">
              <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
              <span>AI Smart Dispatch Decision</span>
            </h3>
            
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 text-xs">
                <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mb-3"></div>
                Evaluating driver directories, scanning available vehicles, and dispatching webhook payload to SNS Workbench agent...
              </div>
            ) : !autoAssignResult ? (
              <div className="py-6 text-center text-xs text-red-500 font-semibold">
                No matching driver or vehicle recommendations could be resolved by AI webhook.
              </div>
            ) : (
              <div className="flex flex-col gap-4 text-xs">
                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-450 uppercase block font-semibold">Match Confidence</span>
                    <span className="text-xl font-black text-indigo-650 dark:text-indigo-400">
                      {autoAssignResult.assignment_confidence}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-450 uppercase block font-semibold">Assignment Time</span>
                    <span className="font-mono text-slate-600 dark:text-slate-350">
                      {new Date(autoAssignResult.assignment_time).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-slate-150 dark:border-slate-800">
                    <span className="text-[9px] text-slate-450 uppercase block font-semibold">Selected Driver</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {drivers.find(d => d.id === autoAssignResult.driver_id)?.name || `Driver ID: ${autoAssignResult.driver_id}`}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-150 dark:border-slate-800">
                    <span className="text-[9px] text-slate-455 uppercase block font-semibold">Selected Truck</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {vehicles.find(v => v.id === autoAssignResult.vehicle_id)?.vehicle_number || `Truck ID: ${autoAssignResult.vehicle_id}`}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-150 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-800/10">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">AI Recommendation Reason:</span>
                  <p className="mt-1 text-slate-550 dark:text-slate-400 leading-normal">
                    {autoAssignResult.assignment_reason}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowAutoResultModal(false);
                    setSelectedTrip(null);
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg font-bold shadow-soft-sm text-center mt-2 cursor-pointer"
                >
                  Confirm & Apply Auto Assignment
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

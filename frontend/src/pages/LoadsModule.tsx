import React, { useState, useEffect } from 'react';
import { useAppContext } from '../App';
import { useSettings } from '../contexts/SettingsContext';
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
  const { settings } = useSettings();
  const weightUnit = settings.weight_unit === 'Kilograms' ? 'kg' : settings.weight_unit === 'Pounds' ? 'lbs' : 'tons';
  const weightMultiplier = settings.weight_unit === 'Kilograms' ? 1000 : settings.weight_unit === 'Pounds' ? 2204.62 : 1;
  
  // List States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  
  // Manual Assignment Modal State
  const [showManualAssignModal, setShowManualAssignModal] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  
  // Auto Assignment Modal State
  const [showAutoResultModal, setShowAutoResultModal] = useState(false);
  const [autoAssignResult, setAutoAssignResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Route previews state removed

  // Form State
  const [formData, setFormData] = useState({
    id: undefined as number | undefined,
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
    insurance: false,
    driver_id: '' as string | number,
    vehicle_id: '' as string | number,
    status: 'Unassigned'
  });

  // CSV Import States
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<any | null>(null);

  // Route preview estimates removed

  const resetForm = () => {
    setFormData({
      id: undefined,
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
      insurance: false,
      driver_id: '',
      vehicle_id: '',
      status: 'Unassigned'
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        customer: formData.customer,
        pickup: formData.pickup,
        destination: formData.destination,
        cargo_type: formData.cargo_type,
        weight: formData.weight,
        volume: formData.volume,
        vehicle_type: formData.vehicle_type,
        required_capacity: formData.required_capacity,
        priority: formData.priority,
        pickup_date: formData.pickup_date,
        delivery_date: formData.delivery_date,
        instructions: formData.instructions,
        fragile: formData.fragile,
        temperature_control: formData.temperature_control,
        insurance: formData.insurance,
        driver_id: formData.driver_id ? parseInt(formData.driver_id as string) : null,
        vehicle_id: formData.vehicle_id ? parseInt(formData.vehicle_id as string) : null,
        status: formData.status,
        distance: 620.0,
        remaining_distance: 620.0,
        shortest_route_meta: undefined,
        fastest_route_meta: undefined,
        route_coordinates: JSON.stringify([
          [13.0827, 80.2707],  
          [11.0168, 76.9558]
        ])
      };

      const isEdit = formData.id !== undefined;
      const url = isEdit 
        ? `http://localhost:8000/api/trips/${formData.id}` 
        : 'http://localhost:8000/api/trips';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await secureFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        addToast(
          isEdit ? "Load Updated" : "Load Registered", 
          isEdit ? `Load #${formData.id} details updated.` : `New shipment for ${formData.customer} registered on the dispatch board.`, 
          "success"
        );
        setShowCreateModal(false);
        resetForm();
        refreshData('trips');
        refreshData('drivers');
        refreshData('vehicles');
      } else {
        const err = await res.json();
        addToast("Operation Failed", err.detail || "Error saving load details.", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Network Error", "Could not reach server.", "error");
    }
  };

  const handleEditLoadOpen = (trip: Trip) => {
    setFormData({
      id: trip.id,
      customer: trip.customer,
      pickup: trip.pickup,
      destination: trip.destination,
      cargo_type: trip.cargo_type || '',
      weight: trip.weight || 0.0,
      volume: trip.volume || 0.0,
      vehicle_type: trip.vehicle_type || 'Semi-Truck',
      required_capacity: trip.required_capacity || 0.0,
      priority: trip.priority || 'Medium',
      pickup_date: trip.pickup_date || new Date().toISOString().split('T')[0],
      delivery_date: trip.delivery_date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      instructions: trip.instructions || '',
      fragile: trip.fragile || false,
      temperature_control: trip.temperature_control || false,
      insurance: trip.insurance || false,
      driver_id: trip.driver_id || '',
      vehicle_id: trip.vehicle_id || '',
      status: trip.status || 'Unassigned'
    });
    setShowCreateModal(true);
  };

  const handleCopyLoadTrigger = (trip: Trip) => {
    setFormData({
      id: undefined,
      customer: `${trip.customer} (Copy)`,
      pickup: trip.pickup,
      destination: trip.destination,
      cargo_type: trip.cargo_type || '',
      weight: trip.weight || 0.0,
      volume: trip.volume || 0.0,
      vehicle_type: trip.vehicle_type || 'Semi-Truck',
      required_capacity: trip.required_capacity || 0.0,
      priority: trip.priority || 'Medium',
      pickup_date: trip.pickup_date || new Date().toISOString().split('T')[0],
      delivery_date: trip.delivery_date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      instructions: trip.instructions || '',
      fragile: trip.fragile || false,
      temperature_control: trip.temperature_control || false,
      insurance: trip.insurance || false,
      driver_id: '',
      vehicle_id: '',
      status: 'Draft' // Remain in Draft status
    });
    setShowCreateModal(true);
  };

  const handleDeleteConfirmOpen = (trip: Trip) => {
    setTripToDelete(trip);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!tripToDelete) return;
    try {
      const res = await secureFetch(`http://localhost:8000/api/trips/${tripToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addToast("Record Purged", "Shipment record removed from operations.", "warning");
        setSelectedTrip(null);
        setShowDeleteModal(false);
        setTripToDelete(null);
        refreshData('trips');
      } else {
        const err = await res.json();
        addToast("Deletion Failed", err.detail || "Could not delete trip record.", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Network Error", "Server could not be reached.", "error");
    }
  };

  const handleAcceptLoad = async (trip: Trip) => {
    try {
      const res = await secureFetch(`http://localhost:8000/api/trips/${trip.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...trip, status: 'Accepted' })
      });
      if (res.ok) {
        addToast("Load Accepted", `Load #${trip.id} is now ready for assignment.`, "success");
        refreshData('trips');
      } else {
        addToast("Accept Failed", "Could not accept load.", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Network Error", "Could not reach server.", "error");
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

  // CSV Import Simulation & Validation
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      if (lines.length <= 1) {
        addToast("Empty CSV File", "The CSV file does not contain any record rows.", "warning");
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
      
      // Let's identify the index of each column
      let loadIdIdx = headers.indexOf("load id");
      if (loadIdIdx === -1) loadIdIdx = headers.indexOf("id");
      
      let pickupIdx = headers.indexOf("pickup");
      let destIdx = headers.indexOf("destination");
      
      let productIdx = headers.indexOf("product");
      if (productIdx === -1) productIdx = headers.indexOf("cargo_type");
      if (productIdx === -1) productIdx = headers.indexOf("cargo");
      
      let weightIdx = headers.indexOf("weight");
      if (weightIdx === -1) weightIdx = headers.indexOf("product weight");
      
      let priorityIdx = headers.indexOf("priority");
      
      let deliveryDateIdx = headers.indexOf("delivery date");
      if (deliveryDateIdx === -1) deliveryDateIdx = headers.indexOf("delivery_date");
      
      let capacityIdx = headers.indexOf("vehicle capacity");
      if (capacityIdx === -1) capacityIdx = headers.indexOf("required_capacity");
      
      let customerIdx = headers.indexOf("customer");
      let statusIdx = headers.indexOf("status");

      // Validate required columns exist in the header row
      if (pickupIdx === -1 || destIdx === -1 || weightIdx === -1 || priorityIdx === -1 || deliveryDateIdx === -1 || capacityIdx === -1) {
        addToast(
          "Validation Error", 
          "CSV is missing one or more required columns: Pickup, Destination, Weight, Priority, Delivery Date, Vehicle Capacity.", 
          "error"
        );
        return;
      }

      const parsedRows: any[] = [];
      const uniqueLoadIds = new Set<string>();
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Correctly split row by comma, considering quotes
        const cols: string[] = [];
        let currentVal = '';
        let inQuotes = false;
        for (let charIdx = 0; charIdx < line.length; charIdx++) {
          const char = line[charIdx];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cols.push(currentVal.trim().replace(/^["']|["']$/g, ''));
            currentVal = '';
          } else {
            currentVal += char;
          }
        }
        cols.push(currentVal.trim().replace(/^["']|["']$/g, ''));

        if (cols.length < headers.length) {
          while (cols.length < headers.length) {
            cols.push('');
          }
        }

        const rowErrors: string[] = [];
        
        // 1. Load ID validation
        const loadIdStr = loadIdIdx !== -1 ? cols[loadIdIdx] : '';
        const loadIdVal = loadIdStr ? parseInt(loadIdStr) : undefined;
        if (loadIdStr && (isNaN(Number(loadIdStr)) || !Number.isInteger(Number(loadIdStr)))) {
          rowErrors.push("Load ID must be an integer.");
        }
        if (loadIdStr && uniqueLoadIds.has(loadIdStr)) {
          rowErrors.push(`Duplicate Load ID '${loadIdStr}' inside CSV file.`);
        } else if (loadIdStr) {
          uniqueLoadIds.add(loadIdStr);
        }

        // 2. Pickup location validation
        const pickupVal = pickupIdx !== -1 ? cols[pickupIdx] : '';
        if (!pickupVal) {
          rowErrors.push("Pickup location is missing.");
        }

        // 3. Destination location validation
        const destinationVal = destIdx !== -1 ? cols[destIdx] : '';
        if (!destinationVal) {
          rowErrors.push("Destination location is missing.");
        }

        // 4. Vehicle capacity validation
        const capacityStr = capacityIdx !== -1 ? cols[capacityIdx] : '';
        const capacityVal = parseFloat(capacityStr);
        if (!capacityStr || isNaN(capacityVal) || capacityVal <= 0) {
          rowErrors.push("Vehicle Capacity must be a numeric value greater than 0.");
        }

        // 5. Product weight validation
        const weightStr = weightIdx !== -1 ? cols[weightIdx] : '';
        const weightVal = parseFloat(weightStr);
        if (!weightStr || isNaN(weightVal) || weightVal <= 0) {
          rowErrors.push("Product Weight must be a numeric value greater than 0.");
        }

        // 6. Priority validation
        const priorityVal = priorityIdx !== -1 ? cols[priorityIdx] : 'Medium';
        const validPriorities = ["Low", "Medium", "High", "Critical"];
        if (!validPriorities.includes(priorityVal)) {
          rowErrors.push("Priority must be one of: Low, Medium, High, Critical.");
        }

        // 7. Delivery Date validation
        const deliveryDateStr = deliveryDateIdx !== -1 ? cols[deliveryDateIdx] : '';
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!deliveryDateStr || !dateRegex.test(deliveryDateStr)) {
          rowErrors.push("Delivery Date must be in YYYY-MM-DD format.");
        }

        const customerVal = customerIdx !== -1 ? cols[customerIdx] : 'CSV Import';
        const productVal = productIdx !== -1 ? cols[productIdx] : 'General Freight';
        const statusVal = statusIdx !== -1 ? cols[statusIdx] : 'Unassigned';

        // Check duplicate in database
        const isDuplicateInDb = trips.some(t => 
          (loadIdVal !== undefined && t.id === loadIdVal) || 
          (t.customer === customerVal && t.pickup === pickupVal && t.destination === destinationVal)
        );

        parsedRows.push({
          id: loadIdVal,
          customer: customerVal,
          pickup: pickupVal,
          destination: destinationVal,
          cargo_type: productVal,
          weight: isNaN(weightVal) ? 0 : weightVal,
          required_capacity: isNaN(capacityVal) ? 0 : capacityVal,
          priority: priorityVal,
          delivery_date: deliveryDateStr,
          status: statusVal,
          selected: rowErrors.length === 0 && !isDuplicateInDb,
          isDuplicate: isDuplicateInDb,
          errors: rowErrors,
          isValid: rowErrors.length === 0
        });
      }

      setImportPreview(parsedRows);
      setImportSummary(null);
    };
    reader.readAsText(file);
  };

  const processImport = async () => {
    const selectedRows = importPreview.filter(r => r.selected);
    if (selectedRows.length === 0) {
      addToast("Import Warning", "No valid rows selected to import.", "warning");
      return;
    }

    const payload = selectedRows.map(row => ({
      id: row.id,
      customer: row.customer,
      pickup: row.pickup,
      destination: row.destination,
      cargo_type: row.cargo_type,
      weight: row.weight,
      required_capacity: row.required_capacity,
      priority: row.priority,
      delivery_date: row.delivery_date,
      status: row.status
    }));

    try {
      const res = await secureFetch('http://localhost:8000/api/trips/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const summary = await res.json();
        setImportSummary(summary);
        addToast(
          "Import Completed", 
          `Successfully Imported : ${summary.success}\nSkipped : ${summary.skipped}\nFailed : ${summary.failed}`, 
          "success"
        );
        refreshData('trips');
      } else {
        addToast("Import Failed", "Failed to upload selected loads to database.", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Network Error", "Could not reach the bulk import endpoint.", "error");
    }
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
                  <th className="py-3 text-right">Quick Actions</th>
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
                      <td className="py-3.5 text-center font-semibold">{Math.round(trip.weight * weightMultiplier)} {weightUnit}</td>
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
                        <div className="flex items-center justify-end gap-2">
                          {trip.status === 'Accepted' && (
                            <div className="flex gap-1 mr-1">
                              <button 
                                onClick={() => handleAutoAssignTrigger(trip)}
                                className="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded text-[9px] font-bold flex items-center gap-0.5 shadow-soft-sm transition-all"
                                title="Optimize with Auto-Assign webhook"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                Auto
                              </button>
                              <button 
                                onClick={() => handleManualAssignOpen(trip)}
                                className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 rounded text-[9px] font-bold flex items-center border border-slate-250 dark:border-slate-750 transition-all"
                                title="Manually assign driver and vehicle"
                              >
                                Manual
                              </button>
                            </div>
                          )}
                          {(trip.status === 'Draft' || trip.status === 'Unassigned') && (
                            <button 
                              onClick={() => handleAcceptLoad(trip)}
                              className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 rounded text-[10px] font-bold transition-colors"
                              title="Accept Load"
                            >
                              Accept
                            </button>
                          )}
                          <button 
                            onClick={() => handleEditLoadOpen(trip)}
                            className="px-2 py-0.5 bg-primary-100 hover:bg-primary-200 text-primary-700 dark:bg-primary-950/20 dark:text-primary-400 rounded text-[10px] font-bold transition-colors"
                            title="Edit Load"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleCopyLoadTrigger(trip)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold transition-colors"
                            title="Copy Load as Draft"
                          >
                            Copy
                          </button>
                          <button 
                            onClick={() => handleDeleteConfirmOpen(trip)}
                            className="px-2 py-0.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded text-[10px] font-bold transition-colors"
                            title="Delete Load"
                          >
                            Delete
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
                  <span className="font-bold text-slate-700 dark:text-slate-200">{Math.round(selectedTrip.weight * weightMultiplier)} {weightUnit}</span>
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
            <h3 className="font-bold text-base text-slate-855 dark:text-slate-100">
              {formData.id !== undefined ? `Edit Load #L-${formData.id}` : formData.status === 'Draft' ? 'Confirm Copied Load Draft' : 'Establish Cargo Dispatch Load'}
            </h3>
            
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-3 text-xs">
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
                  <label className="font-semibold text-slate-500">Weight ({weightUnit})</label>
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

              {/* If in Edit mode, show Driver, Vehicle, and Status fields */}
              {formData.id !== undefined && (
                <div className="grid grid-cols-3 gap-3 border-t pt-3 border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-500">Assigned Driver</label>
                    <select
                      value={formData.driver_id || ''}
                      onChange={e => setFormData({...formData, driver_id: e.target.value})}
                      className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none"
                    >
                      <option value="">None Assigned</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.availability})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-500">Assigned Vehicle</label>
                    <select
                      value={formData.vehicle_id || ''}
                      onChange={e => setFormData({...formData, vehicle_id: e.target.value})}
                      className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none"
                    >
                      <option value="">None Assigned</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.vehicle_number} ({v.type})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-500">Load Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="px-3 py-2 rounded-lg border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Unassigned">Unassigned</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Loading">Loading</option>
                      <option value="In Transit">In Transit</option>
                      <option value="Completed">Completed</option>
                      <option value="Problem">Problem</option>
                    </select>
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
                  {formData.id !== undefined ? "Save Changes" : formData.status === 'Draft' ? "Confirm & Save Draft" : "Publish Load"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-4xl w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-855 dark:text-slate-100">Bulk CSV Upload Portal</h3>
            
            {importSummary ? (
              <div className="flex flex-col gap-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <div className="bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-400 p-3 rounded-lg border border-blue-100 font-bold mb-2">
                  Import completed successfully!
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 rounded-lg text-center">
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-400 uppercase block font-bold mb-1">Successfully Imported</span>
                    <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-400">{importSummary.success}</span>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-lg text-center">
                    <span className="text-[10px] text-amber-800 dark:text-amber-400 uppercase block font-bold mb-1">Skipped (Duplicates)</span>
                    <span className="text-xl font-extrabold text-amber-800 dark:text-amber-400">{importSummary.skipped}</span>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 rounded-lg text-center">
                    <span className="text-[10px] text-red-800 dark:text-red-400 uppercase block font-bold mb-1">Failed</span>
                    <span className="text-xl font-extrabold text-red-800 dark:text-red-400">{importSummary.failed}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2.5 mt-2 border-t pt-3">
                  <button
                    onClick={() => { setImportPreview([]); setImportSummary(null); setShowImportModal(false); }}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-750 text-white rounded-lg font-semibold shadow-soft-sm cursor-pointer"
                  >
                    Close Portal
                  </button>
                </div>
              </div>
            ) : (
              <>
                {importPreview.length === 0 ? (
                  <div className="flex flex-col gap-1.5 py-4">
                    <label className="text-xs font-semibold text-slate-500">Select Load File (.csv)</label>
                    <input 
                      type="file" accept=".csv"
                      onChange={handleCSVUpload}
                      className="w-full text-xs text-slate-500 border border-slate-205 dark:border-slate-800 rounded-lg p-3 bg-slate-55 dark:bg-slate-800/10 cursor-pointer"
                    />
                    <div className="text-[10px] text-slate-405 mt-2">
                      <span className="font-bold">Required Columns in Header Row:</span> Pickup, Destination, Weight, Priority, Delivery Date, Vehicle Capacity
                    </div>
                    <div className="flex justify-end gap-2.5 mt-4 border-t pt-3">
                      <button 
                        type="button" 
                        onClick={() => { setShowImportModal(false); setImportPreview([]); }}
                        className="px-4 py-2 border rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-455 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-850 p-3 rounded-lg border border-slate-100 dark:border-slate-800 gap-4 flex-wrap">
                      <div className="flex gap-4 text-xs font-semibold text-slate-600 dark:text-slate-350">
                        <div>Selected Rows: <span className="text-primary-650 dark:text-primary-400 font-bold">{importPreview.filter(r => r.selected).length}</span></div>
                        <div>Invalid Rows: <span className="text-red-650 font-bold">{importPreview.filter(r => !r.isValid).length}</span></div>
                        <div>Duplicates (DB): <span className="text-amber-605 font-bold">{importPreview.filter(r => r.isDuplicate).length}</span></div>
                        <div>Estimated Total Loads to Import: <span className="text-emerald-650 dark:text-emerald-450 font-bold">{importPreview.filter(r => r.selected).length}</span></div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setImportPreview(prev => prev.map(r => r.isValid ? { ...r, selected: true } : r))}
                          className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-bold transition-all"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportPreview(prev => prev.map(r => ({ ...r, selected: false })))}
                          className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-bold transition-all"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b sticky top-0">
                          <tr className="text-slate-450 font-bold uppercase tracking-wider text-[10px]">
                            <th className="p-2.5 text-center w-10">Select</th>
                            <th className="p-2.5 w-20">Load ID</th>
                            <th className="p-2.5">Pickup</th>
                            <th className="p-2.5">Destination</th>
                            <th className="p-2.5">Product</th>
                            <th className="p-2.5 text-right w-16">Weight</th>
                            <th className="p-2.5 text-center w-20">Priority</th>
                            <th className="p-2.5 text-center w-28">Delivery Date</th>
                            <th className="p-2.5 text-center w-28">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {importPreview.map((row, idx) => (
                            <React.Fragment key={idx}>
                              <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/10 ${!row.isValid ? 'bg-red-50/20 dark:bg-red-950/5' : ''}`}>
                                <td className="p-2.5 text-center">
                                  <input 
                                    type="checkbox" 
                                    checked={row.selected}
                                    disabled={!row.isValid}
                                    onChange={e => {
                                      const checked = e.target.checked;
                                      setImportPreview(prev => prev.map((r, rIdx) => rIdx === idx ? { ...r, selected: checked } : r));
                                    }}
                                    className="w-4 h-4 rounded text-primary-500 border-slate-300 focus:ring-primary-400 disabled:opacity-50"
                                  />
                                </td>
                                <td className="p-2.5 font-mono font-bold">
                                  {row.id !== undefined ? `#L-${row.id}` : 'Auto'}
                                </td>
                                <td className="p-2.5 font-semibold">{row.pickup || <span className="text-red-550 font-bold">Empty</span>}</td>
                                <td className="p-2.5 font-semibold">{row.destination || <span className="text-red-550 font-bold">Empty</span>}</td>
                                <td className="p-2.5 text-slate-500">{row.cargo_type}</td>
                                <td className="p-2.5 text-right font-bold">{row.weight}</td>
                                <td className="p-2.5 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getPriorityStyle(row.priority)}`}>
                                    {row.priority}
                                  </span>
                                </td>
                                <td className="p-2.5 text-center font-mono">{row.delivery_date || <span className="text-red-550 font-bold">Empty</span>}</td>
                                <td className="p-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                    row.isDuplicate ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/20' : 
                                    !row.isValid ? 'bg-red-105 text-red-800 dark:bg-red-950/20' : 
                                    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20'
                                  }`}>
                                    {row.isDuplicate ? 'Duplicate DB' : !row.isValid ? 'Invalid' : 'Valid'}
                                  </span>
                                </td>
                              </tr>
                              {row.errors.length > 0 && (
                                <tr key={`err-${idx}`} className="bg-red-50/10 dark:bg-red-950/5">
                                  <td colSpan={9} className="px-10 py-1 text-red-500 text-[10px] italic font-semibold">
                                    Row errors: {row.errors.join(" | ")}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end gap-2.5 mt-2 border-t pt-3">
                      <button 
                        type="button" onClick={() => { setImportPreview([]); }}
                        className="px-4 py-2 border rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-455"
                      >
                        Reset / Choose File
                      </button>
                      <button 
                        type="button" onClick={() => processImport()}
                        disabled={importPreview.filter(r => r.selected).length === 0}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-750 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg font-semibold shadow-soft-sm cursor-pointer"
                      >
                        Import Selected ({importPreview.filter(r => r.selected).length})
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
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
      {/* 5. Delete Confirmation Modal */}
      {showDeleteModal && tripToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 border-b pb-2">Delete Load Record</h3>
            
            {tripToDelete.status !== 'Unassigned' && tripToDelete.status !== 'Draft' ? (
              <div className="flex flex-col gap-3 text-xs">
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-750 dark:text-red-400 rounded-lg border border-red-100 font-semibold leading-relaxed">
                  Warning: Load #L-{tripToDelete.id} is currently in <strong>{tripToDelete.status}</strong> status. Assigned or active loads cannot be deleted to maintain operational integrity.
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => { setShowDeleteModal(false); setTripToDelete(null); }}
                    className="px-4 py-2 bg-slate-650 hover:bg-slate-750 text-white rounded-lg font-semibold shadow-soft-sm cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-xs">
                <p className="text-slate-600 dark:text-slate-350 leading-normal">
                  Are you sure you want to permanently delete Load <strong>#L-{tripToDelete.id}</strong> (Customer: {tripToDelete.customer})? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-2.5 mt-2 border-t pt-3">
                  <button
                    type="button"
                    onClick={() => { setShowDeleteModal(false); setTripToDelete(null); }}
                    className="px-4 py-2 border rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-455 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 bg-red-650 hover:bg-red-750 text-white rounded-lg font-semibold shadow-soft-sm cursor-pointer"
                  >
                    Delete Load
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

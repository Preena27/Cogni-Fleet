import React, { useState } from 'react';
import { useAppContext } from '../App';
import { useSettings } from '../contexts/SettingsContext';
import { 
  Truck, 
  Settings, 
  Wrench, 
  MapPin, 
  Battery, 
  Gauge, 
  ShieldAlert, 
  FileText, 
  Calendar,
  User,
  CheckCircle,
  Plus,
  Droplet,
  Map,
  Activity,
  Edit2
} from 'lucide-react';
import { Vehicle } from '../types';

export default function FleetModule() {
  const { vehicles, drivers, alerts, refreshData, addToast, secureFetch } = useAppContext();
  const { settings } = useSettings();
  const isMiles = settings.distance_unit === 'Miles';
  const weightUnit = settings.weight_unit === 'Kilograms' ? 'kg' : settings.weight_unit === 'Pounds' ? 'lbs' : 'Tons';
  const weightMultiplier = settings.weight_unit === 'Kilograms' ? 1000 : settings.weight_unit === 'Pounds' ? 2204.62 : 1;
  const distUnit = isMiles ? 'mi' : 'km';
  const distMultiplier = isMiles ? 0.621371 : 1;
  const volUnit = isMiles ? 'gal' : 'L';
  const volMultiplier = isMiles ? 0.264172 : 1;
  const efficiencyUnit = isMiles ? 'mpg' : 'km/L';
  const efficiencyMultiplier = isMiles ? 2.35215 : 1;

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [filterType, setFilterType] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [maintLoading, setMaintLoading] = useState(false);
  // New States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Partial<Vehicle>>({});
  
  const [showRefuelModal, setShowRefuelModal] = useState(false);
  const [refuelAmount, setRefuelAmount] = useState<number>(0);

  let overdue = 0;
  let maintSoon = 0;
  let normal = 0;
  const inMaint = vehicles.filter(v => v.availability === 'Maintenance' || (v.availability as string) === 'Maintenance Due').length;

  vehicles.forEach(v => {
    const hasOverdueAlert = alerts?.some(a => !a.acknowledged && (a.title.includes('Overdue') || a.title.includes('Breakdown')) && (a.vehicle_number === v.vehicle_number || a.title.includes(v.vehicle_number)));
    const hasSoonAlert = alerts?.some(a => !a.acknowledged && (a.title.includes('Required Soon') || a.title.includes('Due Soon')) && (a.vehicle_number === v.vehicle_number || a.title.includes(v.vehicle_number)));

    const odo = v.odometer || v.mileage || 0;
    const diffKm = (v.next_service_due && odo) ? (v.next_service_due - odo) : 9999;

    if (v.availability === 'Maintenance' || (v.availability as string) === 'Maintenance Due' || hasOverdueAlert || diffKm <= 0) {
      overdue++;
    } else if (hasSoonAlert || diffKm <= 1000 || (v.health && v.health < 75)) {
      maintSoon++;
    } else {
      normal++;
    }
  });  
  
  // Handlers
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVehicle.id) return;
    try {
      const res = await secureFetch(`http://localhost:8000/api/vehicles/${editVehicle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editVehicle)
      });
      if (res.ok) {
        addToast("Vehicle Updated", `Vehicle details saved successfully.`, "success");
        setShowEditModal(false);
        refreshData('vehicles');
        setSelectedVehicle(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefuel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle?.id) return;
    try {
      const res = await secureFetch(`http://localhost:8000/api/vehicles/${selectedVehicle.id}/refuel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fuel_added: refuelAmount })
      });
      if (res.ok) {
        addToast("Refueled", `Added ${refuelAmount} ${volUnit} of fuel.`, "success");
        setShowRefuelModal(false);
        setRefuelAmount(0);
        refreshData('vehicles');
        const updated = await res.json();
        setSelectedVehicle(updated);
      } else {
        const error = await res.json();
        addToast("Error", error.detail || "Cannot exceed tank capacity", "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const completeMaintenance = async (vehicleId: number) => {
    setMaintLoading(true);
    try {
      const res = await secureFetch(`http://localhost:8000/api/vehicles/${vehicleId}/maintenance/complete`, {
        method: 'POST'
      });
      if (res.ok) {
        addToast("Maintenance Completed", `Vehicle is now Available.`, "success");
        refreshData('vehicles');
        refreshData('alerts');
        const updated = await res.json();
        setSelectedVehicle(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMaintLoading(false);
    }
  };




  const [showAddModal, setShowAddModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    vehicle_number: '',
    registration: '',
    type: 'Semi-Truck',
    capacity: 15.0,
    mileage_kml: 10.0,
    insurance: 'POL-8802931',
    pollution: 'Certified - Expiry 12/26',
    fitness: 'Fit - Expiry 08/27'
  });

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await secureFetch('http://localhost:8000/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVehicle)
      });
      if (res.ok) {
        addToast("Asset Registered", `Vehicle ${newVehicle.vehicle_number} added to inventory.`, "success");
        setShowAddModal(false);
        setNewVehicle({
          vehicle_number: '',
          registration: '',
          type: 'Semi-Truck',
          capacity: 15.0,
          mileage_kml: 10.0,
          insurance: 'POL-8802931',
          pollution: 'Certified - Expiry 12/26',
          fitness: 'Fit - Expiry 08/27'
        });
        refreshData('vehicles');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const scheduleMaintenance = async (vehicleId: number) => {
    setMaintLoading(true);
    try {
      // Find vehicle
      const v = vehicles.find(item => item.id === vehicleId);
      if (!v) return;

      const updated = {
        ...v,
        availability: 'Maintenance' as const,
        health: Math.min(100, v.health + 20) // Repair bumps health
      };

      const res = await secureFetch(`http://localhost:8000/api/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });

      if (res.ok) {
        // Send a custom automation simulation step log
        await secureFetch(`http://localhost:8000/api/trips/1/simulate-event?event_type=traffic`, { method: 'POST' }); // Arbitrary event to show log sync
        addToast("Service Dispatched", `Vehicle ${v.vehicle_number} scheduled for maintenance and parts overhaul.`, "warning");
        refreshData('vehicles');
        setSelectedVehicle(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMaintLoading(false);
    }
  };

  const getHealthColor = (health: number) => {
    if (health >= 90) return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20';
    if (health >= 70) return 'text-amber-500 bg-amber-50 dark:bg-amber-950/20';
    return 'text-red-500 bg-red-50 dark:bg-red-950/20';
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400';
      case 'On Duty': return 'bg-blue-105 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400';
      case 'Maintenance': return 'bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-400';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-850 dark:text-slate-400';
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesType = filterType === 'All' || v.type === filterType;
    const matchesStatus = filterStatus === 'All' || v.availability === filterStatus;
    return matchesType && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Filters & Actions Header */}
      <section className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-soft-sm gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Vehicle Type</label>
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-xs text-slate-650 dark:text-slate-350 focus:outline-none"
            >
              <option value="All">All Types</option>
              <option value="Semi-Truck">Semi-Truck</option>
              <option value="Reefer">Reefer</option>
              <option value="Box Truck">Box Truck</option>
              <option value="Flatbed">Flatbed</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Status</label>
            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-xs text-slate-650 dark:text-slate-350 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="On Duty">On Duty</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-primary-600 hover:bg-primary-750 text-white rounded-lg text-xs font-bold shadow-soft-sm flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle
        </button>
      </section>

      {/* Fleet Health Card */}

      <div className="grid grid-cols-4 gap-4 mb-2">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-sm flex items-center justify-between">
          <div><p className="text-[10px] text-slate-400 font-bold uppercase">Operating Normally</p><h3 className="text-xl font-bold text-emerald-600">{normal}</h3></div>
          <CheckCircle className="w-6 h-6 text-emerald-500 opacity-20" />
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-sm flex items-center justify-between">
          <div><p className="text-[10px] text-slate-400 font-bold uppercase">Require Service Soon</p><h3 className="text-xl font-bold text-orange-600">{maintSoon}</h3></div>
          <Activity className="w-6 h-6 text-orange-500 opacity-20" />
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-sm flex items-center justify-between">
          <div><p className="text-[10px] text-slate-400 font-bold uppercase">Under Maintenance</p><h3 className="text-xl font-bold text-blue-600">{inMaint}</h3></div>
          <Wrench className="w-6 h-6 text-blue-500 opacity-20" />
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-sm flex items-center justify-between">
          <div><p className="text-[10px] text-slate-400 font-bold uppercase">Overdue</p><h3 className="text-xl font-bold text-red-600">{overdue}</h3></div>
          <ShieldAlert className="w-6 h-6 text-red-500 opacity-20" />
        </div>
      </div>

      {/* Main Workspace: Vehicles list + side panel */}
      <section className="flex gap-6 items-start flex-1 min-h-0">
        {/* Vehicles Grid list */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
          {filteredVehicles.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-slate-900 border py-16 text-center rounded-xl text-slate-400 text-xs">
              No vehicles matched your search filter criteria.
            </div>
          ) : (
            filteredVehicles.map(vehicle => {
              const assignedDriver = drivers.find(d => d.vehicle_id === vehicle.id);
              return (
                <div 
                  key={vehicle.id}
                  onClick={() => setSelectedVehicle(vehicle)}
                  className={`p-4 rounded-xl bg-white dark:bg-slate-900 border cursor-pointer hover:shadow-soft-lg transition-all flex flex-col justify-between gap-4 ${
                    selectedVehicle?.id === vehicle.id 
                      ? 'border-primary-500 dark:border-primary-650 shadow-soft-md' 
                      : 'border-slate-100 dark:border-slate-800 shadow-soft-sm'
                  }`}
                >
                  {/* Top Stats */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-650 dark:text-slate-350">
                        <Truck className="w-5 h-5 text-primary-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-150">{vehicle.vehicle_number}</h3>
                        <p className="text-[10px] text-slate-400 font-medium">{vehicle.type}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getAvailabilityColor(vehicle.availability)}`}>
                      {vehicle.availability}
                    </span>
                  </div>

                  {/* Meter gauges */}
                  <div className="grid grid-cols-2 gap-3 text-xs border-y py-2.5 border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Battery className="w-4 h-4 text-emerald-500" />
                      <div>
                        <span className="text-[9px] block text-slate-400 font-semibold uppercase">Fuel</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{(vehicle.current_fuel! * volMultiplier).toFixed(1)}{volUnit} / {Math.round(vehicle.fuel_capacity! * volMultiplier)}{volUnit}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Gauge className="w-4 h-4 text-indigo-500" />
                      <div>
                        <span className="text-[9px] block text-slate-400 font-semibold uppercase">Odometer</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{Math.round(vehicle.odometer! * distMultiplier).toLocaleString()} {distUnit}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    <span className="truncate">{vehicle.current_location || 'Unknown Location'}</span>
                  </div>

                  {/* Driver and Health info */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <User className="w-3.5 h-3.5" />
                      <span className="text-slate-600 dark:text-slate-400 font-semibold">{assignedDriver ? assignedDriver.name : 'Unassigned'}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getHealthColor(vehicle.health)}`}>
                      Health: {vehicle.health}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Details Panel */}
        {selectedVehicle && (
          <aside className="w-80 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-soft-lg flex flex-col gap-5 max-h-[calc(100vh-250px)] overflow-y-auto sticky top-0 animate-slide-in">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{selectedVehicle.vehicle_number}</h3>
                <span className="text-xs text-slate-400">{selectedVehicle.type}</span>
              </div>
              <button 
                onClick={() => setSelectedVehicle(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            {/* Capacity & Insurance list */}
            <div className="flex flex-col gap-3.5 text-xs text-slate-650 dark:text-slate-350">
              <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">Registration</span>
                <span className="font-bold">{selectedVehicle.registration || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">Capacity Load Limit</span>
                <span className="font-bold">{Math.round(selectedVehicle.capacity * weightMultiplier)} {weightUnit}</span>
              </div>
              <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">Insurance ID</span>
                <span className="font-bold">{selectedVehicle.insurance || 'Pending'}</span>
              </div>
              <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">Pollution Clearance</span>
                <span className="font-bold text-emerald-500">{selectedVehicle.pollution || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">Fitness Expiry</span>
                <span className="font-bold">{selectedVehicle.fitness || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">GPS Tracker Status</span>
                <span className="font-bold text-blue-500 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedVehicle.gps === 'Online' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                  {selectedVehicle.gps}
                </span>
              </div>
            <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">Fixed Mileage</span>
                <span className="font-bold">{(selectedVehicle.mileage_kml! * efficiencyMultiplier).toFixed(1)} {efficiencyUnit}</span>
              </div>
              <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">Next Service</span>
                <span className="font-bold text-orange-500">{Math.round(selectedVehicle.next_service_due! * distMultiplier).toLocaleString()} {distUnit}</span>
              </div>
            </div>

            {/* Quick Actions for Selected Vehicle */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button 
                onClick={() => { setEditVehicle(selectedVehicle); setShowEditModal(true); }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold shadow-soft-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button 
                onClick={() => { setRefuelAmount(0); setShowRefuelModal(true); }}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-soft-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <Droplet className="w-4 h-4" /> Refuel
              </button>
              {selectedVehicle.availability === 'Maintenance' ? (
                <button 
                  onClick={() => completeMaintenance(selectedVehicle.id)}
                  disabled={maintLoading}
                  className="col-span-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-soft-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" /> Complete Maintenance
                </button>
              ) : (
                <button 
                  onClick={() => scheduleMaintenance(selectedVehicle.id)}
                  disabled={maintLoading}
                  className="col-span-2 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-soft-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Wrench className="w-4 h-4" /> Move to Maintenance
                </button>
              )}
            </div>
          </aside>
        )}
      </section>

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Register New Fleet Asset</h3>
            <form onSubmit={handleAddVehicle} className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-650 dark:text-slate-350">Vehicle Number</label>
                <input 
                  type="text" required placeholder="e.g., TRK-108"
                  value={newVehicle.vehicle_number}
                  onChange={e => setNewVehicle({...newVehicle, vehicle_number: e.target.value})}
                  className="px-3 py-2 rounded-lg border border-slate-250 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-650 dark:text-slate-350">Registration Plate</label>
                <input 
                  type="text" placeholder="e.g., CA-112-ZZ"
                  value={newVehicle.registration}
                  onChange={e => setNewVehicle({...newVehicle, registration: e.target.value})}
                  className="px-3 py-2 rounded-lg border border-slate-250 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-650 dark:text-slate-350">Capacity ({weightUnit})</label>
                  <input 
                    type="number" step="0.1" required
                    value={newVehicle.capacity}
                    onChange={e => setNewVehicle({...newVehicle, capacity: parseFloat(e.target.value)})}
                    className="px-3 py-2 rounded-lg border border-slate-250 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-650 dark:text-slate-350">Vehicle Mileage ({efficiencyUnit})</label>
                  <input 
                    type="number" step="0.1" required min="1"
                    value={newVehicle.mileage_kml}
                    onChange={e => setNewVehicle({...newVehicle, mileage_kml: parseFloat(e.target.value)})}
                    className="px-3 py-2 rounded-lg border border-slate-250 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <button 
                  type="button" onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-450"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-750 text-white rounded-lg font-semibold shadow-soft-sm"
                >
                  Register Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refuel Modal */}
      {showRefuelModal && selectedVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Refuel Vehicle</h3>
            <form onSubmit={handleRefuel} className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-650 dark:text-slate-350">Fuel Added ({volUnit})</label>
                <input 
                  type="number" step="0.1" required min="0" max={((selectedVehicle.fuel_capacity || 100) - (selectedVehicle.current_fuel || 0)) * volMultiplier}
                  value={refuelAmount}
                  onChange={e => setRefuelAmount(parseFloat(e.target.value) / volMultiplier)}
                  className="px-3 py-2 rounded-lg border border-slate-250 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500"
                />
                <p className="text-[10px] text-slate-400">Tank Cap: {Math.round(selectedVehicle.fuel_capacity! * volMultiplier)}{volUnit} | Current: {(selectedVehicle.current_fuel! * volMultiplier).toFixed(1)}{volUnit}</p>
              </div>
              <div className="flex justify-end gap-2.5 mt-2">
                <button type="button" onClick={() => setShowRefuelModal(false)} className="px-4 py-2 border rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-soft-sm">Refuel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Vehicle Modal */}
      {showEditModal && editVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-2xl w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Edit Vehicle</h3>
            <form onSubmit={handleEditSubmit} className="grid grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Vehicle Number</label>
                <input type="text" value={editVehicle.vehicle_number || ''} onChange={e => setEditVehicle({...editVehicle, vehicle_number: e.target.value})} className="px-3 py-2 rounded-lg border bg-transparent" />
              </div>
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Current Location</label>
                <input type="text" value={editVehicle.current_location || ''} onChange={e => setEditVehicle({...editVehicle, current_location: e.target.value})} className="px-3 py-2 rounded-lg border bg-transparent" />
              </div>
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Vehicle Type</label>
                <select value={editVehicle.type || ''} onChange={e => setEditVehicle({...editVehicle, type: e.target.value})} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
                  <option value="Semi-Truck">Semi-Truck</option><option value="Reefer">Reefer</option><option value="Box Truck">Box Truck</option><option value="Flatbed">Flatbed</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Capacity Load ({weightUnit})</label>
                <input type="number" step="0.1" value={(editVehicle.capacity || 0) * weightMultiplier} onChange={e => setEditVehicle({...editVehicle, capacity: parseFloat(e.target.value) / weightMultiplier})} className="px-3 py-2 rounded-lg border bg-transparent" />
              </div>
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Fixed Mileage ({efficiencyUnit})</label>
                <input type="number" step="0.1" value={(editVehicle.mileage_kml || 0) * efficiencyMultiplier} onChange={e => setEditVehicle({...editVehicle, mileage_kml: parseFloat(e.target.value) / efficiencyMultiplier})} className="px-3 py-2 rounded-lg border bg-transparent" />
              </div>
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Fuel Tank Capacity ({volUnit})</label>
                <input type="number" step="0.1" value={(editVehicle.fuel_capacity || 0) * volMultiplier} onChange={e => setEditVehicle({...editVehicle, fuel_capacity: parseFloat(e.target.value) / volMultiplier})} className="px-3 py-2 rounded-lg border bg-transparent" />
              </div>
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Current Odometer ({distUnit})</label>
                <input type="number" step="0.1" value={(editVehicle.odometer || 0) * distMultiplier} onChange={e => setEditVehicle({...editVehicle, odometer: parseFloat(e.target.value) / distMultiplier})} className="px-3 py-2 rounded-lg border bg-transparent" />
              </div>
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Service Interval ({distUnit})</label>
                <input type="number" step="0.1" value={(editVehicle.service_interval || 0) * distMultiplier} onChange={e => setEditVehicle({...editVehicle, service_interval: parseFloat(e.target.value) / distMultiplier})} className="px-3 py-2 rounded-lg border bg-transparent" />
              </div>
              <div className="col-span-2 flex justify-end gap-2.5 mt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 hover:bg-primary-750 text-white rounded-lg font-semibold shadow-soft-sm">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

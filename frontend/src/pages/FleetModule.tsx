import React, { useState } from 'react';
import { useAppContext } from '../App';
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
  Plus
} from 'lucide-react';
import { Vehicle } from '../types';

export default function FleetModule() {
  const { vehicles, drivers, refreshData, addToast, secureFetch } = useAppContext();
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [filterType, setFilterType] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [maintLoading, setMaintLoading] = useState(false);

  // Form states for adding vehicle
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    vehicle_number: '',
    registration: '',
    type: 'Semi-Truck',
    capacity: 15.0,
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
                        <span className="text-[9px] block text-slate-400 font-semibold uppercase">Fuel Capacity</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{vehicle.fuel}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Gauge className="w-4 h-4 text-indigo-500" />
                      <div>
                        <span className="text-[9px] block text-slate-400 font-semibold uppercase">Total Mileage</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{vehicle.mileage.toLocaleString()} km</span>
                      </div>
                    </div>
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
                <span className="font-bold">{selectedVehicle.capacity} Tons</span>
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
            </div>

            {/* Quick Actions for Selected Vehicle */}
            <div className="flex flex-col gap-2 mt-2">
              <button 
                onClick={() => scheduleMaintenance(selectedVehicle.id)}
                disabled={maintLoading || selectedVehicle.availability === 'Maintenance'}
                className="w-full py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-205 disabled:dark:bg-slate-800/50 text-white rounded-lg text-xs font-bold shadow-soft-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <Wrench className="w-4 h-4" />
                {selectedVehicle.availability === 'Maintenance' ? 'In Maintenance' : 'Schedule Maintenance'}
              </button>
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
                  <label className="font-semibold text-slate-650 dark:text-slate-350">Vehicle Type</label>
                  <select 
                    value={newVehicle.type}
                    onChange={e => setNewVehicle({...newVehicle, type: e.target.value})}
                    className="px-3 py-2 rounded-lg border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none"
                  >
                    <option value="Semi-Truck">Semi-Truck</option>
                    <option value="Reefer">Reefer</option>
                    <option value="Box Truck">Box Truck</option>
                    <option value="Flatbed">Flatbed</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-650 dark:text-slate-350">Capacity (Tons)</label>
                  <input 
                    type="number" step="0.1" required
                    value={newVehicle.capacity}
                    onChange={e => setNewVehicle({...newVehicle, capacity: parseFloat(e.target.value)})}
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
    </div>
  );
}

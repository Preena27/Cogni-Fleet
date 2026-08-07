import re
import os

filepath = r"d:\Projects\fleet\Cogni-Fleet\frontend\src\pages\FleetModule.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update imports
imports = """import { 
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
} from 'lucide-react';"""
content = re.sub(r"import \{\s+Truck,.*?from 'lucide-react';", imports, content, flags=re.DOTALL)

# 2. Add new states inside FleetModule
states_addition = """
  // New States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Partial<Vehicle>>({});
  
  const [showRefuelModal, setShowRefuelModal] = useState(false);
  const [refuelAmount, setRefuelAmount] = useState<number>(0);
  
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
        addToast("Refueled", `Added ${refuelAmount} L of fuel.`, "success");
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

  // Fleet Health Stats
  const maintSoon = vehicles.filter(v => v.next_service_due && v.odometer && (v.next_service_due - v.odometer) <= 1000 && (v.next_service_due - v.odometer) > 0).length;
  const inMaint = vehicles.filter(v => v.availability === 'Maintenance').length;
  const overdue = vehicles.filter(v => v.next_service_due && v.odometer && (v.next_service_due - v.odometer) <= 0).length;
  const normal = vehicles.length - maintSoon - inMaint - overdue;
"""
content = content.replace("const [maintLoading, setMaintLoading] = useState(false);", "const [maintLoading, setMaintLoading] = useState(false);" + states_addition)

# 3. Add Fleet Health summary card right above the vehicles grid
health_card = """
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
"""
content = content.replace("{/* Main Workspace: Vehicles list + side panel */}", "{/* Fleet Health Card */}\n" + health_card + "\n      {/* Main Workspace: Vehicles list + side panel */}")

# 4. Update Vehicle Card to show odometer and location instead of overall mileage
old_meters = """                  {/* Meter gauges */}
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
                  </div>"""

new_meters = """                  {/* Meter gauges */}
                  <div className="grid grid-cols-2 gap-3 text-xs border-y py-2.5 border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Battery className="w-4 h-4 text-emerald-500" />
                      <div>
                        <span className="text-[9px] block text-slate-400 font-semibold uppercase">Fuel</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{vehicle.current_fuel?.toFixed(1)}L / {vehicle.fuel_capacity}L</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Gauge className="w-4 h-4 text-indigo-500" />
                      <div>
                        <span className="text-[9px] block text-slate-400 font-semibold uppercase">Odometer</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{vehicle.odometer?.toLocaleString()} km</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    <span className="truncate">{vehicle.current_location || 'Unknown Location'}</span>
                  </div>"""
content = content.replace(old_meters, new_meters)

# 5. Update Side Panel
old_side = """            {/* Quick Actions for Selected Vehicle */}
            <div className="flex flex-col gap-2 mt-2">
              <button 
                onClick={() => scheduleMaintenance(selectedVehicle.id)}
                disabled={maintLoading || selectedVehicle.availability === 'Maintenance'}
                className="w-full py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-205 disabled:dark:bg-slate-800/50 text-white rounded-lg text-xs font-bold shadow-soft-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <Wrench className="w-4 h-4" />
                {selectedVehicle.availability === 'Maintenance' ? 'In Maintenance' : 'Schedule Maintenance'}
              </button>
            </div>"""

new_side = """            <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">Fixed Mileage</span>
                <span className="font-bold">{selectedVehicle.mileage_kml} km/L</span>
              </div>
              <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">Next Service</span>
                <span className="font-bold text-orange-500">{selectedVehicle.next_service_due?.toLocaleString()} km</span>
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
            </div>"""

content = content.replace("""            </div>

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
            </div>""", new_side)


# 6. Add Edit and Refuel Modals at the end
modals = """
      {/* Refuel Modal */}
      {showRefuelModal && selectedVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Refuel Vehicle</h3>
            <form onSubmit={handleRefuel} className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-650 dark:text-slate-350">Fuel Added (Litres)</label>
                <input 
                  type="number" step="0.1" required min="0" max={(selectedVehicle.fuel_capacity || 100) - (selectedVehicle.current_fuel || 0)}
                  value={refuelAmount}
                  onChange={e => setRefuelAmount(parseFloat(e.target.value))}
                  className="px-3 py-2 rounded-lg border border-slate-250 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500"
                />
                <p className="text-[10px] text-slate-400">Tank Cap: {selectedVehicle.fuel_capacity}L | Current: {selectedVehicle.current_fuel?.toFixed(1)}L</p>
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
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Capacity Load (Tons)</label>
                <input type="number" step="0.1" value={editVehicle.capacity || 0} onChange={e => setEditVehicle({...editVehicle, capacity: parseFloat(e.target.value)})} className="px-3 py-2 rounded-lg border bg-transparent" />
              </div>
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Fixed Mileage (km/L)</label>
                <input type="number" step="0.1" value={editVehicle.mileage_kml || 0} onChange={e => setEditVehicle({...editVehicle, mileage_kml: parseFloat(e.target.value)})} className="px-3 py-2 rounded-lg border bg-transparent" />
              </div>
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Fuel Tank Capacity (L)</label>
                <input type="number" step="0.1" value={editVehicle.fuel_capacity || 0} onChange={e => setEditVehicle({...editVehicle, fuel_capacity: parseFloat(e.target.value)})} className="px-3 py-2 rounded-lg border bg-transparent" />
              </div>
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Current Odometer (km)</label>
                <input type="number" step="0.1" value={editVehicle.odometer || 0} onChange={e => setEditVehicle({...editVehicle, odometer: parseFloat(e.target.value)})} className="px-3 py-2 rounded-lg border bg-transparent" />
              </div>
              <div className="flex flex-col gap-1.5"><label className="font-semibold text-slate-650 dark:text-slate-350">Service Interval (km)</label>
                <input type="number" step="0.1" value={editVehicle.service_interval || 0} onChange={e => setEditVehicle({...editVehicle, service_interval: parseFloat(e.target.value)})} className="px-3 py-2 rounded-lg border bg-transparent" />
              </div>
              <div className="col-span-2 flex justify-end gap-2.5 mt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 hover:bg-primary-750 text-white rounded-lg font-semibold shadow-soft-sm">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
"""
content = content.replace("    </div>\n  );\n}\n", modals + "    </div>\n  );\n}\n")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated FleetModule.tsx")

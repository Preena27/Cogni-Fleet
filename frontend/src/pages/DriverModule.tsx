import React, { useState } from 'react';
import { useAppContext } from '../App';
import { 
  Users, 
  Star, 
  Phone, 
  Mail, 
  Award, 
  AlertOctagon, 
  ShieldCheck, 
  MapPin, 
  Plus, 
  MessageSquare,
  History
} from 'lucide-react';
import { Driver } from '../types';

export default function DriverModule() {
  const { drivers, trips, vehicles, refreshData, addToast, secureFetch } = useAppContext();
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [filterAvailability, setFilterAvailability] = useState<string>('All');
  
  // Create state for direct message dialog simulation
  const [activeMessageDriver, setActiveMessageDriver] = useState<Driver | null>(null);
  const [messageText, setMessageText] = useState('');

  // Add Driver states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDriver, setNewDriver] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    license: '',
    phone: '',
  });

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newDriver.password !== newDriver.confirmPassword) {
      addToast("Validation Error", "Passwords do not match.", "warning");
      return;
    }
    try {
      const res = await secureFetch('http://localhost:8000/api/drivers', {
        method: 'POST',
        body: JSON.stringify({
          name: newDriver.name,
          username: newDriver.username,
          password: newDriver.password,
          license: newDriver.license,
          phone: newDriver.phone
        })
      });
      if (res.ok) {
        addToast("Driver Enrolled", `Driver operator ${newDriver.name} added to roster.`, "success");
        setShowAddModal(false);
        setNewDriver({
          name: '',
          username: '',
          password: '',
          confirmPassword: '',
          license: '',
          phone: '',
        });
        refreshData('drivers');
      } else {
        const err = await res.json();
        addToast("Enrollment Failed", err.detail || "Could not register driver operator user account.", "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredDrivers = drivers.filter(d => {
    return filterAvailability === 'All' || d.availability === filterAvailability;
  });

  const getRatingColor = (rating: number) => {
    if (rating >= 4.7) return 'text-amber-500';
    if (rating >= 4.0) return 'text-slate-400';
    return 'text-red-500';
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-emerald-100 text-emerald-850 dark:bg-emerald-950/30 dark:text-emerald-400';
      case 'On Duty': return 'bg-blue-105 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400';
      case 'Off Duty': return 'bg-slate-100 text-slate-805 dark:bg-slate-800 dark:text-slate-400';
      default: return 'bg-slate-100 text-slate-805';
    }
  };

  const handleSimulateCall = (name: string) => {
    addToast("Initiating Connection", `Dialing voice link to driver ${name}... (VoIP Sandbox mode)`, "info");
  };

  const handleSimulateMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeMessageDriver) return;
    
    addToast("SMS Broadcasted", `Direct cellular message routed to ${activeMessageDriver.name}: "${messageText}"`, "success");
    setMessageText('');
    setActiveMessageDriver(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Filter and Overview Header */}
      <section className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-soft-sm gap-4 flex-wrap">
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Availability Filter</label>
          <select 
            value={filterAvailability} 
            onChange={e => setFilterAvailability(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-xs text-slate-650 dark:text-slate-350 focus:outline-none"
          >
            <option value="All">All Drivers</option>
            <option value="Available">Available Only</option>
            <option value="On Duty">On Duty</option>
            <option value="Off Duty">Off Duty</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">
            Total Directory Size: {drivers.length} operators
          </span>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-primary-600 hover:bg-primary-750 text-white rounded-lg text-xs font-bold shadow-soft-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Driver
          </button>
        </div>
      </section>

      {/* Main Workspace grid layout */}
      <section className="flex gap-6 items-start">
        {/* Drivers Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
          {filteredDrivers.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-slate-900 border py-16 text-center rounded-xl text-slate-400 text-xs">
              No drivers match the selected status category.
            </div>
          ) : (
            filteredDrivers.map(driver => {
              const truckAssigned = vehicles.find(v => v.id === driver.vehicle_id);
              const completedTripsCount = trips.filter(t => t.driver_id === driver.id && t.status === 'Completed').length;

              return (
                <div 
                  key={driver.id}
                  onClick={() => setSelectedDriver(driver)}
                  className={`p-4 rounded-xl bg-white dark:bg-slate-900 border cursor-pointer hover:shadow-soft-lg transition-all flex flex-col justify-between gap-4.5 ${
                    selectedDriver?.id === driver.id 
                      ? 'border-primary-500 dark:border-primary-650 shadow-soft-md' 
                      : 'border-slate-100 dark:border-slate-800 shadow-soft-sm'
                  }`}
                >
                  {/* Title Bar */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-350">
                      {driver.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-slate-805 dark:text-slate-150 truncate">{driver.name}</h3>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${getAvailabilityColor(driver.availability)}`}>
                          {driver.availability}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-bold text-slate-700 dark:text-slate-300">{driver.rating.toFixed(1)}</span>
                        <span>• {driver.experience} yrs exp</span>
                      </p>
                    </div>
                  </div>

                  {/* Core details */}
                  <div className="grid grid-cols-2 gap-3 text-xs border-y py-2.5 border-slate-50 dark:border-slate-800/80">
                    <div>
                      <span className="text-[9px] block text-slate-400 font-semibold uppercase">Assigned Truck</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">
                        {truckAssigned ? truckAssigned.vehicle_number : 'Unassigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] block text-slate-400 font-semibold uppercase">Completed Trips</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{completedTripsCount} loads</span>
                    </div>
                  </div>

                  {/* Operational indicators */}
                  <div className="flex items-center justify-between text-[10px] font-semibold">
                    <span className="text-slate-400">Weekly Performance:</span>
                    <span className="text-emerald-500 font-bold">{driver.performance}% index</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Details Panel */}
        {selectedDriver && (
          <aside className="w-80 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-soft-lg flex flex-col gap-5 max-h-[calc(100vh-250px)] overflow-y-auto sticky top-0 animate-slide-in">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-850 dark:text-slate-100">{selectedDriver.name}</h3>
                <span className="text-xs text-slate-400">Driver License ID: {selectedDriver.license || 'N/A'}</span>
              </div>
              <button 
                onClick={() => setSelectedDriver(null)}
                className="text-xs text-slate-400 hover:text-slate-650"
              >
                Close
              </button>
            </div>

            {/* Quick Contacts */}
            <div className="flex flex-col gap-2.5 text-xs text-slate-650 dark:text-slate-350">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{selectedDriver.phone || 'No phone recorded'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{selectedDriver.email || 'No email recorded'}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{selectedDriver.address || 'Unknown Address'}</span>
              </div>
            </div>

            {/* Metrics Checklist */}
            <div className="flex flex-col gap-3.5 text-xs">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Compliance & Performance</h4>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-slate-450 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" /> License Expiry
                </span>
                <span className="font-bold">{selectedDriver.license_expiry || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-slate-450 flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-red-500" /> Active Violations
                </span>
                <span className={`font-bold ${selectedDriver.violations > 0 ? 'text-red-550' : 'text-slate-700 dark:text-slate-300'}`}>
                  {selectedDriver.violations} Records
                </span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-slate-450 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Medical / Health Status
                </span>
                <span className="font-bold text-emerald-500">{selectedDriver.health}</span>
              </div>
            </div>

            {/* Simulated Action buttons */}
            <div className="flex flex-col gap-2 mt-2">
              <button 
                onClick={() => handleSimulateCall(selectedDriver.name)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-bold shadow-soft-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-4 h-4 text-slate-500" />
                Call Driver
              </button>
              <button 
                onClick={() => setActiveMessageDriver(selectedDriver)}
                className="w-full py-2 bg-primary-600 hover:bg-primary-750 text-white rounded-lg text-xs font-bold shadow-soft-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Message Driver
              </button>
            </div>
          </aside>
        )}
      </section>

      {/* Message Chat Sandbox Modal */}
      {activeMessageDriver && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Send Cellular Broadcast: {activeMessageDriver.name}</h3>
            <form onSubmit={handleSimulateMessage} className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-650 dark:text-slate-350">Message Body</label>
                <textarea 
                  rows={4} required placeholder="Write message to push to driver device..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-250 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <button 
                  type="button" onClick={() => setActiveMessageDriver(null)}
                  className="px-4 py-2 border rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-450"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-750 text-white rounded-lg font-semibold shadow-soft-sm"
                >
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Driver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-soft-lg flex flex-col gap-4 animate-scale-in">
            <h3 className="font-bold text-base text-slate-805 dark:text-slate-100">Enroll New Driver Operator</h3>
            <form onSubmit={handleAddDriver} className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Driver Name</label>
                <input 
                  type="text" required placeholder="e.g., Alexander Mercer"
                  value={newDriver.name}
                  onChange={e => setNewDriver({...newDriver, name: e.target.value})}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Login Username</label>
                <input 
                  type="text" required placeholder="e.g., alex_mercer"
                  value={newDriver.username}
                  onChange={e => setNewDriver({...newDriver, username: e.target.value})}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-500">Password</label>
                  <input 
                    type="password" required placeholder="••••••••"
                    value={newDriver.password}
                    onChange={e => setNewDriver({...newDriver, password: e.target.value})}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-500">Confirm Password</label>
                  <input 
                    type="password" required placeholder="••••••••"
                    value={newDriver.confirmPassword}
                    onChange={e => setNewDriver({...newDriver, confirmPassword: e.target.value})}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-500">License Number</label>
                  <input 
                    type="text" required placeholder="e.g., DL-992031"
                    value={newDriver.license}
                    onChange={e => setNewDriver({...newDriver, license: e.target.value})}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-500">Phone Number</label>
                  <input 
                    type="text" required placeholder="e.g., +1 (555) 019-3382"
                    value={newDriver.phone}
                    onChange={e => setNewDriver({...newDriver, phone: e.target.value})}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <button 
                  type="button" onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-455"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-750 text-white rounded-lg font-semibold shadow-soft-sm"
                >
                  Register Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

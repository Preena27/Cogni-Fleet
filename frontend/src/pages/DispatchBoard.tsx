import React, { useState } from 'react';
import { useAppContext } from '../App';
import { 
  Plus, 
  Search, 
  Truck, 
  User, 
  MapPin, 
  AlertOctagon, 
  CheckCircle,
  HelpCircle,
  Clock
} from 'lucide-react';
import { Trip } from '../types';

export default function DispatchBoard() {
  const { trips, drivers, vehicles, refreshData, addToast, secureFetch } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');

  const columns = [
    { id: 'Unassigned', title: 'Unassigned', color: 'border-slate-300 bg-slate-50/50 dark:bg-slate-900/30' },
    { id: 'Assigned', title: 'Assigned', color: 'border-blue-300 bg-blue-50/10 dark:bg-blue-950/10' },
    { id: 'Loading', title: 'Loading at Dock', color: 'border-purple-300 bg-purple-50/10 dark:bg-purple-950/10' },
    { id: 'In Transit', title: 'In Transit', color: 'border-indigo-400 bg-indigo-50/10 dark:bg-indigo-950/10' },
    { id: 'Problem', title: 'Problem Flagged', color: 'border-red-400 bg-red-50/10 dark:bg-red-950/10' },
    { id: 'Completed', title: 'Completed', color: 'border-emerald-450 bg-emerald-50/10 dark:bg-emerald-950/10' }
  ];

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, tripId: number) => {
    e.dataTransfer.setData("text/plain", tripId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: any) => {
    e.preventDefault();
    const tripIdStr = e.dataTransfer.getData("text/plain");
    if (!tripIdStr) return;
    const tripId = parseInt(tripIdStr);
    
    // Find the trip
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    if (trip.status === newStatus) return;

    // Strict validation: cannot move to Assigned or In Transit if driver/vehicle missing
    if (newStatus !== 'Unassigned' && !trip.driver_id) {
      addToast("Assignment Required", "Must assign a driver and vehicle before dispatching cargo.", "warning");
      return;
    }

    try {
      const updated = {
        ...trip,
        status: newStatus
      };

      const res = await secureFetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });

      if (res.ok) {
        addToast("Board Updated", `Trip #L-${tripId} transitioned to ${newStatus}.`, "success");
        refreshData('trips');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter lists based on search
  const filteredTrips = trips.filter(t => 
    t.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.pickup.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.destination.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Search Filter Header */}
      <section className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-soft-sm flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input 
            type="text" placeholder="Filter board items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent text-xs text-slate-700 dark:text-slate-355 focus:outline-none"
          />
        </div>
        <div className="text-[10px] uppercase font-bold text-slate-400">
          Tip: Drag cards between columns to update load transit states.
        </div>
      </section>

      {/* Kanban Board Board */}
      <section className="flex gap-4 overflow-x-auto flex-1 min-h-0 pb-4 select-none max-h-[calc(100vh-250px)]">
        {columns.map(col => {
          const colTrips = filteredTrips.filter(t => t.status === col.id);

          return (
            <div 
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`w-72 shrink-0 rounded-xl border-t-4 p-4 flex flex-col gap-3.5 shadow-soft-sm transition-all ${col.color}`}
            >
              {/* Column Header */}
              <div className="flex justify-between items-center pb-2 border-b dark:border-slate-800/80">
                <span className="font-bold text-xs text-slate-750 dark:text-slate-200">{col.title}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                  {colTrips.length}
                </span>
              </div>

              {/* Column Cards Container */}
              <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1 min-h-[300px]">
                {colTrips.map(trip => {
                  const driver = drivers.find(d => d.id === trip.driver_id);
                  const vehicle = vehicles.find(v => v.id === trip.vehicle_id);

                  return (
                    <div 
                      key={trip.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, trip.id)}
                      className="p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-xl shadow-soft-sm hover:shadow-soft-md cursor-grab active:cursor-grabbing transition-all flex flex-col gap-3 group border-l-2 hover:border-l-primary-500"
                    >
                      {/* Customer Client */}
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-150">{trip.customer}</span>
                        <span className="font-mono text-[9px] text-slate-400 font-bold">#L-{trip.id}</span>
                      </div>

                      {/* Route Journey */}
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        <p className="font-semibold text-slate-750 dark:text-slate-250 truncate">{trip.pickup}</p>
                        <p className="text-slate-400 mt-0.5 truncate">↓ {trip.destination}</p>
                      </div>

                      {/* Details row (Weight/Tons, Driver avatar) */}
                      <div className="flex items-center justify-between text-[9px] border-t pt-2 border-slate-50 dark:border-slate-850/80">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{trip.eta || 'No ETA'}</span>
                        </div>
                        {driver && (
                          <div className="flex items-center gap-1">
                            <div className="w-4 h-4 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center font-bold text-[8px] text-primary-600">
                              {driver.name.charAt(0)}
                            </div>
                            <span className="text-[9px] text-slate-600 dark:text-slate-400 font-medium">{driver.name.split(' ')[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {colTrips.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 border border-dashed rounded-lg text-slate-400 text-[10px]">
                    Drag cards here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

import React, { useState } from 'react';
import { useAppContext } from '../App';
import { 
  Database, 
  MapPin, 
  Layers, 
  Calendar, 
  Inbox, 
  ChevronDown
} from 'lucide-react';
import { Warehouse } from '../types';

export default function WarehouseModule() {
  const { warehouses } = useAppContext();
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);

  const getOccupancyColor = (percentage: number) => {
    if (percentage > 85) return 'bg-red-500';
    if (percentage > 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Warehouses Grid Summary */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {warehouses.map(w => {
          // Parse JSON inventory if available
          const inventoryList = w.inventory ? JSON.parse(w.inventory) : [];
          const totalItemsCount = inventoryList.reduce((sum: number, item: any) => sum + item.qty, 0);

          return (
            <div 
              key={w.id}
              onClick={() => setSelectedWarehouse(w)}
              className={`p-5 rounded-xl bg-white dark:bg-slate-900 border cursor-pointer hover:shadow-soft-lg transition-all flex flex-col justify-between gap-4 ${
                selectedWarehouse?.id === w.id 
                  ? 'border-primary-500 dark:border-primary-650 shadow-soft-md' 
                  : 'border-slate-100 dark:border-slate-800 shadow-soft-sm'
              }`}
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-500 shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-150 leading-tight">{w.name}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{w.location}</span>
                  </p>
                </div>
              </div>

              {/* Progress gauge */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-400">Warehouse Capacity Occupancy</span>
                  <span className="font-bold text-slate-700 dark:text-slate-350">{w.occupancy}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${getOccupancyColor(w.occupancy)}`} 
                    style={{ width: `${w.occupancy}%` }}
                  ></div>
                </div>
              </div>

              {/* Inbound / Outbound counts */}
              <div className="grid grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-50 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500">
                    <Inbox className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-450 uppercase font-semibold">Inbound</span>
                    <span className="font-bold">{w.inbound} loads today</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-orange-50 dark:bg-orange-950/20 text-orange-500">
                    <Inbox className="w-3.5 h-3.5 rotate-180" />
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-450 uppercase font-semibold">Outbound</span>
                    <span className="font-bold">{w.outbound} loads today</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Warehouse specific detailed panel layout */}
      {selectedWarehouse && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-in">
          {/* Inventory Table */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md">
            <h4 className="font-bold text-sm text-slate-850 dark:text-slate-150 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              <span>Current Stock Inventory ({selectedWarehouse.name})</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5">Cargo Item SKU</th>
                    <th className="py-2.5 text-right">In-Stock Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-850/80">
                  {selectedWarehouse.inventory ? (
                    JSON.parse(selectedWarehouse.inventory).map((item: any, idx: number) => (
                      <tr key={idx} className="text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/10">
                        <td className="py-2.5 font-semibold">{item.item}</td>
                        <td className="py-2.5 text-right font-bold text-slate-800 dark:text-slate-150">{item.qty.toLocaleString()} units</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-4 text-center text-slate-400">No inventory logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dock Appointments */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md">
            <h4 className="font-bold text-sm text-slate-850 dark:text-slate-150 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <span>Dock Scheduling Board</span>
            </h4>
            <div className="flex flex-col gap-3">
              {selectedWarehouse.dock_appointments ? (
                JSON.parse(selectedWarehouse.dock_appointments).map((appt: any, idx: number) => (
                  <div 
                    key={idx}
                    className="p-3 rounded-lg border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-800/10 flex justify-between items-center text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{appt.carrier} Dispatch</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Appointment Schedule: {appt.time}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      appt.status === 'Completed' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400' 
                        : 'bg-blue-105 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400'
                    }`}>
                      {appt.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center">No active appointments scheduled.</p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

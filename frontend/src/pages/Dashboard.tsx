import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { 
  TrendingUp, 
  Truck, 
  Users, 
  DollarSign, 
  Activity, 
  AlertTriangle, 
  Clock, 
  CheckCircle,
  PlusCircle,
  FileSpreadsheet,
  Map,
  Wrench,
  ChevronRight,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';

export default function Dashboard() {
  const { trips, vehicles, drivers, alerts, refreshAll } = useAppContext();
  const navigate = useNavigate();

  // 1. Calculate stats from state
  const activeTripsCount = trips.filter(t => ['Assigned', 'Loading', 'In Transit'].includes(t.status)).length;
  const availableVehiclesCount = vehicles.filter(v => v.availability === 'Available').length;
  const driversOnDutyCount = drivers.filter(d => d.availability === 'On Duty').length;
  const totalRevenue = trips.filter(t => t.status === 'Completed').reduce((sum, t) => sum + t.revenue, 0);
  const totalFuelCost = trips.reduce((sum, t) => sum + t.fuel_cost, 0);
  const pendingDeliveries = trips.filter(t => ['Assigned', 'Loading'].includes(t.status)).length;
  
  const avgFleetHealth = vehicles.length > 0 
    ? Math.round(vehicles.reduce((sum, v) => sum + v.health, 0) / vehicles.length) 
    : 100;
    
  const delayedTripsCount = trips.filter(t => t.status === 'Problem').length;

  const activeAlerts = alerts.filter(a => !a.resolved && a.severity !== 'Resolved');

  // 2. Prepare charts mock data derived from actual numbers
  const chartData = [
    { name: 'Mon', revenue: 4200, fuel: 980, trips: 3 },
    { name: 'Tue', revenue: 5800, fuel: 1200, trips: 5 },
    { name: 'Wed', revenue: 3900, fuel: 820, trips: 2 },
    { name: 'Thu', revenue: 7200, fuel: 1600, trips: 6 },
    { name: 'Fri', revenue: 6400, fuel: 1400, trips: 4 },
    { name: 'Sat', revenue: 3100, fuel: 650, trips: 1 },
    { name: 'Sun', revenue: totalRevenue > 0 ? totalRevenue % 5000 : 2500, fuel: totalFuelCost > 0 ? (totalFuelCost % 1500) : 550, trips: activeTripsCount },
  ];

  // Quick Action Handler
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'create': navigate('/loads'); break;
      case 'assign': navigate('/loads'); break;
      case 'invoice': navigate('/billing'); break;
      case 'route': navigate('/map'); break;
      case 'report': navigate('/reports'); break;
      case 'maint': navigate('/fleet'); break;
      case 'fleet': navigate('/fleet'); break;
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400';
      case 'high': return 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-850 text-orange-700 dark:text-orange-400';
      case 'medium': return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400';
      case 'low': return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400';
      default: return 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 text-emerald-700 dark:text-emerald-400';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Dynamic Alert Banner (If there is a Critical alert) */}
      {activeAlerts.some(a => a.severity === 'Critical') && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/50 text-red-800 dark:text-red-300 flex items-center justify-between animate-pulse-slow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-150 dark:bg-red-900/40 flex items-center justify-center text-red-650">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="font-bold text-sm">Critical Safety Alert Active</p>
              <p className="text-xs opacity-90">Vehicle breakdown or mechanical failure reported. Immediate action requested in tracking portal.</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/map')}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-750 text-white rounded-lg text-xs font-bold shadow-soft-sm transition-colors"
          >
            Locate Vehicle
          </button>
        </div>
      )}

      {/* Grid of 8 Stats Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Active Trips */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-md hover:shadow-soft-lg transition-all">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider font-sans">Active Trips</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-500">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold font-sans text-slate-800 dark:text-slate-100 mt-2">{activeTripsCount}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">In transit or scheduled today</span>
        </div>

        {/* 2. Available Vehicles */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-md hover:shadow-soft-lg transition-all">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider font-sans">Available Vehicles</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-500">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold font-sans text-slate-800 dark:text-slate-100 mt-2">{availableVehiclesCount}</p>
          <span className="text-[10px] text-emerald-500 mt-1 block font-medium">Ready for dispatch</span>
        </div>

        {/* 3. Drivers On Duty */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-md hover:shadow-soft-lg transition-all">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider font-sans">Drivers On Duty</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center text-purple-500">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold font-sans text-slate-800 dark:text-slate-100 mt-2">{driversOnDutyCount}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Currently driving routes</span>
        </div>

        {/* 4. Total Revenue */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-md hover:shadow-soft-lg transition-all">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider font-sans">Total Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-500">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold font-sans text-slate-800 dark:text-slate-100 mt-2">${totalRevenue.toLocaleString()}</p>
          <span className="text-[10px] text-emerald-500 mt-1 block font-medium">+12.4% from last week</span>
        </div>

        {/* 5. Fuel Cost */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-md hover:shadow-soft-lg transition-all">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider font-sans">Fuel Cost</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-500">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold font-sans text-slate-800 dark:text-slate-100 mt-2">${totalFuelCost.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Accumulated transit fuel</span>
        </div>

        {/* 6. Pending Deliveries */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-md hover:shadow-soft-lg transition-all">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider font-sans">Pending Deliveries</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold font-sans text-slate-800 dark:text-slate-100 mt-2">{pendingDeliveries}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Awaiting driver pickup / loading</span>
        </div>

        {/* 7. Fleet Health */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-md hover:shadow-soft-lg transition-all">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider font-sans">Fleet Health</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center text-teal-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold font-sans text-slate-800 dark:text-slate-100 mt-2">{avgFleetHealth}%</p>
          <span className="text-[10px] text-amber-500 mt-1 block font-medium">2 trucks require service soon</span>
        </div>

        {/* 8. Delayed Trips */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-md hover:shadow-soft-lg transition-all">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider font-sans">Delayed Trips</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold font-sans text-red-650 dark:text-red-400 mt-2">{delayedTripsCount}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Trips reporting active issues</span>
        </div>
      </section>

      {/* Grid: Charts & Alerts / Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Charts */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Chart 1: Revenue vs. Fuel cost */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-150">Fleet Dispatch Performance</h3>
                <p className="text-xs text-slate-400">Weekly tracking of generated revenue versus fuel expenditures</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>Last 7 Days</span>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0e82ec" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0e82ec" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area name="Revenue ($)" type="monotone" dataKey="revenue" stroke="#0e82ec" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                  <Area name="Fuel Cost ($)" type="monotone" dataKey="fuel" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorFuel)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-150 mb-3">Operator Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button 
                onClick={() => handleQuickAction('create')}
                className="p-3.5 rounded-lg border border-slate-105 hover:border-primary-300 dark:border-slate-800/80 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex flex-col items-center gap-2 hover:shadow-soft-sm transition-all text-center group"
              >
                <PlusCircle className="w-5 h-5 text-primary-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Create Load</span>
              </button>
              <button 
                onClick={() => handleQuickAction('route')}
                className="p-3.5 rounded-lg border border-slate-105 hover:border-primary-300 dark:border-slate-800/80 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex flex-col items-center gap-2 hover:shadow-soft-sm transition-all text-center group"
              >
                <Map className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Plan Route</span>
              </button>
              <button 
                onClick={() => handleQuickAction('report')}
                className="p-3.5 rounded-lg border border-slate-105 hover:border-primary-300 dark:border-slate-800/80 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex flex-col items-center gap-2 hover:shadow-soft-sm transition-all text-center group"
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reports Sheet</span>
              </button>
              <button 
                onClick={() => handleQuickAction('maint')}
                className="p-3.5 rounded-lg border border-slate-105 hover:border-primary-300 dark:border-slate-800/80 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex flex-col items-center gap-2 hover:shadow-soft-sm transition-all text-center group"
              >
                <Wrench className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Schedule Service</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Alerts ticker & Today's dispatch timeline */}
        <div className="flex flex-col gap-6">
          {/* Active Alerts */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md flex-1 flex flex-col">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-150 mb-3 flex items-center justify-between">
              <span>Active Notifications</span>
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-650 text-[10px] font-bold dark:bg-red-950/30 dark:text-red-400">
                {activeAlerts.length}
              </span>
            </h3>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] flex-1 pr-1">
              {activeAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mb-2 opacity-80" />
                  <p className="text-xs text-slate-400">Fleet operations running smoothly. No active alerts reported.</p>
                </div>
              ) : (
                activeAlerts.map(alert => (
                  <div 
                    key={alert.id}
                    className={`p-3 rounded-lg border flex flex-col gap-1 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/20 ${getAlertSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold leading-tight">{alert.title}</span>
                      <span className="text-[9px] uppercase tracking-wider font-semibold font-mono opacity-80">{alert.severity}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90">{alert.description}</p>
                    <div className="flex justify-between items-center text-[9px] mt-1 opacity-70">
                      <span>Vehicle: {alert.vehicle_number || 'N/A'}</span>
                      <span>{new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Trips Feed */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-150 mb-3">Recent Trips</h3>
            <div className="flex flex-col gap-3">
              {trips.slice(0, 3).map(trip => (
                <div 
                  key={trip.id}
                  onClick={() => navigate('/loads')}
                  className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-800/20 hover:bg-primary-50 dark:hover:bg-primary-950/10 cursor-pointer flex justify-between items-center transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{trip.customer}</p>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{trip.pickup} → {trip.destination}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      trip.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400' :
                      trip.status === 'Problem' ? 'bg-red-100 text-red-805 dark:bg-red-950/20 dark:text-red-400' :
                      trip.status === 'In Transit' ? 'bg-blue-105 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400' :
                      'bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400'
                    }`}>
                      {trip.status}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 inline text-slate-350 dark:text-slate-650 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

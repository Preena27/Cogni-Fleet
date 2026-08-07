import React, { useState } from 'react';
import { useAppContext } from '../App';
import { useSettings } from '../contexts/SettingsContext';
import { 
  TrendingUp, 
  Download, 
  Calendar, 
  BarChart2, 
  PieChart as PieIcon, 
  Users,
  Award
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

export default function ReportsModule() {
  const { trips, vehicles, drivers, addToast } = useAppContext();
  const { settings } = useSettings();
  const isMiles = settings.distance_unit === 'Miles';
  const volUnit = isMiles ? 'Gallons' : 'Liters';
  const distUnit = isMiles ? '100 mi' : '100 km';
  const consumptionMultiplier = isMiles ? 0.425144 : 1;
  const [reportRange, setReportRange] = useState<string>('Monthly');

  // 1. Calculate Pie Chart Data for Fleet Utilization
  const availableCount = vehicles.filter(v => v.availability === 'Available').length;
  const dutyCount = vehicles.filter(v => v.availability === 'On Duty').length;
  const maintenanceCount = vehicles.filter(v => v.availability === 'Maintenance').length;

  const handleExport = (format: string) => {
    let fileContent = '';
    let filename = `CogniFleet_${reportRange}_Report.${format.toLowerCase()}`;

    if (format === 'CSV') {
      fileContent = "Section,Metric,Value\n";
      fileContent += `Fleet Utilization,Available,${availableCount}\n`;
      fileContent += `Fleet Utilization,Active Duty,${dutyCount}\n`;
      fileContent += `Fleet Utilization,Maintenance,${maintenanceCount}\n\n`;

      fileContent += "Driver Operator,Violations,Average Rating,Performance Index\n";
      drivers.forEach(d => {
        fileContent += `"${d.name}",${d.violations},${d.rating},${d.performance}%\n`;
      });
    } else {
      fileContent = `
==================================================
              COGNIFLEET OPERATIONAL REPORT
==================================================
Report Scope:  ${reportRange} Analysis
Generated At:  ${new Date().toLocaleString()}
--------------------------------------------------
FLEET UTILIZATION:
- Available:    ${availableCount} vehicles
- Active Duty:  ${dutyCount} vehicles
- Maintenance:  ${maintenanceCount} vehicles
--------------------------------------------------
DRIVER PERFORMANCE INDEX:
${drivers.map(d => `- ${d.name}: Rating: ${d.rating.toFixed(1)}/5.0, Violations: ${d.violations}, Score: ${d.performance}%`).join('\n')}
==================================================
`;
      if (format === 'PDF') {
        filename = `CogniFleet_${reportRange}_Report.txt`;
      }
    }

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast("Report Generated", `Downloaded ${filename} package.`, "success");
  };

  const fleetUtilizationData = [
    { name: 'Available', value: availableCount, color: '#10b981' },
    { name: 'Active Duty', value: dutyCount, color: '#3b82f6' },
    { name: 'Maintenance', value: maintenanceCount, color: '#f97316' },
  ].filter(item => item.value > 0); // avoid empty cells

  // If database is empty or has zero assets, provide clean mock defaults
  const pieData = fleetUtilizationData.length > 0 ? fleetUtilizationData : [
    { name: 'Available', value: 4, color: '#10b981' },
    { name: 'Active Duty', value: 2, color: '#3b82f6' },
    { name: 'Maintenance', value: 1, color: '#f97316' }
  ];

  // 2. Prepare Fuel Consumption Bar Chart
  const fuelConsumptionData = vehicles.map(v => {
    // Generate simulated average fuel consumption (liters/100km)
    // Reefer/Semi consume more, box trucks less
    const baseConsumption = v.type === 'Semi-Truck' ? 32 : v.type === 'Reefer' ? 35 : v.type === 'Flatbed' ? 28 : 18;
    // Lower health vehicle consumes slightly more
    const actualConsumption = (baseConsumption + (100 - v.health) * 0.15) * consumptionMultiplier;
    return {
      name: v.vehicle_number,
      consumption: parseFloat(actualConsumption.toFixed(1))
    };
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Configuration Header */}
      <section className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-soft-sm gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-650 dark:text-slate-350">Report Time Period:</span>
          <div className="flex bg-slate-100 dark:bg-slate-850 rounded-lg p-0.5 border">
            {['Weekly', 'Monthly', 'Yearly'].map(range => (
              <button
                key={range}
                onClick={() => setReportRange(range)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                  reportRange === range 
                    ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-soft-sm' 
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleExport('CSV')}
            className="px-3 py-1.5 border hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold shadow-soft-sm flex items-center gap-1 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button 
            onClick={() => handleExport('Excel')}
            className="px-3 py-1.5 border hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold shadow-soft-sm flex items-center gap-1 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
          <button 
            onClick={() => handleExport('PDF')}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-750 text-white rounded-lg text-xs font-bold shadow-soft-sm flex items-center gap-1 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </section>

      {/* Grid: Pie Chart (utilization) + Bar Chart (fuel efficiency) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Asset Utilization */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md flex flex-col items-center">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-150 self-start mb-4 flex items-center gap-1.5">
            <PieIcon className="w-4 h-4 text-primary-500" />
            <span>Active Fleet Utilization Share</span>
          </h3>
          <div className="h-64 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fuel Consumption Stats */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-150 mb-4 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-orange-500" />
            <span>Fuel Consumption Index ({volUnit}/{distUnit})</span>
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fuelConsumptionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip />
                <Bar name={`${volUnit} per ${distUnit}`} dataKey="consumption" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Driver Scorecard Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md p-5">
        <h3 className="font-bold text-sm text-slate-850 dark:text-slate-150 mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          <span>Operator Safety & Performance Scorecard</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5">Driver Operator</th>
                <th className="py-2.5 text-center">Safety Violation Records</th>
                <th className="py-2.5 text-center">Average Operator Rating</th>
                <th className="py-2.5 text-right">Performance Efficiency Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-850/80">
              {drivers.map(driver => (
                <tr key={driver.id} className="text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/10">
                  <td className="py-3 font-bold text-slate-800 dark:text-slate-150">{driver.name}</td>
                  <td className="py-3 text-center">
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      driver.violations > 0 ? 'bg-red-50 text-red-700 dark:bg-red-950/20' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {driver.violations} Violations
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{driver.rating.toFixed(1)} / 5.0</span>
                  </td>
                  <td className="py-3 text-right font-extrabold text-emerald-500">{driver.performance}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

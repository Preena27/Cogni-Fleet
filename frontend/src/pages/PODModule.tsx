import React from 'react';
import { useAppContext } from '../App';
import { 
  ClipboardCheck, 
  Check, 
  X, 
  Download, 
  FileText,
  Clock,
  Trash2
} from 'lucide-react';

export default function PODModule() {
  const { pods, trips, drivers, vehicles, refreshData, addToast, secureFetch } = useAppContext();

  const handleApprove = async (podId: number) => {
    try {
      const res = await secureFetch(`/api/pods/${podId}?status=Approved`, {
        method: 'PUT'
      });
      if (res.ok) {
        addToast("POD Verified", "Proof of delivery approved. Trip transitioned to Completed.", "success");
        refreshData('pods');
        refreshData('trips');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (podId: number) => {
    try {
      const res = await secureFetch(`/api/pods/${podId}?status=Rejected`, {
        method: 'PUT'
      });
      if (res.ok) {
        addToast("POD Rejected", "Proof of delivery flagged as Rejected.", "warning");
        refreshData('pods');
        refreshData('trips');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestReupload = async (podId: number) => {
    try {
      const res = await secureFetch(`/api/pods/${podId}?status=Re-upload Requested`, {
        method: 'PUT'
      });
      if (res.ok) {
        addToast("Re-upload Requested", "Flagged: Re-upload requested from driver operator.", "info");
        refreshData('pods');
        refreshData('trips');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePOD = async (podId: number) => {
    try {
      const res = await secureFetch(`/api/pods/${podId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addToast("POD Deleted", "Proof of delivery record removed from the queue.", "warning");
        refreshData('pods');
        refreshData('trips');
      } else {
        const data = await res.json().catch(() => null);
        addToast("Delete Failed", data?.detail || 'Unable to delete the POD record.', "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Delete Failed", "Unable to submit the POD delete request.", "error");
    }
  };

  const handleDownloadPODReport = () => {
    let csv = "POD ID,Trip ID,Customer,Status,Submitted At,Barcode,QR Code\n";
    pods.forEach(pod => {
      const linkedTrip = trips.find(t => t.id === pod.trip_id);
      csv += `${pod.id},${pod.trip_id},"${linkedTrip?.customer || 'Unknown'}",${pod.status},"${new Date(pod.submitted_at).toLocaleString()}",${pod.barcode || 'N/A'},${pod.qr_code || 'N/A'}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `POD_Verification_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    addToast("Report Generated", "CSV report of Proof of Delivery records downloaded.", "success");
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400';
      case 'Rejected': return 'bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400';
      case 'Re-upload Requested': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400';
      default: return 'bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400';
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Overview stats */}
      <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-soft-sm text-xs flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="font-bold text-sm text-slate-855 dark:text-slate-150">Verification Queue</h3>
          <p className="text-slate-400">Review signatures and cargo photos uploaded by active delivery operators.</p>
        </div>
        <div className="flex items-center gap-4 font-semibold">
          <div className="flex items-center gap-4 text-slate-650 dark:text-slate-350">
            <span>Pending: {pods.filter(p => p.status === 'Pending').length} docs</span>
            <span>Approved: {pods.filter(p => p.status === 'Approved').length} docs</span>
          </div>
          <button
            onClick={handleDownloadPODReport}
            className="px-3.5 py-2 bg-primary-600 hover:bg-primary-750 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-soft-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Generate POD Report
          </button>
        </div>
      </section>

      {/* Grid List of POD requests */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
        {pods.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 border py-16 text-center rounded-xl text-slate-450 text-xs border-slate-100 dark:border-slate-800">
            No Proof of Delivery (POD) items are currently in queue.
          </div>
        ) : (
          pods.map(pod => {
            const linkedTrip = trips.find(t => t.id === pod.trip_id);
            return (
              <div 
                key={pod.id}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-xl shadow-soft-md flex flex-col gap-4"
              >
                {/* Header */}
                <div className="flex justify-between items-start border-b pb-3 border-slate-100 dark:border-slate-800">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-150">
                      Trip #{pod.trip_id} • POD Record
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Customer: <span className="font-bold text-slate-655 dark:text-slate-300">{linkedTrip?.customer || 'Unknown'}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Destination: <span className="font-bold text-slate-655 dark:text-slate-300">{linkedTrip?.destination || 'Unknown'}</span>
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusStyle(pod.status)}`}>
                    {pod.status}
                  </span>
                </div>
                
                {/* Driver & Vehicle info */}
                <div className="flex flex-col text-[10px] text-slate-500 mt-1 gap-1">
                   <p>Driver: <span className="font-bold text-slate-700 dark:text-slate-300">{drivers.find(d => d.id === pod.driver_id)?.name || 'N/A'}</span></p>
                   <p>Vehicle: <span className="font-bold text-slate-700 dark:text-slate-300">{vehicles.find(v => v.id === pod.vehicle_id)?.vehicle_number || 'N/A'}</span></p>
                   <p>Location: <span className="font-bold text-slate-700 dark:text-slate-300">{pod.latitude ? `${pod.latitude.toFixed(4)}, ${pod.longitude?.toFixed(4)}` : 'N/A'}</span></p>
                </div>

                {/* Grid image attachments */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Signature block */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-slate-400 font-semibold uppercase">Operator Signature</span>
                    <div className="border rounded-lg bg-slate-50 dark:bg-slate-800/20 h-28 flex items-center justify-center p-2.5 overflow-hidden border-slate-150 dark:border-slate-800">
                      {pod.signature_path ? (
                        <img 
                          src={pod.signature_path} 
                          alt="Driver Signature" 
                          className="object-contain max-h-full dark:invert" 
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400">Signature not uploaded</span>
                      )}
                    </div>
                  </div>

                  {/* Cargo photo block */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-slate-400 font-semibold uppercase">Cargo Delivery Photo</span>
                    <div className="border rounded-lg bg-slate-50 dark:bg-slate-800/20 h-28 flex items-center justify-center overflow-hidden border-slate-150 dark:border-slate-800">
                      {pod.photo_path ? (
                        <img 
                          src={pod.photo_path} 
                          alt="Delivery Proof" 
                          className="object-cover w-full h-full hover:scale-105 transition-transform" 
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400">Cargo photo missing</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Additional barcodes */}
                <div className="flex justify-between items-center text-[10px] text-slate-455 border-t pt-3 border-slate-100 dark:border-slate-800">
                  <span>Barcode ID: {pod.barcode || 'N/A'}</span>
                  <span>Submitted: {new Date(pod.submitted_at).toLocaleDateString()}</span>
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-2 mt-1 flex-wrap">
                  <button 
                    onClick={() => handleDeletePOD(pod.id)}
                    className="px-2.5 py-1.5 border hover:bg-slate-50 dark:hover:bg-slate-800/20 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold shadow-soft-sm flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                  {pod.status !== 'Rejected' && (
                    <button 
                      onClick={() => handleReject(pod.id)}
                      className="px-2.5 py-1.5 border hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold shadow-soft-sm flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  )}
                  {pod.status !== 'Approved' && (
                    <button 
                      onClick={() => handleApprove(pod.id)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-soft-sm flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Verify & Approve
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

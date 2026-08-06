import React, { useState } from 'react';
import { useAppContext } from '../App';
import { 
  FileText, 
  DollarSign, 
  Download, 
  Mail, 
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Invoice } from '../types';

export default function BillingModule() {
  const { invoices, refreshData, addToast, secureFetch } = useAppContext();
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSimulateDownload = (invoiceNum: string) => {
    const inv = invoices.find(i => i.invoice_number === invoiceNum);
    if (!inv) return;

    const invoiceContent = `
========================================
INVOICE: ${inv.invoice_number}
========================================
Customer: ${inv.customer}
Date: ${new Date(inv.created_at).toLocaleDateString()}
Status: ${inv.status}
----------------------------------------
Subtotal: $${inv.subtotal.toFixed(2)}
Tax (18%): $${inv.tax.toFixed(2)}
Discount: $${inv.discount.toFixed(2)}
----------------------------------------
TOTAL DUE: $${inv.total.toFixed(2)}
========================================
Thank you for your business!
`;

    const blob = new Blob([invoiceContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${inv.invoice_number}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast("Invoice Downloaded", `Saved ${invoiceNum}.txt package.`, "success");
  };

  const handleSimulateEmail = (invoiceNum: string, customer: string) => {
    addToast("Invoice Dispatched", `Secure email containing payment link dispatched to billing@${customer.toLowerCase().replace(/\s+/g, '')}.com`, "info");
  };

  const updateInvoiceStatus = async (invoiceId: number, status: 'Paid' | 'Pending') => {
    try {
      const res = await secureFetch(`http://localhost:8000/api/invoices/${invoiceId}?status=${status}`, {
        method: 'PUT'
      });
      if (res.ok) {
        addToast("Billing Synchronized", `Invoice status updated to ${status}.`, "success");
        refreshData('invoices');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400';
      case 'Pending': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400';
      case 'Overdue': return 'bg-red-105 text-red-800 dark:bg-red-950/20 dark:text-red-400';
      default: return 'bg-slate-105 text-slate-800';
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesStatus = filterStatus === 'All' || inv.status === filterStatus;
    const matchesSearch = inv.customer.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((sum, inv) => sum + inv.total, 0);
  const totalPending = invoices.filter(i => i.status === 'Pending').reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* 3 Summary Billing Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Invoiced</span>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">${totalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Paid Receipts</span>
          <p className="text-2xl font-extrabold text-emerald-500">${totalPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Outstanding (Pending)</span>
          <p className="text-2xl font-extrabold text-amber-500">${totalPending.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
      </section>

      {/* Table & Filters Panel */}
      <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-md p-5 flex flex-col gap-4">
        {/* Filters Row */}
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input 
                type="text" placeholder="Search by customer or invoice number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Status</label>
            <select 
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent text-xs focus:outline-none"
            >
              <option value="All">All Invoices</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Invoices Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3">Invoice Number</th>
                <th className="py-3">Customer Client</th>
                <th className="py-3 text-right">Subtotal</th>
                <th className="py-3 text-right">Taxes (18% GST)</th>
                <th className="py-3 text-right">Invoice Total</th>
                <th className="py-3 text-center">Status</th>
                <th className="py-3 text-right">Billing Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-850/80">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-450">No billing invoices recorded.</td>
                </tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv.id} className="text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/10">
                    <td className="py-3.5 font-mono font-semibold">{inv.invoice_number}</td>
                    <td className="py-3.5 font-bold text-slate-800 dark:text-slate-150">{inv.customer}</td>
                    <td className="py-3.5 text-right">${inv.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="py-3.5 text-right text-slate-400">${inv.tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="py-3.5 text-right font-extrabold text-slate-800 dark:text-slate-100">${inv.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status === 'Pending' && (
                          <button 
                            onClick={() => updateInvoiceStatus(inv.id, 'Paid')}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 rounded text-[10px] font-bold"
                            title="Mark as Paid"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button 
                          onClick={() => handleSimulateDownload(inv.invoice_number)}
                          className="p-1 text-slate-450 hover:text-slate-700 dark:hover:text-slate-200"
                          title="Download PDF Ledger"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleSimulateEmail(inv.invoice_number, inv.customer)}
                          className="p-1 text-slate-450 hover:text-slate-700 dark:hover:text-slate-200"
                          title="Email Invoice to Client"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

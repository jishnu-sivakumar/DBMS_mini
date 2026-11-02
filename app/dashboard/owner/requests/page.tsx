'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Mail, Phone, X } from 'lucide-react';
import OwnerSubpageHeader from '@/components/OwnerSubpageHeader';

export default function OwnerPendingRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/bookings');
      const data = await res.json();
      if (data.success) setRequests((data.bookings || []).filter((b: any) => b.status === 'PENDING'));
      else setMessage({ type: 'error', text: data.error || 'Could not load requests' });
    } catch {
      setMessage({ type: 'error', text: 'Network error, please try again.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      // a database trigger error ("Double booking conflict: ...") is shown as-is
      setMessage(
        res.ok
          ? { type: 'success', text: `Request ${status.toLowerCase()}.` }
          : { type: 'error', text: data.error || 'Update failed' }
      );
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <OwnerSubpageHeader
        title="Pending Requests"
        subtitle="Tenants waiting for your decision. Approving runs the database trigger that blocks overlapping bookings."
      />

      {message && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-start justify-between gap-3 border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span className="flex items-start gap-2">
            {message.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            {message.text}
          </span>
          <button onClick={() => setMessage(null)} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
          <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No pending requests</h3>
          <p className="text-xs text-slate-500 mt-1">You are all caught up.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
            >
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900">{r.property_title}</h3>
                <p className="text-xs text-slate-500">{r.property_city}</p>
                <div className="text-xs text-slate-700">
                  <span className="font-semibold">{r.tenant_name}</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {r.tenant_email}
                    </span>
                    {r.tenant_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {r.tenant_phone}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  {r.start_date} &rarr; {r.end_date}
                </p>
                {r.special_requests && (
                  <p className="text-[11px] italic text-slate-500">&ldquo;{r.special_requests}&rdquo;</p>
                )}
              </div>

              <div className="md:text-right space-y-3 shrink-0">
                <div className="text-xl font-black text-slate-900">
                  ₹{Number(r.total_amount).toLocaleString('en-IN')}
                </div>
                <div className="flex gap-2 md:justify-end">
                  <button
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, 'APPROVED')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-xs transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, 'REJECTED')}
                    className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white font-semibold text-xs transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, ArrowLeft, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';

const statusStyle: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
  CANCELLED: 'bg-slate-200 text-slate-700',
  PENDING: 'bg-amber-100 text-amber-800',
};

export default function TenantDashboardPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [method, setMethod] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Record<string, any>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/bookings');
      const data = await res.json();
      if (data.success) setBookings(data.bookings || []);
      else setMessage({ type: 'error', text: data.error || 'Could not load bookings' });
    } catch (err) {
      console.error('Failed to load tenant bookings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (id: string) => {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      const data = await res.json();
      setMessage(
        res.ok
          ? { type: 'success', text: 'Booking cancelled.' }
          : { type: 'error', text: data.error || 'Could not cancel' }
      );
      load();
    } finally {
      setBusyId(null);
    }
  };

  const pay = async (id: string) => {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/bookings/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: method[id] || 'UPI' }),
      });
      const data = await res.json();
      setMessage(
        res.ok
          ? { type: 'success', text: `Payment successful. Reference ${data.transactionRef}` }
          : { type: 'error', text: data.error || 'Payment failed' }
      );
      load();
    } finally {
      setBusyId(null);
    }
  };

  const toggleHistory = async (id: string) => {
    if (history[id]) {
      setHistory((h) => {
        const { [id]: _drop, ...rest } = h;
        return rest;
      });
      return;
    }
    const res = await fetch(`/api/bookings/${id}`);
    const data = await res.json();
    if (data.success) setHistory((h) => ({ ...h, [id]: data }));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Bookings</h1>
          <p className="text-xs text-slate-500 mt-1">
            Your rental requests and their approval status. You only see your own bookings.
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-emerald-600 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Explore Properties</span>
        </Link>
      </div>

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

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-6 sm:p-8">
        <h2 className="text-base font-bold text-slate-900 mb-4">Your Booking Requests</h2>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            You have not requested any rental properties yet. Browse the semantic catalog to submit a request!
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{b.property_title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{b.property_city}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {b.start_date} to {b.end_date}
                    </span>
                  </div>
                </div>

                <div className="sm:text-right space-y-2">
                  <div className="text-sm font-black text-slate-900">
                    ₹{Number(b.total_amount).toLocaleString('en-IN')}
                  </div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      statusStyle[b.status] || statusStyle.PENDING
                    }`}
                  >
                    {b.status}
                  </span>
                  {b.payment_status === 'PAID' && (
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-teal-100 text-teal-800">
                        Paid
                      </span>
                    </div>
                  )}
                  {b.payment_status === 'REFUNDED' && (
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                        Refunded
                      </span>
                    </div>
                  )}
                  {b.status === 'APPROVED' && b.payment_status !== 'PAID' && (
                    <div className="flex items-center gap-2 sm:justify-end">
                      <select
                        value={method[b.id] || 'UPI'}
                        onChange={(e) => setMethod((m) => ({ ...m, [b.id]: e.target.value }))}
                        className="text-[11px] rounded-lg border border-slate-200 px-2 py-1 bg-white"
                      >
                        <option value="UPI">UPI</option>
                        <option value="CARD">Card</option>
                        <option value="NET_BANKING">Net banking</option>
                      </select>
                      <button
                        disabled={busyId === b.id}
                        onClick={() => pay(b.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-[11px] transition-colors disabled:opacity-50"
                      >
                        Pay ₹{Number(b.total_amount).toLocaleString('en-IN')}
                      </button>
                    </div>
                  )}
                  {(b.status === 'PENDING' || b.status === 'APPROVED') && (
                    <div>
                      <button
                        disabled={busyId === b.id}
                        onClick={() => cancel(b.id)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white font-semibold text-[11px] transition-colors disabled:opacity-50"
                      >
                        Cancel booking
                      </button>
                    </div>
                  )}
                  <div>
                    <button
                      onClick={() => toggleHistory(b.id)}
                      className="text-[11px] text-slate-500 hover:text-slate-900 underline"
                    >
                      {history[b.id] ? 'Hide history' : 'History'}
                    </button>
                  </div>
                  {history[b.id] && (
                    <ul className="text-[11px] text-slate-500 sm:text-right space-y-0.5">
                      {history[b.id].audit.map((a: any, i: number) => (
                        <li key={i}>
                          {a.old_status ? `${a.old_status} → ${a.new_status}` : `Created as ${a.new_status}`} ·{' '}
                          {new Date(a.changed_at).toLocaleString()}
                        </li>
                      ))}
                      {history[b.id].payments.map((p: any, i: number) => (
                        <li key={`p${i}`}>
                          Payment {p.status} via {p.method} · {p.transaction_ref}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

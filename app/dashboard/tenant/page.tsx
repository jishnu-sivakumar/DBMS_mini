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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

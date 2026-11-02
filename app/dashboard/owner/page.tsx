'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, CreditCard, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';

type Tab = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

const statusStyle: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
  CANCELLED: 'bg-slate-200 text-slate-700',
  PENDING: 'bg-amber-100 text-amber-800',
};

export default function OwnerDashboardPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/bookings');
      const data = await res.json();
      if (data.success) {
        setBookings(data.bookings || []);
        setAnalytics(data.analytics || null);
      } else {
        setMessage({ type: 'error', text: data.error || 'Could not load bookings' });
      }
    } catch (err) {
      console.error('Owner dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (bookingId: string, status: 'APPROVED' | 'REJECTED') => {
    setBusyId(bookingId);
    setMessage(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Booking ${status.toLowerCase()}.` });
      } else {
        // e.g. "Double booking conflict: ..." raised by trg_validate_booking_overlap
        setMessage({ type: 'error', text: data.error || 'Update failed' });
      }
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: `Network error: ${err.message}` });
    } finally {
      setBusyId(null);
    }
  };

  const count = (s: Tab) => (s === 'ALL' ? bookings.length : bookings.filter((b) => b.status === s).length);
  const visible = tab === 'ALL' ? bookings : bookings.filter((b) => b.status === tab);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Owner Portal</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review booking requests for your properties. Approving runs the PostgreSQL trigger{' '}
          <code>trg_validate_booking_overlap</code>.
        </p>
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

      {/* KPI cards from view_owner_analytics (GROUP BY + aggregates) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">My Properties</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">{analytics?.total_properties ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">view_owner_analytics</p>
        </div>
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Pending Requests</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">{count('PENDING')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting your decision</p>
        </div>
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Confirmed Bookings</span>
            <CheckCircle className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">{analytics?.confirmed_bookings ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Guarded by date-overlap trigger</p>
        </div>
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Confirmed Revenue</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">
            ₹{Number(analytics?.total_confirmed_revenue ?? 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">SUM of approved bookings</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-base font-bold text-slate-900">Booking Requests</h3>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl self-start">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label} <span className="text-slate-400">({count(t.key)})</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading bookings...</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">No bookings in this tab.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Property</th>
                  <th className="py-3 px-4">Tenant</th>
                  <th className="py-3 px-4">Rental Duration</th>
                  <th className="py-3 px-4">Total Rent</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{booking.property_title}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>{booking.tenant_name}</div>
                      <div className="text-[10px] text-slate-400">{booking.tenant_email}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {booking.start_date} &rarr; {booking.end_date}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      ₹{Number(booking.total_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          statusStyle[booking.status] || statusStyle.PENDING
                        }`}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {booking.status === 'PENDING' ? (
                        <>
                          <button
                            disabled={busyId === booking.id}
                            onClick={() => handleStatusChange(booking.id, 'APPROVED')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-[11px] transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            disabled={busyId === booking.id}
                            onClick={() => handleStatusChange(booking.id, 'REJECTED')}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white font-semibold text-[11px] transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

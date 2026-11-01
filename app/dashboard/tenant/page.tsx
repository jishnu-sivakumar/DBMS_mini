'use client';

import { useState, useEffect } from 'react';
import { Calendar, UserCheck, Clock, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TenantDashboardPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTenantBookings() {
      try {
        const res = await fetch('/api/bookings?role=TENANT');
        const data = await res.json();
        if (data.success) {
          setBookings(data.bookings || []);
        }
      } catch (err) {
        console.error('Failed to load tenant bookings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTenantBookings();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Scope Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div>
          <div className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 mb-1">
            Member 2 Scope (Teammate)
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Tenant Rental & Booking History</h1>
          <p className="text-xs text-slate-500 mt-1">
            Tracks current lease status, submitted requests, and confirmed bookings.
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

      {/* Bookings List */}
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
                      {new Date(b.start_date).toLocaleDateString()} to{' '}
                      {new Date(b.end_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="sm:text-right">
                  <div className="text-sm font-black text-slate-900">
                    ₹{Number(b.total_amount).toLocaleString('en-IN')}
                  </div>
                  <span
                    className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      b.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : b.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

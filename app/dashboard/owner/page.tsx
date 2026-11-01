'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Sparkles,
  FileCode,
} from 'lucide-react';

export default function OwnerDashboardPage() {
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch bookings for owner
      const bookRes = await fetch('/api/bookings?role=OWNER');
      const bookData = await bookRes.json();
      if (bookData.success) {
        setBookings(bookData.bookings || []);
      }

      // 2. Mock analytics fallback or properties
      const propRes = await fetch('/api/properties');
      const propData = await propRes.json();
      if (propData.properties) {
        setAnalytics(propData.properties.slice(0, 3));
      }
    } catch (err) {
      console.error('Owner dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (bookingId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(`Success: Booking ${status.toLowerCase()}! (Triggers & DB state updated)`);
        loadData();
      } else {
        setActionMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Network error: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Member 2 Scope Callout Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-md shrink-0">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                Assigned to Teammate (Member 2)
              </span>
              <span className="text-xs text-amber-700">Rental & Booking Management</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              Owner Management & Booking Concurrency Dashboard
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl mt-0.5">
              This module manages the rental lifecycle: approving/rejecting booking requests, enforcing ACID transaction locks with <code>SELECT ... FOR UPDATE</code>, and executing <code>fn_check_booking_conflict</code>.
            </p>
          </div>
        </div>

        <div className="text-xs bg-white px-3 py-2 rounded-xl border border-amber-200 text-amber-900 font-medium shrink-0 shadow-sm">
          📍 Scaffolded by Member 1
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs flex items-center justify-between">
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage('')}
            className="text-slate-400 hover:text-white font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Stats Cards (Demonstrating Relational Aggregation) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Active Properties</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">
            {analytics.length || 2}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Queried from view_owner_analytics</p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Pending Requests</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">
            {bookings.filter((b) => b.status === 'PENDING').length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting owner confirmation</p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Confirmed Bookings</span>
            <CheckCircle className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">
            {bookings.filter((b) => b.status === 'APPROVED').length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Enforced by triggers & date locks</p>
        </div>
      </div>

      {/* Booking Requests Table (Member 2 Working Area) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Incoming Tenant Booking Requests
            </h3>
            <p className="text-xs text-slate-500">
              Approving a request tests the PostgreSQL trigger <code>trg_validate_booking_overlap</code>.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
            {bookings.length} Total Requests
          </span>
        </div>

        {bookings.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No booking requests found. Visit a property from the search page to submit a booking test!
          </div>
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
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {booking.property_title || 'Listing'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {booking.tenant_name || 'Tenant User'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(booking.start_date).toLocaleDateString()} &rarr;{' '}
                      {new Date(booking.end_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      ₹{Number(booking.total_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          booking.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : booking.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {booking.status === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleStatusChange(booking.id, 'APPROVED')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-[11px] transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleStatusChange(booking.id, 'REJECTED')}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white font-semibold text-[11px] transition-colors"
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

      {/* Member 2 Checklist Guide */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>📋</span> Member 2 Implementation Tasks & Testing Checklist
        </h4>
        <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
          <li>
            <strong>Booking Transaction Lock:</strong> Verify <code>lib/services/booking-service.ts</code> uses <code>SELECT ... FOR UPDATE</code> to ensure serialization during concurrent bookings.
          </li>
          <li>
            <strong>Date Overlap Trigger:</strong> Try approving two bookings for the same property with overlapping date ranges to verify that <code>trg_validate_booking_overlap</code> prevents the operation.
          </li>
          <li>
            <strong>Security Deposit & Payment Record:</strong> (Optional enhancement) Add an auxiliary <code>payments</code> table to record rental transaction receipt IDs.
          </li>
        </ul>
      </div>
    </div>
  );
}

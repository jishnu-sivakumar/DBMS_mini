'use client';

import { useEffect, useState } from 'react';
import { Mail, Phone, CalendarCheck } from 'lucide-react';
import OwnerSubpageHeader from '@/components/OwnerSubpageHeader';

export default function OwnerConfirmedBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/bookings')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setBookings((d.bookings || []).filter((b: any) => b.status === 'APPROVED'));
        else setError(d.error || 'Could not load bookings');
      })
      .catch(() => setError('Network error, please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const stage = (b: any) => (b.end_date < today ? 'Completed' : b.start_date <= today ? 'Ongoing' : 'Upcoming');
  const stageStyle: Record<string, string> = {
    Upcoming: 'bg-sky-100 text-sky-800',
    Ongoing: 'bg-emerald-100 text-emerald-800',
    Completed: 'bg-slate-200 text-slate-700',
  };

  const sorted = [...bookings].sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <OwnerSubpageHeader
        title="Confirmed Bookings"
        subtitle="Approved bookings for your properties, in date order, with the tenant's contact details and payment status."
      />

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200 text-xs">{error}</div>
      )}

      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading bookings...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
          <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No confirmed bookings yet</h3>
          <p className="text-xs text-slate-500 mt-1">Approve a pending request and it will show up here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Tenant</th>
                <th className="py-3 px-4">Stay</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/60 transition-colors align-top">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{b.property_title}</div>
                    <div className="text-[10px] text-slate-400">{b.property_city}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    <div className="font-medium">{b.tenant_name}</div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Mail className="w-3 h-3" /> {b.tenant_email}
                    </div>
                    {b.tenant_phone && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Phone className="w-3 h-3" /> {b.tenant_phone}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                    {b.start_date} &rarr; {b.end_date}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${stageStyle[stage(b)]}`}>
                      {stage(b)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    ₹{Number(b.total_amount).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 font-semibold">
                    {b.payment_status === 'PAID' ? (
                      <span className="text-teal-700">Paid</span>
                    ) : (
                      <span className="text-amber-700">Awaiting payment</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

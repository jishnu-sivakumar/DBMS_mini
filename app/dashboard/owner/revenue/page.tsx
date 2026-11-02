'use client';

import { useEffect, useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import OwnerSubpageHeader from '@/components/OwnerSubpageHeader';

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export default function OwnerRevenuePage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/bookings')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setBookings((d.bookings || []).filter((b: any) => b.status === 'APPROVED'));
        else setError(d.error || 'Could not load revenue');
      })
      .catch(() => setError('Network error, please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const { total, collected, outstanding, perProperty } = useMemo(() => {
    let total = 0;
    let collected = 0;
    const map = new Map<string, { title: string; city: string; bookings: number; total: number; collected: number }>();
    for (const b of bookings) {
      const amount = Number(b.total_amount);
      const paid = b.payment_status === 'PAID';
      total += amount;
      if (paid) collected += amount;
      const row = map.get(b.property_id) ?? { title: b.property_title, city: b.property_city, bookings: 0, total: 0, collected: 0 };
      row.bookings += 1;
      row.total += amount;
      if (paid) row.collected += amount;
      map.set(b.property_id, row);
    }
    return {
      total,
      collected,
      outstanding: total - collected,
      perProperty: [...map.values()].sort((a, b) => b.total - a.total),
    };
  }, [bookings]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <OwnerSubpageHeader
        title="Confirmed Revenue"
        subtitle="Rent from approved bookings. Collected means the tenant has paid; outstanding is approved but not yet paid."
      />

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200 text-xs">{error}</div>
      )}

      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading revenue...</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
          <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No confirmed revenue yet</h3>
          <p className="text-xs text-slate-500 mt-1">Revenue appears once you approve a booking.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">Total confirmed</div>
              <div className="text-3xl font-black text-slate-900 mt-1">{inr(total)}</div>
              <p className="text-[11px] text-slate-400 mt-1">{bookings.length} approved bookings</p>
            </div>
            <div className="p-6 rounded-3xl bg-teal-50 border border-teal-200/70 shadow-sm">
              <div className="text-xs font-semibold text-teal-800">Collected (paid)</div>
              <div className="text-3xl font-black text-teal-900 mt-1">{inr(collected)}</div>
              <p className="text-[11px] text-teal-700/70 mt-1">Tenant payments received</p>
            </div>
            <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200/70 shadow-sm">
              <div className="text-xs font-semibold text-amber-800">Outstanding</div>
              <div className="text-3xl font-black text-amber-900 mt-1">{inr(outstanding)}</div>
              <p className="text-[11px] text-amber-700/70 mt-1">Approved, awaiting payment</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-x-auto">
            <div className="px-6 pt-5 text-sm font-bold text-slate-900">By property</div>
            <table className="w-full text-left text-xs mt-3">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-6">Property</th>
                  <th className="py-3 px-4">Bookings</th>
                  <th className="py-3 px-4">Confirmed</th>
                  <th className="py-3 px-4">Collected</th>
                  <th className="py-3 px-4">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {perProperty.map((p) => (
                  <tr key={p.title} className="hover:bg-slate-50/60">
                    <td className="py-3 px-6">
                      <div className="font-semibold text-slate-900">{p.title}</div>
                      <div className="text-[10px] text-slate-400">{p.city}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.bookings}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{inr(p.total)}</td>
                    <td className="py-3 px-4 text-teal-700 font-semibold">{inr(p.collected)}</td>
                    <td className="py-3 px-4 text-amber-700 font-semibold">{inr(p.total - p.collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-x-auto">
            <div className="px-6 pt-5 text-sm font-bold text-slate-900">Every confirmed booking</div>
            <table className="w-full text-left text-xs mt-3">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-6">Property</th>
                  <th className="py-3 px-4">Tenant</th>
                  <th className="py-3 px-4">Stay</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-6 font-semibold text-slate-900">{b.property_title}</td>
                    <td className="py-3 px-4 text-slate-600">{b.tenant_name}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {b.start_date} &rarr; {b.end_date}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{inr(Number(b.total_amount))}</td>
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
        </>
      )}
    </div>
  );
}

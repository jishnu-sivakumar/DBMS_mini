'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, MapPin, BedDouble, Bath, Ruler, Star, Building2 } from 'lucide-react';
import OwnerSubpageHeader from '@/components/OwnerSubpageHeader';

type OwnerProperty = {
  id: string;
  title: string;
  property_type: string;
  city: string;
  address: string;
  price_per_month: number;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';
  image_url?: string;
  created_at: string;
  total_requests: number;
  pending_requests: number;
  approved_bookings: number;
  avg_rating: number;
  review_count: number;
};

const statusStyle: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800',
  RENTED: 'bg-sky-100 text-sky-800',
  MAINTENANCE: 'bg-amber-100 text-amber-800',
};

export default function OwnerPropertiesPage() {
  const [properties, setProperties] = useState<OwnerProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/owner/properties')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProperties(d.properties);
        else setError(d.error || 'Could not load your properties');
      })
      .catch(() => setError('Network error, please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const available = properties.filter((p) => p.status === 'AVAILABLE').length;
  const pending = properties.reduce((sum, p) => sum + p.pending_requests, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <OwnerSubpageHeader
        title="My Properties"
        subtitle="Every listing you have published, with how many booking requests each one has received."
        action={
          <Link
            href="/properties/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors self-start"
          >
            <PlusCircle className="w-4 h-4" /> List another property
          </Link>
        }
      />

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200 text-xs">{error}</div>
      )}

      {!loading && properties.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            ['Total listings', properties.length],
            ['Available now', available],
            ['Pending requests', pending],
          ].map(([label, value]) => (
            <div key={label as string} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500">{label}</div>
              <div className="text-2xl font-black text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading your properties...</div>
      ) : properties.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">You have not listed any property yet</h3>
          <p className="text-xs text-slate-500 mt-1">Listings you publish will appear here.</p>
          <Link
            href="/properties/new"
            className="inline-block mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
          >
            List your first property
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="relative h-44 bg-slate-100">
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                )}
                <span
                  className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    statusStyle[p.status] || statusStyle.AVAILABLE
                  }`}
                >
                  {p.status}
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col gap-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 leading-snug">{p.title}</h3>
                  <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                    <MapPin className="w-3 h-3" /> {p.address}, {p.city}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <BedDouble className="w-3.5 h-3.5 text-slate-400" /> {p.bedrooms}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath className="w-3.5 h-3.5 text-slate-400" /> {p.bathrooms}
                  </span>
                  <span className="flex items-center gap-1">
                    <Ruler className="w-3.5 h-3.5 text-slate-400" /> {p.area_sqft} sqft
                  </span>
                  <span className="text-slate-400">{p.property_type}</span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="text-lg font-black text-slate-900">
                    ₹{p.price_per_month.toLocaleString('en-IN')}
                    <span className="text-[11px] font-medium text-slate-400"> / month</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                    {p.review_count > 0 ? `${p.avg_rating} (${p.review_count})` : 'No reviews'}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 py-2">
                    <div className="text-sm font-black text-slate-900">{p.total_requests}</div>
                    <div className="text-[10px] text-slate-500">Requests</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 py-2">
                    <div className="text-sm font-black text-amber-800">{p.pending_requests}</div>
                    <div className="text-[10px] text-amber-700">Pending</div>
                  </div>
                  <div className="rounded-xl bg-emerald-50 py-2">
                    <div className="text-sm font-black text-emerald-800">{p.approved_bookings}</div>
                    <div className="text-[10px] text-emerald-700">Approved</div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400">
                  Listed on {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

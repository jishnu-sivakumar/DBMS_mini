'use client';

import { useState } from 'react';
import { X, Bed, Bath, Maximize2, MapPin, Calendar, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { Property } from '@/lib/services/property-service';

interface PropertyModalProps {
  property: Property | null;
  onClose: () => void;
}

export default function PropertyModal({ property, onClose }: PropertyModalProps) {
  const [startDate, setStartDate] = useState('2026-11-15');
  const [endDate, setEndDate] = useState('2026-12-15');
  const [specialRequests, setSpecialRequests] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  if (!property) return null;

  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(property.price_per_month);

  const formattedDeposit = property.security_deposit
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(property.security_deposit)
    : 'None';

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingLoading(true);
    setBookingStatus({ type: null, message: '' });

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: property.id,
          start_date: startDate,
          end_date: endDate,
          special_requests: specialRequests,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBookingStatus({
          type: 'success',
          message: data.message || 'Booking request submitted successfully!',
        });
      } else {
        setBookingStatus({
          type: 'error',
          message: data.error || 'Failed to submit booking',
        });
      }
    } catch (err: any) {
      setBookingStatus({
        type: 'error',
        message: err.message || 'Network error occurred',
      });
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-y-auto border border-slate-100 flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Image */}
        <div className="relative h-64 sm:h-72 w-full bg-slate-100 shrink-0">
          <img
            src={property.image_url || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'}
            alt={property.title}
            className="w-full h-full object-cover"
          />
          {property.similarity_score && (
            <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-xl bg-slate-900/90 text-emerald-400 text-xs font-semibold backdrop-blur-md border border-emerald-500/30 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Semantic Similarity: {property.similarity_score}%</span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="inline-block px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold mb-2">
                {property.property_type} &bull; {property.status}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 leading-snug">
                {property.title}
              </h2>
              <p className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{property.address}, {property.city}</span>
              </p>
            </div>
            <div className="sm:text-right">
              <div className="text-2xl font-black text-slate-900">{formattedPrice}</div>
              <div className="text-xs text-slate-500">Rent / month</div>
              <div className="text-xs text-slate-400 mt-1">Deposit: {formattedDeposit}</div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
            <div>
              <div className="text-xs text-slate-500">Bedrooms</div>
              <div className="text-base font-bold text-slate-800 flex items-center justify-center gap-1 mt-0.5">
                <Bed className="w-4 h-4 text-emerald-600" />
                <span>{property.bedrooms} BHK</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Bathrooms</div>
              <div className="text-base font-bold text-slate-800 flex items-center justify-center gap-1 mt-0.5">
                <Bath className="w-4 h-4 text-emerald-600" />
                <span>{property.bathrooms} Baths</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Carpet Area</div>
              <div className="text-base font-bold text-slate-800 flex items-center justify-center gap-1 mt-0.5">
                <Maximize2 className="w-4 h-4 text-emerald-600" />
                <span>{property.area_sqft} sq.ft</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">About this Property</h4>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {property.description}
            </p>
          </div>

          {/* Amenities */}
          {property.amenities && property.amenities.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Amenities & Highlights</h4>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-100"
                  >
                    ✓ {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Booking Request Form (Member 2 Module Integration) */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">
                  Request to Book (Member 2 Module)
                </h4>
                <p className="text-xs text-slate-500">
                  Tests the ACID transaction & date-conflict stored procedure in PostgreSQL
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                Teammate Feature
              </span>
            </div>

            <form onSubmit={handleBooking} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Special Notes / Move-in preference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vegetarian preferred, weekend move-in, parking needed..."
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {bookingStatus.type && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    bookingStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {bookingStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{bookingStatus.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={bookingLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {bookingLoading ? 'Checking Availability & Locking...' : 'Submit Rental Booking Request'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

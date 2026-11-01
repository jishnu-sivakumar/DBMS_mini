'use client';

import { MapPin, Bed, Bath, Maximize2, Star, Sparkles, Phone, ArrowUpRight } from 'lucide-react';
import { Property } from '@/lib/services/property-service';

interface PropertyCardProps {
  property: Property;
  onSelect: (property: Property) => void;
}

export default function PropertyCard({ property, onSelect }: PropertyCardProps) {
  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(property.price_per_month);

  const hasScore = property.similarity_score !== undefined && property.similarity_score > 0;

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 overflow-hidden flex flex-col">
      {/* Property Image & Badges */}
      <div className="relative h-52 w-full overflow-hidden bg-slate-100">
        <img
          src={property.image_url || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Semantic Match Score Badge */}
        {hasScore && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 text-emerald-400 text-xs font-semibold backdrop-blur-md shadow-md border border-emerald-500/30">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
            <span>{property.similarity_score}% Match</span>
          </div>
        )}

        {/* Property Type Badge */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-white/90 text-slate-800 text-xs font-medium backdrop-blur-md shadow-sm">
          {property.property_type}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Price & Rating */}
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <span className="text-xl font-bold text-slate-900">{formattedPrice}</span>
              <span className="text-xs text-slate-500 font-medium"> /month</span>
            </div>
            {property.avg_rating && property.avg_rating > 0 ? (
              <div className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                <span>{property.avg_rating}</span>
                {property.review_count ? (
                  <span className="text-amber-600/70">({property.review_count})</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-slate-900 text-base leading-snug line-clamp-1 mb-1 group-hover:text-emerald-700 transition-colors">
            {property.title}
          </h3>

          {/* Location */}
          <p className="flex items-center gap-1 text-xs text-slate-500 mb-4 line-clamp-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{property.address}, {property.city}</span>
          </p>

          {/* Property Stats */}
          <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-slate-50 text-xs text-slate-600 mb-4">
            <div className="flex items-center gap-1.5">
              <Bed className="w-3.5 h-3.5 text-slate-400" />
              <span>{property.bedrooms} Beds</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bath className="w-3.5 h-3.5 text-slate-400" />
              <span>{property.bathrooms} Baths</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{property.area_sqft} sqft</span>
            </div>
          </div>

          {/* Amenities Pills */}
          {property.amenities && property.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {property.amenities.slice(0, 3).map((amenity, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium"
                >
                  {amenity}
                </span>
              ))}
              {property.amenities.length > 3 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium">
                  +{property.amenities.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer / CTA */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Listed by <span className="font-medium text-slate-700">{property.owner_name || 'Owner'}</span>
          </div>
          <button
            onClick={() => onSelect(property)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white text-xs font-semibold transition-colors"
          >
            <span>Details</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

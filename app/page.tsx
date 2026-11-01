'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  SlidersHorizontal,
  MapPin,
  RefreshCw,
  Info,
  CheckCircle,
} from 'lucide-react';
import PropertyCard from '@/components/PropertyCard';
import PropertyModal from '@/components/PropertyModal';
import { Property } from '@/lib/services/property-service';

export default function HomePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedBedrooms, setSelectedBedrooms] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [activeQueryPrompt, setActiveQueryPrompt] = useState<string | null>(null);

  // Suggested prompts showcasing vector similarity
  const promptSuggestions = [
    'quiet 2BHK near tech park pet friendly under 25k',
    'luxury penthouse with swimming pool and gym',
    'budget 1BHK student apartment near metro',
    'spacious 3BHK villa with private garden',
  ];

  const fetchProperties = async (query = searchQuery, city = selectedCity, beds = selectedBedrooms, max = maxPrice) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.append('q', query.trim());
      if (city && city !== 'All') params.append('city', city);
      if (beds !== '') params.append('bedrooms', String(beds));
      if (max !== '') params.append('maxPrice', String(max));

      const endpoint = query.trim() ? `/api/search?${params.toString()}` : `/api/properties?${params.toString()}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success) {
        setProperties(data.properties || []);
      }
    } catch (err) {
      console.error('Failed to load listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [selectedCity, selectedBedrooms, maxPrice]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQueryPrompt(searchQuery);
    fetchProperties(searchQuery);
  };

  const handlePromptClick = (prompt: string) => {
    setSearchQuery(prompt);
    setActiveQueryPrompt(prompt);
    fetchProperties(prompt);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedBedrooms('');
    setMaxPrice('');
    setActiveQueryPrompt(null);
    fetchProperties('', '', '', '');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>PostgreSQL + pgvector Semantic Search</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
          Find your next home with <br />
          <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
            natural language intent
          </span>
        </h1>
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
          Skip rigid checkbox filters. Describe what you want in plain words and our vector engine calculates cosine similarity against real-estate embeddings stored in PostgreSQL.
        </p>

        {/* Semantic Search Box */}
        <form onSubmit={handleSearchSubmit} className="relative mt-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-2 p-2 bg-white rounded-2xl shadow-lg border border-slate-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
            <Search className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Try "quiet 2BHK near tech park pet-friendly under 25k"...'
              className="w-full px-2 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-emerald-600 text-xs font-semibold transition-all shrink-0 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Search</span>
            </button>
          </div>
        </form>

        {/* Prompt Suggestions */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <span className="text-xs text-slate-400 font-medium">Try asking:</span>
          {promptSuggestions.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handlePromptClick(prompt)}
              className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-600 border border-slate-200/80 transition-all cursor-pointer text-left"
            >
              ✨ {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Relational Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mr-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
            <span>Hybrid SQL Filters:</span>
          </div>

          {/* City Filter */}
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">All Cities</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Pune">Pune</option>
            <option value="Hyderabad">Hyderabad</option>
          </select>

          {/* Bedrooms Filter */}
          <select
            value={selectedBedrooms}
            onChange={(e) => setSelectedBedrooms(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Any Bedrooms</option>
            <option value="1">1 BHK</option>
            <option value="2">2 BHK</option>
            <option value="3">3 BHK</option>
          </select>

          {/* Max Price Filter */}
          <select
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Max Budget</option>
            <option value="20000">Under ₹20,000</option>
            <option value="35000">Under ₹35,000</option>
            <option value="50000">Under ₹50,000</option>
            <option value="100000">Under ₹1,00,000</option>
          </select>
        </div>

        {/* Reset */}
        {(searchQuery || selectedCity || selectedBedrooms !== '' || maxPrice !== '') && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-slate-500 hover:text-rose-600 font-medium flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {activeQueryPrompt ? 'Semantic Search Matches' : 'Available Rental Properties'}
          </h2>
          <p className="text-xs text-slate-500">
            {loading ? 'Executing vector similarity query...' : `Showing ${properties.length} listings`}
          </p>
        </div>
        {activeQueryPrompt && (
          <div className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ranked by Cosine Similarity</span>
          </div>
        )}
      </div>

      {/* Property Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-96 rounded-2xl bg-white border border-slate-200/60 p-4 animate-pulse flex flex-col justify-between"
            >
              <div className="h-48 bg-slate-200 rounded-xl" />
              <div className="space-y-2 mt-4">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
              <div className="h-10 bg-slate-100 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
          <Info className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No properties matched your criteria</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your natural language query or removing filters to broaden the vector cosine range.
          </p>
          <button
            onClick={handleClearFilters}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            View All Properties
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onSelect={setSelectedProperty}
            />
          ))}
        </div>
      )}

      {/* Property Details & Booking Modal */}
      <PropertyModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
      />
    </div>
  );
}

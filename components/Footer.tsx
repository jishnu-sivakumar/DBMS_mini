import { Database, GitBranch, Layers } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                PropFind &bull; DBMS Level 3 Mini-Project
              </p>
              <p className="text-xs text-slate-500">
                Option 2: PostgreSQL Relational Schema + pgvector HNSW Cosine Similarity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Member 1: Vector Search & Schema Core</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Member 2: Bookings & Concurrency Control</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

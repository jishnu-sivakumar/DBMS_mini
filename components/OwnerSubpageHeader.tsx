import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/** Title bar shared by the Owner Portal detail pages, with a link back to the dashboard. */
export default function OwnerSubpageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/owner"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Owner Portal
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 mt-1 max-w-2xl">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

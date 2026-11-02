'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, PlusCircle, Building2, UserCheck, Sparkles, LogIn, LogOut } from 'lucide-react';

type SessionUser = { userId: string; name: string; role: 'OWNER' | 'TENANT' | 'ADMIN' } | null;

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser>(null);
  const [ready, setReady] = useState(false);

  // Re-read the session on every navigation so login/logout shows up immediately
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, [pathname]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const isOwner = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const isTenant = user?.role === 'TENANT' || user?.role === 'ADMIN';

  const navLinks = [
    { href: '/', label: 'Semantic Search', icon: Compass, show: true },
    { href: '/properties/new', label: 'List Property', icon: PlusCircle, show: isOwner },
    { href: '/dashboard/owner', label: 'Owner Portal', icon: Building2, show: isOwner },
    { href: '/dashboard/tenant', label: 'My Bookings', icon: UserCheck, show: isTenant },
  ].filter((l) => l.show);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                PropFind
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                pgvector + SQL
              </span>
            </div>
          </Link>

          {/* Nav Items */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{link.label}</span>
                </Link>
              );
            })}

            {ready &&
              (user ? (
                <div className="flex items-center gap-2 ml-2 pl-3 border-l border-slate-200">
                  <div className="hidden sm:block text-right leading-tight">
                    <div className="text-xs font-semibold text-slate-900">{user.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
                      {user.role}
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden md:inline">Log out</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 ml-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-emerald-600 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log in</span>
                </Link>
              ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

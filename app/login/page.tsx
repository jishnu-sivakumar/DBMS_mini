'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LogIn, AlertTriangle } from 'lucide-react';

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      const fallback = data.role === 'OWNER' ? '/dashboard/owner' : '/dashboard/tenant';
      // full reload so the navbar and middleware see the new cookie
      window.location.href = params.get('next') || fallback;
    } catch {
      setError('Network error, please try again.');
    } finally {
      setLoading(false);
    }
  };

  const input =
    'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LogIn className="w-6 h-6 text-emerald-600" /> Log in
          </h1>
          <p className="text-xs text-slate-500 mt-1">Owners manage listings; tenants book and pay.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          <button
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Log in'}
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center">
          No account?{' '}
          <Link href="/register" className="text-emerald-700 font-semibold hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

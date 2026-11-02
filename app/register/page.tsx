'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserPlus, AlertTriangle } from 'lucide-react';

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', role: 'TENANT' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }
      window.location.href = data.role === 'OWNER' ? '/dashboard/owner' : '/dashboard/tenant';
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
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-emerald-600" /> Create account
        </h1>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Full name</label>
            <input required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className={input} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} className={input} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Phone (optional)</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={input} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Password (min 8 chars)</label>
            <input type="password" required minLength={8} value={form.password} onChange={(e) => set('password', e.target.value)} className={input} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">I am a</label>
            <div className="grid grid-cols-2 gap-2">
              {['TENANT', 'OWNER'].map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => set('role', r)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    form.role === r
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {r === 'TENANT' ? 'Tenant' : 'Owner'}
                </button>
              ))}
            </div>
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
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center">
          Already registered?{' '}
          <Link href="/login" className="text-emerald-700 font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

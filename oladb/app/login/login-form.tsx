'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); const form = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) }); const payload = await response.json(); setBusy(false); if (!response.ok) return setError(payload.error || 'Unable to sign in.'); router.push('/dashboard'); router.refresh(); }
  return <form onSubmit={submit} className="mt-8 space-y-4"><label className="block text-sm font-medium">Administrator email<input required name="email" type="email" autoComplete="email" /></label><label className="block text-sm font-medium">Password<input required name="password" type="password" minLength={8} autoComplete="current-password" /></label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<button disabled={busy} className="w-full bg-ink text-white hover:bg-brand disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in securely'}</button></form>;
}

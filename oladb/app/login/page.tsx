import { redirect } from 'next/navigation';
import { hasAdministratorSession } from '@/lib/auth';
import LoginForm from './login-form';

export default async function LoginPage() {
  if (await hasAdministratorSession()) redirect('/dashboard');
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dbe7ff,_transparent_35%),linear-gradient(135deg,_#f8fbff,_#eef3fb)] px-5 py-12"><div className="mx-auto max-w-md rounded-3xl border border-white bg-white/90 p-8 shadow-2xl shadow-slate-300/30"><p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Private control plane</p><h1 className="mt-3 text-4xl font-black tracking-tight">OlaDB</h1><p className="mt-3 text-sm leading-6 text-slate-600">Single-administrator access for your personal website databases. No public registration.</p><LoginForm /></div></main>;
}

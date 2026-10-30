import { redirect } from 'next/navigation';
import { hasAdministratorSession } from '@/lib/auth';

export default async function Home() { redirect((await hasAdministratorSession()) ? '/dashboard' : '/login'); }

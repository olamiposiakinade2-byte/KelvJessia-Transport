import { requireAdministrator } from '@/lib/auth';
import DashboardClient from './dashboard-client';

export default async function DashboardPage() { await requireAdministrator(); return <DashboardClient />; }

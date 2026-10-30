import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'OlaDB', description: 'Private database management for personal projects' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

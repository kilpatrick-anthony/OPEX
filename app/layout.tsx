import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OAKBERRY OPEX Dashboard',
  description: 'Request and approval dashboard for OAKBERRY Ireland',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

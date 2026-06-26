import React from 'react';

/**
 * Admin web is LTR-primary, English UI acceptable for MVP (flows-and-ia §1.4).
 * Areas: Providers & Sources (G1) · Moderation (G2) · Analytics (G3).
 */
export const metadata = {
  title: 'BestOffers Admin',
  description: 'Provider/source management, moderation, KPI dashboard.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, display: 'flex' }}>
        <nav style={{ width: 200, padding: 16, borderRight: '1px solid #E1E4E8', minHeight: '100vh' }}>
          <strong>BestOffers Admin</strong>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 16, lineHeight: 2 }}>
            <li>Providers &amp; Sources (G1)</li>
            <li>Moderation (G2)</li>
            <li>Analytics (G3)</li>
          </ul>
        </nav>
        <main style={{ flex: 1, padding: 24 }}>{children}</main>
      </body>
    </html>
  );
}

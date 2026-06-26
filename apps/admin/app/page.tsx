import React from 'react';

/**
 * Stub landing page (S2-1). Dev D builds out CRUD for providers (G1), moderation (G2),
 * and the KPI dashboard (G3) reading ONLY anonymized event logs (no PII).
 */
export default function Home() {
  return (
    <div>
      <h1>BestOffers Admin</h1>
      <p>Sprint 2 stub. Owned by Dev D.</p>
      <ul>
        <li>
          <strong>G1 — Providers &amp; Sources:</strong> list / add / edit / enable-disable, health &amp;
          last-sync status. Scraping providers gated behind <code>tos_reviewed = true</code>.
        </li>
        <li>
          <strong>G2 — Moderation:</strong> suppress offers/sources; auditable (who/when).
        </li>
        <li>
          <strong>G3 — Analytics:</strong> KPI dashboard from anonymized <code>events</code> only — no PII.
        </li>
      </ul>
    </div>
  );
}

import type { Metadata } from 'next';
import CompareStonesTool from '@/components/compare/CompareStonesTool';

export const metadata: Metadata = {
  title: 'Compare Stones',
  description:
    'Compare diamonds, gemstones, watches, and fine jewelry side by side — shape, size, color, clarity, certification, and more.',
};

export default function ComparePage() {
  return (
    <div className="page-container">
      <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
        <p className="section-subtitle" style={{ marginBottom: 10 }}>
          Alpha Gemstone Tools
        </p>
        <h1 className="font-display" style={{ fontSize: '2rem', marginBottom: 14 }}>
          Compare Stones
        </h1>
        <div className="gold-divider" style={{ marginBottom: 16 }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
          Search for two or more pieces by name — diamonds, gemstones, watches, or jewelry — to see their
          live specs, stock, and pricing laid out side by side. Differences are highlighted automatically.
        </p>
      </div>

      <CompareStonesTool />
    </div>
  );
}
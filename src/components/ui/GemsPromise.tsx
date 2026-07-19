'use client';

import { motion, useInView } from 'framer-motion';
import Image from 'next/image';
import { useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// DESIGN NOTE
// This section is framed as a gemological appraisal report — the same
// document format every stone in the inventory actually ships with (GIA /
// IGI / AGL certificates). Report numbers, hairline rules, corner
// registration marks, and per-stone facet icons all borrow directly from
// that document language, rather than generic marketing-card decoration.
// ─────────────────────────────────────────────────────────────────────────

// ─── Design tokens ──────────────────────────────────────────────────────────
const paper = '#FAFAF7';
const ink = '#161A21';
const inkSoft = '#5B6472';
const inkFaint = '#8B8F96';
const hairline = '#E3E0D6';
const brass = '#8A6A2E';

// ─── Data ────────────────────────────────────────────────────────────────────
// Each entry maps to one gemstone family — the accent + facet icon are not
// decorative, they signal which stone that promise is most associated with.
const promiseItems = [
  {
    id: 1,
    report: 'GS–01',
    title: 'Largest Gemstone Inventory',
    description:
      'Over 50,000 rare coloured gemstones, catalogued and certified — the stone you want is one search away.',
    image:
      'https://images.unsplash.com/photo-1611652022419-a9419f74343d?q=80&w=1200',
    stone: 'Sapphire',
    accent: '#2C4A86',
    accentSoft: 'rgba(44,74,134,0.08)',
  },
  {
    id: 2,
    report: 'GS–02',
    title: 'Truly Bespoke',
    description:
      'Made to order — your gemstone, your metal, your silhouette. Every detail specified before it\u2019s made.',
    image:
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=1200',
    stone: 'Amethyst',
    accent: '#5B3B82',
    accentSoft: 'rgba(91,59,130,0.08)',
  },
  {
    id: 3,
    report: 'GS–03',
    title: 'Best-in-Class Craftsmanship',
    description:
      'Set by hand under magnification, by jewellers who\u2019ve cut their teeth on stones worth more than the tools they hold.',
    image:
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=1200',
    stone: 'Emerald',
    accent: '#1E6B47',
    accentSoft: 'rgba(30,107,71,0.08)',
  },
  {
    id: 4,
    report: 'GS–04',
    title: 'Full Transparency',
    description:
      'Every gemstone ships with its own certificate from an internationally recognised gemmological laboratory.',
    image:
      'https://images.unsplash.com/photo-1588449668365-d15e397f6787?q=80&w=1200',
    stone: 'Citrine',
    accent: '#A67C22',
    accentSoft: 'rgba(166,124,34,0.10)',
  },
];

const certLabs = ['GIA', 'IGI', 'AGL', 'Gübelin', 'HRD'];

// ─── Facet icon ───────────────────────────────────────────────────────────────
// A minimal faceted-stone glyph, recoloured per item. Stands in for a wax
// seal / lab stamp rather than a literal product photo of the gem.
function FacetIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L4 9L12 22L20 9L12 2Z"
        stroke={color}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M4 9H20" stroke={color} strokeWidth="1.1" />
      <path d="M8.5 9L12 2L15.5 9" stroke={color} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M8.5 9L12 22" stroke={color} strokeWidth="1" opacity="0.6" />
      <path d="M15.5 9L12 22" stroke={color} strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

// ─── Corner registration mark ─────────────────────────────────────────────────
function CornerMark({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const styles: Record<string, React.CSSProperties> = {
    tl: { top: -1, left: -1, borderRight: 'none', borderBottom: 'none' },
    tr: { top: -1, right: -1, borderLeft: 'none', borderBottom: 'none' },
    bl: { bottom: -1, left: -1, borderRight: 'none', borderTop: 'none' },
    br: { bottom: -1, right: -1, borderLeft: 'none', borderTop: 'none' },
  };
  return (
    <div
      className="absolute w-[14px] h-[14px] pointer-events-none"
      style={{ border: `1px solid ${brass}`, opacity: 0.55, ...styles[position] }}
    />
  );
}

// ─── PromiseCard ──────────────────────────────────────────────────────────────
function PromiseCard({
  item,
  index,
}: {
  item: (typeof promiseItems)[0];
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col"
      style={{
        background: paper,
        borderRight: `1px solid ${hairline}`,
      }}
    >
      {/* Photo — clean, true colour, framed like a report exhibit photo */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <div className="absolute inset-3 overflow-hidden" style={{ border: `1px solid ${hairline}` }}>
          <Image
            src={item.image}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
          />
        </div>
        {/* Facet seal, overlapping the photo's bottom-right corner */}
        <div
          className="absolute bottom-1 right-1 w-10 h-10 flex items-center justify-center"
          style={{ background: paper, border: `1px solid ${hairline}` }}
        >
          <FacetIcon color={item.accent} />
        </div>
      </div>

      {/* Report header strip */}
      <div
        className="flex items-center justify-between px-5 pt-4 pb-3"
        style={{ borderBottom: `1px solid ${hairline}` }}
      >
        <span
          className="text-[10px] tracking-[0.16em]"
          style={{ fontFamily: '"Elms Sans", sans-serif', color: item.accent, fontWeight: 500 }}
        >
          REPORT {item.report}
        </span>
        <span
          className="text-[9px] tracking-[0.14em] uppercase"
          style={{ fontFamily: '"Elms Sans", sans-serif', color: inkFaint }}
        >
          {item.stone}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 px-5 pt-4 pb-6">
        <h3
          className="mb-2.5 text-[18px] leading-[1.3]"
          style={{
            fontFamily: '"Elms Sans", sans-serif',
            color: ink,
            fontWeight: 500,
            letterSpacing: '-0.005em',
          }}
        >
          {item.title}
        </h3>

        <p
          className="flex-1 leading-[1.7]"
          style={{
            fontFamily: '"Elms Sans", sans-serif',
            fontSize: '13px',
            color: inkSoft,
            fontWeight: 400,
          }}
        >
          {item.description}
        </p>

        <div
          className="mt-5 h-[2px] w-7 group-hover:w-14 transition-all duration-500 ease-out"
          style={{ background: item.accent }}
        />
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GemsPromise() {
  const headingRef = useRef<HTMLDivElement>(null);
  const isHeadingInView = useInView(headingRef, { once: true, margin: '-60px' });

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Elms+Sans:ital,wght@0,100..900;1,100..900&display=swap');
      `}</style>

      <section className="relative w-full" style={{ background: paper }}>
        {/* Faint outlined watermark diamond — report-paper texture, not decoration */}
        <div
          className="absolute -bottom-14 -right-8 pointer-events-none select-none"
          style={{ opacity: 0.035 }}
        >
          <svg width="280" height="280" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 9L12 22L20 9L12 2Z" stroke={ink} strokeWidth="0.5" />
            <path d="M4 9H20" stroke={ink} strokeWidth="0.5" />
            <path d="M8.5 9L12 2L15.5 9" stroke={ink} strokeWidth="0.5" />
          </svg>
        </div>

        <div className="relative w-full px-6 sm:px-10 md:px-14 lg:px-20 py-16 sm:py-22 md:py-28">
          {/* ── HEADER ── */}
          <div ref={headingRef} className="mb-12 sm:mb-16 md:mb-18 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={isHeadingInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="flex items-center gap-3 mb-5"
            >
              <div className="w-6 h-px" style={{ background: brass, opacity: 0.6 }} />
              <span
                className="text-[10px] tracking-[0.30em] uppercase"
                style={{ fontFamily: '"Elms Sans", sans-serif', color: brass, fontWeight: 500 }}
              >
                Statement of Promise
              </span>
            </motion.div>

            <div className="overflow-hidden mb-4">
              <motion.h2
                initial={{ y: '105%' }}
                animate={isHeadingInView ? { y: 0 } : {}}
                transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  fontFamily: '"Elms Sans", sans-serif',
                  fontSize: 'clamp(34px, 5vw, 58px)',
                  lineHeight: 1.08,
                  fontWeight: 500,
                  color: ink,
                  letterSpacing: '-0.015em',
                }}
              >
                Excellence, put in{' '}
                <em style={{ fontStyle: 'italic', color: brass, fontWeight: 500 }}>
                  writing
                </em>
              </motion.h2>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={isHeadingInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.28, ease: 'easeOut' }}
              style={{
                fontFamily: '"Elms Sans", sans-serif',
                fontSize: '14px',
                lineHeight: 1.75,
                fontWeight: 400,
                color: inkSoft,
              }}
            >
              Four commitments we hold ourselves to on every piece — each one
              as verifiable as the certificate that comes with your stone.
            </motion.p>
          </div>

          {/* ── CARD GRID (framed like a document, with registration marks) ── */}
          <div className="relative">
            <CornerMark position="tl" />
            <CornerMark position="tr" />
            <CornerMark position="bl" />
            <CornerMark position="br" />
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-14 sm:mb-18 md:mb-20"
              style={{ border: `1px solid ${hairline}` }}
            >
              {promiseItems.map((item, index) => (
                <PromiseCard key={item.id} item={item} index={index} />
              ))}
            </div>
          </div>

          {/* ── CERT BAR — styled as a verification seal row ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex flex-wrap items-center gap-y-3 pt-8"
            style={{ borderTop: `1px solid ${hairline}` }}
          >
            <span
              className="w-full sm:w-auto text-[10px] tracking-[0.22em] uppercase mb-3 sm:mb-0 sm:mr-6"
              style={{ fontFamily: '"Elms Sans", sans-serif', color: inkFaint, fontWeight: 500 }}
            >
              Independently verified by
            </span>

            <div className="flex flex-wrap gap-2">
              {certLabs.map((lab, i) => (
                <motion.div
                  key={lab}
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: 0.15 + i * 0.06 }}
                  className="flex items-center gap-[6px] text-[12px] px-4 py-[7px] cursor-default select-none transition-colors duration-300"
                  style={{
                    fontFamily: '"Elms Sans", sans-serif',
                    color: ink,
                    border: `1px solid ${hairline}`,
                    fontWeight: 500,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke={brass} strokeWidth="1.4" />
                    <path
                      d="M8 12.5L10.5 15L16 9"
                      stroke={brass}
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {lab}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
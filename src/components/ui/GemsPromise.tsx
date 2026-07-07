'use client';

import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import Image from 'next/image';
import { useRef } from 'react';

// ─── Data ────────────────────────────────────────────────────────────────────

const promiseItems = [
  {
    id: 1,
    num: '01',
    title: 'Largest Gemstone Inventory',
    description:
      'Over 50,000 rare coloured gemstones, carefully curated and certified. The perfect stone is one click away.',
    image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?q=80&w=1200',
    tag: 'Collection',
    // Sapphire
    accentHex: '#2a4a9e',
    accentSoft: 'rgba(42,74,158,0.18)',
    accentBorder: 'rgba(42,74,158,0.32)',
    accentText: '#6a92e8',
  },
  {
    id: 2,
    num: '02',
    title: 'Truly Bespoke',
    description:
      'Made to order — your gemstone, your metal, your style. Every detail shaped to match your vision.',
    image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=1200',
    tag: 'Bespoke',
    // Amethyst
    accentHex: '#5c2a8e',
    accentSoft: 'rgba(92,42,142,0.18)',
    accentBorder: 'rgba(92,42,142,0.32)',
    accentText: '#b880f0',
  },
  {
    id: 3,
    num: '03',
    title: 'Best-in-Class Craftsmanship',
    description:
      'Expert jewellers, precision techniques, and enduring quality in every single piece we create.',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=1200',
    tag: 'Craft',
    // Emerald
    accentHex: '#1a5c3a',
    accentSoft: 'rgba(26,92,58,0.18)',
    accentBorder: 'rgba(26,92,58,0.32)',
    accentText: '#3ecc82',
  },
  {
    id: 4,
    num: '04',
    title: 'Full Transparency',
    description:
      "All our gemstones carry complete certifications from the world's most trusted gemmological labs.",
    image: 'https://images.unsplash.com/photo-1588449668365-d15e397f6787?q=80&w=1200',
    tag: 'Certified',
    // Gold
    accentHex: '#b8953a',
    accentSoft: 'rgba(184,149,58,0.15)',
    accentBorder: 'rgba(184,149,58,0.32)',
    accentText: '#d4b060',
  },
];

const certLabs = ['GIA', 'IGI', 'AGL', 'Gübelin', 'HRD'];

// ─── PromiseCard ──────────────────────────────────────────────────────────────

function PromiseCard({
  item,
  index,
}: {
  item: (typeof promiseItems)[0];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const imgY = useTransform(scrollYProgress, [0, 1], ['6%', '-6%']);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col cursor-pointer"
      style={{
        background: '#0c0907',
        borderRight: '1px solid rgba(180,145,60,0.10)',
      }}
      whileHover={{ background: '#110e0a' } as never}
    >
      {/* Gemstone-coloured shimmer line across the top */}
      <div
        className="h-[2px] w-full transition-opacity duration-500 opacity-60 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${item.accentHex}, transparent)`,
        }}
      />

      {/* Image */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '3/2' }}>
        <motion.div
          className="absolute will-change-transform"
          style={{ inset: '-8%', y: imgY }}
        >
          <Image
            src={item.image}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-all duration-700"
            style={{
              filter: 'brightness(0.55) saturate(0.65) sepia(0.2)',
            }}
          />
        </motion.div>

        {/* Bottom gradient — card bg bleeds into the image */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[60%] pointer-events-none"
          style={{
            background: 'linear-gradient(transparent, #0c0907)',
          }}
        />

        {/* Tag — bottom-right, Cinzel engraved style */}
        <div
          className="absolute bottom-3 right-3 px-[10px] py-[4px] text-[8px] tracking-[0.26em] uppercase border"
          style={{
            fontFamily: '"Elms Sans", sans-serif',
            color: item.accentText,
            borderColor: item.accentBorder,
            background: 'rgba(8,6,5,0.6)',
            backdropFilter: 'blur(4px)',
            fontWeight: 500,
          }}
        >
          {item.tag}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 px-[22px] pt-[22px] pb-[26px]">
        {/* Number */}
        <span
          className="block mb-[10px] text-[8px] tracking-[0.30em]"
          style={{ fontFamily: '"Elms Sans", sans-serif', color: '#7a6a52', fontWeight: 500 }}
        >
          — {item.num}
        </span>

        {/* Title */}
        <h3
          className="mb-3 text-[17px] leading-[1.25]"
          style={{
            fontFamily: '"Elms Sans", sans-serif',
            color: '#f0e8d8',
            letterSpacing: '0.01em',
            fontWeight: 500,
          }}
        >
          {item.title}
        </h3>

        {/* Description */}
        <p
          className="flex-1 mb-5 leading-[1.75] transition-colors duration-400 group-hover:text-[#b0a090]"
          style={{
            fontFamily: '"Elms Sans", sans-serif',
            fontSize: '12.5px',
            color: '#9a8c7c',
            letterSpacing: '0.01em',
            fontWeight: 400,
          }}
        >
          {item.description}
        </p>

        {/* Accent bar */}
        <div
          className="h-[1px] w-6 group-hover:w-12 transition-all duration-500 ease-out"
          style={{ background: item.accentHex }}
        />
      </div>
    </motion.div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function OrnamentalDivider() {
  return (
    <div className="flex items-center">
      <div className="flex-1 h-px" style={{ background: 'rgba(180,145,60,0.15)' }} />
      <div className="flex items-center gap-[10px] px-[18px]">
        <div
          className="w-[3px] h-[3px] rounded-full"
          style={{ background: '#6b5030' }}
        />
        <div
          className="w-[9px] h-[9px] rotate-45"
          style={{
            background: '#b8953a',
            boxShadow: '0 0 10px rgba(184,149,58,0.55)',
          }}
        />
        <div
          className="w-[3px] h-[3px] rounded-full"
          style={{ background: '#6b5030' }}
        />
      </div>
      <div className="flex-1 h-px" style={{ background: 'rgba(180,145,60,0.15)' }} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GemsPromise() {
  const headingRef = useRef<HTMLDivElement>(null);
  const isHeadingInView = useInView(headingRef, { once: true, margin: '-60px' });

  return (
    <>
      {/* Load Cinzel + Cormorant Garamond */}
      <style jsx global>{`
       @import url('https://fonts.googleapis.com/css2?family=Elms+Sans:ital,wght@0,100..900;1,100..900&display=swap');

      `}</style>

      <section
        className="relative w-full overflow-hidden"
        style={{ background: '#080605' }}
      >
        {/* Warm jewel-glow ambience */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 60% 40% at 82% 8%, rgba(120,60,20,0.18) 0%, transparent 60%),
              radial-gradient(ellipse 50% 35% at 8% 88%, rgba(30,20,80,0.22) 0%, transparent 55%),
              radial-gradient(ellipse 40% 30% at 50% 50%, rgba(80,20,20,0.10) 0%, transparent 60%)
            `,
          }}
        />

        {/* Engraved-metal diagonal hatching */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              rgba(201,168,76,0.022) 0px,
              rgba(201,168,76,0.022) 1px,
              transparent 1px,
              transparent 9px
            )`,
          }}
        />

        {/* Large watermark diamond */}
        <div
          className="absolute -bottom-16 -right-10 pointer-events-none select-none leading-none"
          style={{
            fontSize: '320px',
            color: 'rgba(184,149,58,0.04)',
            fontFamily: '"Elms Sans", sans-serif',
          }}
        >
          ◆
        </div>

        {/* Content */}
        <div className="relative w-full px-6 sm:px-10 md:px-14 lg:px-20 py-16 sm:py-22 md:py-28">

          {/* ── HEADER ── */}
          <div ref={headingRef} className="mb-14 sm:mb-18 md:mb-20">

            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={isHeadingInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="flex items-center gap-4 mb-5"
            >
              <div
                className="w-9 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, #b8953a, transparent)',
                }}
              />
              <span
                className="text-[9px] tracking-[0.38em] uppercase"
                style={{ fontFamily: '"Elms Sans", sans-serif', color: '#c9a84c', fontWeight: 500 }}
              >
                Our Promise
              </span>
              <div
                className="w-9 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, #b8953a, transparent)',
                }}
              />
            </motion.div>

            {/* Heading */}
            <div className="overflow-hidden mb-4">
              <motion.h2
                initial={{ y: '110%' }}
                animate={isHeadingInView ? { y: 0 } : {}}
                transition={{ duration: 1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  fontFamily: "'Google Sans Flex', sans-serif",
                  fontSize: 'clamp(38px, 6vw, 72px)',
                  lineHeight: 1.05,
                  fontWeight: 400,
                  color: '#f5efe4',
                  letterSpacing: '-0.01em',
                }}
              >
                Excellence<br />
                in{' '}
                <em
                  style={{
                    fontStyle: 'italic',
                    color: '#d4a84b',
                    fontWeight: 400,
                  }}
                >
                  every detail
                </em>
              </motion.h2>
            </div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={isHeadingInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.35, ease: 'easeOut' }}
              style={{
                fontFamily: '"Elms Sans", sans-serif',
                fontSize: '13px',
                lineHeight: 1.85,
                fontWeight: 400,
                color: '#8a7a68',
                maxWidth: '380px',
                letterSpacing: '0.01em',
              }}
            >
              From gemstone selection to final craftsmanship — each promise is a
              commitment to quality you can see, touch, and trust.
            </motion.p>
          </div>

          {/* ── CARD GRID ── */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-14 sm:mb-18 md:mb-20"
            style={{
              border: '1px solid rgba(180,145,60,0.14)',
            }}
          >
            {promiseItems.map((item, index) => (
              <PromiseCard key={item.id} item={item} index={index} />
            ))}
          </div>

          {/* ── ORNAMENTAL DIVIDER ── */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2 }}
            className="mb-10"
          >
            <OrnamentalDivider />
          </motion.div>

          {/* ── CERT BAR ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-wrap items-center gap-y-3"
          >
            <span
              className="w-full sm:w-auto text-[8px] tracking-[0.30em] uppercase mb-2 sm:mb-0 sm:mr-5"
              style={{ fontFamily: '"Elms Sans", sans-serif', color: '#7a6a50', fontWeight: 500 }}
            >
              Certified by
            </span>

            <div className="flex flex-wrap gap-2">
              {certLabs.map((lab, i) => (
                <motion.div
                  key={lab}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.08 }}
                  className="text-[11px] tracking-[0.12em] px-[18px] py-[7px] cursor-default select-none transition-all duration-350"
                  style={{
                    fontFamily: '"Elms Sans", sans-serif',
                    color: '#7a6a52',
                    border: '1px solid rgba(180,145,60,0.22)',
                    background: 'transparent',
                    fontWeight: 500,
                  }}
                  whileHover={{
                    color: '#d4a84b',
                    borderColor: 'rgba(180,145,60,0.55)',
                    background: 'rgba(180,145,60,0.05)',
                    boxShadow: 'inset 0 0 12px rgba(180,145,60,0.06)',
                  } as never}
                >
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
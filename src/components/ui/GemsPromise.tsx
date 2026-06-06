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
      'Over 50,000 rare colored gemstones, carefully curated and certified. The perfect stone is one click away.',
    image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?q=80&w=1200',
    tag: 'Collection',
    color: '#2563eb',
    soft: '#dbeafe',
  },
  {
    id: 2,
    num: '02',
    title: 'Truly Bespoke',
    description:
      'Made to order — your gemstone, your metal, your style. Every detail shaped to match your vision.',
    image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=1200',
    tag: 'Custom',
    color: '#7c3aed',
    soft: '#ede9fe',
  },
  {
    id: 3,
    num: '03',
    title: 'Best-in-Class Craftsmanship',
    description:
      'Expert jewelers, precision techniques, and enduring quality in every single piece we create.',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=1200',
    tag: 'Craft',
    color: '#0d9488',
    soft: '#ccfbf1',
  },
  {
    id: 4,
    num: '04',
    title: 'Full Transparency',
    description:
      "All our gemstones come with complete certifications from the world's most trusted labs.",
    image: 'https://images.unsplash.com/photo-1588449668365-d15e397f6787?q=80&w=1200',
    tag: 'Certified',
    color: '#c9a84c',
    soft: '#fef9ec',
  },
];

const certLabs = ['GIA', 'IGI', 'AGL', 'Gübelin', 'HRD'];

// ─── PromiseCard ──────────────────────────────────────────────────────────────

function PromiseCard({ item, index }: { item: (typeof promiseItems)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['6%', '-6%']);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 44 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      className="group flex flex-col rounded-2xl overflow-hidden cursor-pointer w-full"
      style={{
        background: '#ffffff',
        border: '1px solid #ede9e1',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
      }}
      whileHover={{
        boxShadow: `0 12px 40px rgba(0,0,0,0.10), 0 0 0 1.5px ${item.color}33`,
        y: -4,
      }}
      transition={{ duration: 0.3 } as never}
    >
      {/* Image */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <motion.div className="absolute inset-[-8%] will-change-transform" style={{ y: imgY }}>
          <Image
            src={item.image}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover brightness-[0.88] saturate-90 group-hover:brightness-95 group-hover:saturate-100 transition-all duration-700"
          />
        </motion.div>

        {/* Vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />

        {/* Tag pill */}
        <div
          className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[9px] tracking-[0.16em] uppercase font-bold"
          style={{
            background: item.soft,
            color: item.color,
            border: `1px solid ${item.color}30`,
          }}
        >
          {item.tag}
        </div>
      </div>

      {/* Text panel */}
      <div className="flex flex-col flex-1 p-5" style={{ background: '#ffffff' }}>
        <div className="flex items-start gap-2.5 mb-2.5">
          <span
            className="text-[9px] tracking-[0.16em] mt-[3px] shrink-0 font-bold"
            style={{ color: item.color, fontFamily: "'DM Mono', monospace" }}
          >
            {item.num}
          </span>
          <h3
            className="text-[14px] leading-[1.35] font-bold"
            style={{ color: '#0f0d0b', letterSpacing: '-0.015em' }}
          >
            {item.title}
          </h3>
        </div>

        <p
          className="text-[12px] leading-[1.7] mb-4"
          style={{ color: '#7a736a', fontWeight: 400 }}
        >
          {item.description}
        </p>

        <div className="mt-auto">
          <div
            className="h-[2px] rounded-full w-7 group-hover:w-14 transition-all duration-500 ease-out"
            style={{ background: item.color }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 h-px" style={{ background: '#e8e2d9' }} />
      <div className="w-1.5 h-1.5 rounded-sm rotate-45" style={{ background: '#c9a84c' }} />
      <div className="flex-1 h-px" style={{ background: '#e8e2d9' }} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GemsPromise() {
  const headingRef = useRef<HTMLDivElement>(null);
  const isHeadingInView = useInView(headingRef, { once: true, margin: '-60px' });

  return (
    <>
      <style jsx global>{`
      `}</style>

      <section
        className="relative w-full overflow-hidden"
        style={{
          background: '#ffffff',
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#c9a84c08 1px, transparent 1px), linear-gradient(90deg, #c9a84c08 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Large watermark */}
        <div
          className="absolute -bottom-12 -right-12 pointer-events-none select-none font-serif leading-none"
          style={{ fontSize: '320px', color: '#c9a84c', opacity: 0.04 }}
        >
          ◆
        </div>

        {/* Content */}
        <div className="relative w-full px-4 sm:px-6 md:px-10 lg:px-16 py-14 sm:py-20 md:py-24 lg:py-28">

          {/* ── HEADER ── */}
          <div ref={headingRef} className="mb-12 sm:mb-16 md:mb-20">

            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, x: -14 }}
              animate={isHeadingInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="flex items-center gap-3 mb-4 sm:mb-6"
            >
              <div className="w-5 sm:w-7 h-[1.5px]" style={{ background: '#c9a84c' }} />
              <span
                className="text-[9px] sm:text-[10px] tracking-[0.28em] uppercase font-bold"
                style={{ color: '#c9a84c' }}
              >
                Our Promise
              </span>
            </motion.div>

            {/* Heading */}
            <div className="overflow-hidden mb-5">
              <motion.h2
                initial={{ y: '108%' }}
                animate={isHeadingInView ? { y: 0 } : {}}
                transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 'clamp(34px, 6.5vw, 76px)',
                  lineHeight: 1.06,
                  fontWeight: 400,
                  color: '#0f0d0b',
                  letterSpacing: '-0.025em',
                }}
              >
                Excellence in  every detail
                
              </motion.h2>
            </div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={isHeadingInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
              className="text-[13px] sm:text-[14px] leading-[1.8] max-w-[360px] sm:max-w-[440px]"
              style={{ color: '#7a736a', fontWeight: 400, letterSpacing: '0.01em' }}
            >
              From gemstone selection to final craftsmanship — each promise is a
              commitment to quality you can see, touch, and trust.
            </motion.p>
          </div>

          {/* ── CARD GRID ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14 sm:mb-18 md:mb-20">
            {promiseItems.map((item, index) => (
              <PromiseCard key={item.id} item={item} index={index} />
            ))}
          </div>

          {/* ── DIVIDER ── */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="mb-10"
          >
            <Divider />
          </motion.div>

          {/* ── CERT BAR ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex flex-wrap items-center gap-y-3"
          >
            <span
              className="w-full sm:w-auto text-[9px] tracking-[0.22em] uppercase font-bold mb-2 sm:mb-0 sm:mr-6"
              style={{ color: '#b0a898' }}
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
                  transition={{ duration: 0.45, delay: 0.3 + i * 0.07 }}
                  className="text-[12px] sm:text-[13px] tracking-[0.08em] px-4 py-[6px] rounded-lg transition-all duration-300 cursor-default select-none font-semibold"
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    color: '#7a736a',
                    border: '1.5px solid #e8e2d9',
                    background: '#ffffff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                  whileHover={{
                    color: '#c9a84c',
                    borderColor: '#c9a84c50',
                    background: '#fef9ec',
                    boxShadow: '0 4px 12px rgba(201,168,76,0.12)',
                  }}
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
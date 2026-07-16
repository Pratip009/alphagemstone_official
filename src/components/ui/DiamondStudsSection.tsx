"use client";

import { motion } from "framer-motion";
import Link from "next/link";

interface DiamondStudsSectionProps {
  videoSrc: string;
}

export default function DiamondStudsSection({
  videoSrc,
}: DiamondStudsSectionProps) {
  return (
    <section className="w-full bg-white">
      <div className="mx-auto grid max-w-[1800px] grid-cols-1 lg:grid-cols-[62%_38%]">
        {/* Video Section */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="h-[380px] w-full overflow-hidden lg:h-[560px]"
        >
          <video
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
        </motion.div>

        {/* Content Section */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          viewport={{ once: true }}
          className="flex w-full flex-col items-center justify-center bg-neutral-100 px-10 py-16 text-center lg:min-h-[560px] lg:px-16"
        >
          <p className="max-w-sm text-lg italic leading-8 text-[#16234f] md:text-xl">
            From everyday essentials to statement sparkle, our lab-grown
            diamond studs are designed to elevate every look. Crafted with
            precision and set in fine gold, each pair reflects unmatched
            brilliance and modern luxury.
          </p>

          <Link
            href="/products?category=diamonds"
            className="mt-8 rounded-md bg-[#16234f] px-9 py-3.5 text-sm font-medium uppercase tracking-[0.15em] text-white transition-colors duration-300 hover:bg-[#1f2f68]"
          >
            Shop Now!
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
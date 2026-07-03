import Image from "next/image";

export default function AboutBanner() {
  return (
    <>
      <style>{`
       @import url('https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap');
        .about-banner * { font-family: 'Google Sans Flex', sans-serif; }
      `}</style>

      {/* Hero Banner */}
      <section className="about-banner relative w-full h-[340px] md:h-[420px] overflow-hidden flex items-center justify-center">
        <Image
          src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1800&q=80"
          alt="Exquisite diamonds and gemstones"
          fill
          className="object-cover object-center scale-105"
          priority
        />

        {/* Light overlay — white wash with soft center transparency */}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(255,255,255,0.55)] via-[rgba(255,255,255,0.45)] to-white" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(255,255,255,0.5)_100%)]" />

        {/* Decorative corner accents */}
        <div className="absolute top-6 left-6 w-14 h-14 border-t border-l border-[rgba(180,145,60,0.35)]" />
        <div className="absolute top-6 right-6 w-14 h-14 border-t border-r border-[rgba(180,145,60,0.35)]" />
        <div className="absolute bottom-6 left-6 w-14 h-14 border-b border-l border-[rgba(180,145,60,0.35)]" />
        <div className="absolute bottom-6 right-6 w-14 h-14 border-b border-r border-[rgba(180,145,60,0.35)]" />

        <div className="relative z-10 flex flex-col items-center text-center px-6">
          {/* Eyebrow label */}
          <span
            className="text-[9px] font-semibold tracking-[0.45em] uppercase border px-5 py-2 mb-5"
            style={{
              color: "#9A7D3A",
              borderColor: "rgba(180,145,60,0.35)",
              background: "rgba(255,255,255,0.6)",
              backdropFilter: "blur(6px)",
            }}
          >
            Our Story
          </span>

          {/* Main heading */}
          <h1
            className="text-[2.8rem] md:text-[4rem] font-light tracking-[0.06em] leading-none mb-5"
            style={{ color: "#1a1208" }}
          >
            About Us
          </h1>

          {/* Ornamental divider */}
          <div className="flex items-center gap-3">
            <span
              className="block w-16 h-px"
              style={{ background: "linear-gradient(to right, transparent, rgba(180,145,60,0.6), transparent)" }}
            />
            <span style={{ color: "#C8A040", fontSize: "8px" }}>◆</span>
            <span
              className="block w-16 h-px"
              style={{ background: "linear-gradient(to right, transparent, rgba(180,145,60,0.6), transparent)" }}
            />
          </div>
        </div>
      </section>
    </>
  );
}
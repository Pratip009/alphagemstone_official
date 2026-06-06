import Image from "next/image";

const gems = [
  { name: "Colored Diamonds", shade: "from-[#E8C97A] to-[#B8922A]", desc: "15+ luminous shades" },
  { name: "White & Blue", shade: "from-[#C8DCF5] to-[#6A9ED4]", desc: "Icy brilliance" },
  { name: "Tanzanite", shade: "from-[#B8A4E8] to-[#6B4FA8]", desc: "Rare violet depths" },
  { name: "Emerald", shade: "from-[#7ED4A0] to-[#2A7A50]", desc: "Colombian origins" },
  { name: "Ruby", shade: "from-[#F4907A] to-[#B83020]", desc: "Pigeon blood red" },
  { name: "Sapphire", shade: "from-[#6AAEDE] to-[#1A4F8A]", desc: "Kashmir blue" },
];

export default function AlphaImportsSection() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap');
        .ai-root { font-family: 'Poppins', sans-serif; }
        .ai-gem-card { transition: border-color 0.3s, box-shadow 0.3s; }
        .ai-gem-card:hover { border-color: #C8A040 !important; box-shadow: 0 4px 20px rgba(180,145,40,0.1); }
        .ai-btn:hover { background: #f5f5f5 !important; }
        .ai-link:hover { color: #111 !important; }
        .ai-bottom-img img { transition: opacity 0.3s; }
        .ai-bottom-img:hover img { opacity: 0.7; }
      `}</style>

      <section
        className="ai-root relative bg-white overflow-hidden"
      >
        {/* ─── HERO SPLIT ─── */}
        <div className="grid md:grid-cols-2 min-h-[500px]">

          {/* Left: Image */}
          <div className="relative h-[300px] md:h-auto overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1543294001-f7cd5d7fb516?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt="Luxury diamond jewelry"
              fill
              className="object-cover object-center"
              priority
            />
            {/* Fade right into white */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white hidden md:block" />
            {/* Fade bottom on mobile */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white md:hidden" />

            {/* Floating badge */}
            <div
              className="ai-badge absolute bottom-8 left-8 bg-white border px-5 py-3"
              style={{ borderColor: "rgba(180,145,60,0.25)", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
            >
              <p
                className="mb-1"
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  letterSpacing: "0.4em",
                  textTransform: "uppercase",
                  color: "#9A7D3A",
                }}
              >
                Satisfaction
              </p>
              <p style={{ fontSize: "13px", fontWeight: 400, color: "#1a1a1a" }}>
                100% Guaranteed
              </p>
            </div>
          </div>

          {/* Right: Text */}
          <div className="relative flex flex-col justify-center px-8 md:px-14 py-14 md:py-16 bg-white">

            {/* Eyebrow */}
            <span className="inline-flex items-center gap-3 mb-7">
              <span className="block w-8 h-px" style={{ background: "rgba(180,145,60,0.4)" }} />
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  letterSpacing: "0.42em",
                  textTransform: "uppercase",
                  color: "#B4912C",
                }}
              >
                Alpha Imports
              </span>
            </span>

            <h2
              style={{
                fontSize: "clamp(2rem, 4vw, 2.75rem)",
                fontWeight: 300,
                color: "#111111",
                lineHeight: 1.12,
                marginBottom: "1.25rem",
                letterSpacing: "-0.01em",
              }}
            >
              The World's Finest
              <br />
              <span style={{ color: "#B4912C", fontWeight: 500 }}>Colored Diamonds</span>
              <br />
              &amp; Gemstones
            </h2>

            <p
              style={{
                fontSize: "0.875rem",
                color: "#555555",
                lineHeight: 1.9,
                letterSpacing: "0.01em",
                marginBottom: "1rem",
                fontWeight: 300,
              }}
            >
              One of the best online selections of superior quality colored diamonds,
              diamond jewelry, loose diamonds, precious gems, semi-precious gemstones,
              and wholesale jewelry — at the most competitive values in the industry.
            </p>

            <p
              style={{
                fontSize: "0.875rem",
                color: "#555555",
                lineHeight: 1.9,
                letterSpacing: "0.01em",
                marginBottom: "2rem",
                fontWeight: 300,
              }}
            >
              Available in more than{" "}
              <span style={{ color: "#8A6820", fontWeight: 500 }}>15 luminous shades</span>{" "}
              — a stunning diamond ring, necklace, bracelet, or pair of earrings from
              Alpha Imports is certain to leave any special person in your life speechless.
            </p>

            {/* CTA row */}
            <div className="flex items-center gap-6 flex-wrap">
              <a
                href="tel:8005642572"
                className="ai-btn inline-flex items-center gap-3 px-6 py-3 transition-colors duration-200"
                style={{
                  border: "1px solid rgba(180,145,60,0.4)",
                  textDecoration: "none",
                  background: "white",
                }}
              >
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 600,
                    letterSpacing: "0.35em",
                    textTransform: "uppercase",
                    color: "#8A6820",
                  }}
                >
                  Call Toll-Free
                </span>
                <span style={{ fontSize: "13px", fontWeight: 400, color: "#333" }}>
                  800-56-ALPHA
                </span>
              </a>
              <a
                href="#shop"
                className="ai-link flex items-center gap-2 transition-colors duration-200"
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  letterSpacing: "0.35em",
                  textTransform: "uppercase",
                  color: "#999",
                  textDecoration: "none",
                }}
              >
                Shop Now <span style={{ fontSize: "13px" }}>→</span>
              </a>
            </div>
          </div>
        </div>

        {/* ─── DIVIDER ─── */}
        <div className="flex items-center gap-4 px-8 md:px-14 py-2">
          <span
            className="flex-1 h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(180,145,60,0.2), transparent)" }}
          />
          <span style={{ color: "#C8A040", fontSize: "8px" }}>◆</span>
          <span
            className="flex-1 h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(180,145,60,0.2), transparent)" }}
          />
        </div>

        {/* ─── GEM CATEGORIES STRIP ─── */}
        <div className="relative px-8 md:px-14 py-14 bg-white">
          <div className="flex items-center gap-3 mb-10">
            <span className="block w-8 h-px" style={{ background: "rgba(180,145,60,0.4)" }} />
            <span
              style={{
                fontSize: "9px",
                fontWeight: 600,
                letterSpacing: "0.42em",
                textTransform: "uppercase",
                color: "#9A7D3A",
              }}
            >
              Our Collections
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {gems.map((gem) => (
              <div
                key={gem.name}
                className="ai-gem-card group relative flex flex-col items-center gap-3 p-5 cursor-pointer bg-white"
                style={{ border: "1px solid rgba(180,145,60,0.15)" }}
              >
                {/* Gem swatch */}
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${gem.shade}`}
                  style={{ boxShadow: "0 2px 12px rgba(180,145,60,0.15)" }}
                />
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#2a2a2a",
                    textAlign: "center",
                    lineHeight: 1.4,
                  }}
                >
                  {gem.name}
                </p>
                <p
                  style={{
                    fontSize: "9px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#999",
                    textAlign: "center",
                    fontWeight: 400,
                  }}
                >
                  {gem.desc}
                </p>
                {/* Bottom hover line */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: "linear-gradient(to right, transparent, rgba(180,145,60,0.5), transparent)" }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ─── BOTTOM STRIP ─── */}
        <div
          className="relative px-8 md:px-14 py-8 flex flex-col md:flex-row items-center justify-between gap-5 bg-white"
          style={{ borderTop: "1px solid rgba(180,145,60,0.12)" }}
        >
          <div
            className="ai-bottom-img relative overflow-hidden flex-shrink-0"
            style={{ height: "72px", width: "260px" }}
          >
            <Image
              src="https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80"
              alt="Gemstone jewelry collection"
              fill
              className="object-cover object-center"
              style={{ opacity: 0.5 }}
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to right, white, transparent, white)" }}
            />
          </div>

          <p
            style={{
              textAlign: "center",
              fontSize: "14px",
              fontWeight: 300,
              fontStyle: "italic",
              color: "#888",
              lineHeight: 1.7,
            }}
          >
            "Tanzanite, Emerald, Ruby, Sapphire — in every cut, shape &amp; size imaginable."
          </p>

          <div className="text-center md:text-right flex-shrink-0">
            <p
              style={{
                fontSize: "9px",
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: "#aaa",
                marginBottom: "3px",
                fontWeight: 400,
              }}
            >
              Gold &amp; Sterling Silver
            </p>
            <p
              style={{
                fontSize: "9px",
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: "#aaa",
                fontWeight: 400,
              }}
            >
              Wholesale Jewelry
            </p>
            <p
              style={{
                color: "#B4912C",
                fontSize: "13px",
                marginTop: "8px",
                fontWeight: 400,
              }}
            >
              Lowest Prices · Every Day
            </p>
          </div>
        </div>
      </section>
    </>
  );
}